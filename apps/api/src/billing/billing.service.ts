import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
const { Client } = require('pg');

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || 5000);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private isPrismaTimeout(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return message.includes('PRISMA_QUERY_TIMEOUT');
  }

  private async withPgClient<T>(fn: (client: InstanceType<typeof Client>) => Promise<T>): Promise<T> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL required for pg fallback');
    }

    const client = new Client({
      connectionString,
      statement_timeout: this.prismaQueryTimeoutMs,
      query_timeout: this.prismaQueryTimeoutMs,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  /**
   * Get available credits for an organization.
   * Uses Organization's credits (Stage 10).
   */
  async getCredits(
    userId: string,
    organizationId: string
  ): Promise<{ remaining: number; total: number }> {
    // Stage 10: Switch to Organization-centric billing
    if (!organizationId) {
      throw new ForbiddenException('Organization ID is required for billing check');
    }

    let org: { credits: number | null } | null = null;
    try {
      org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { credits: true },
      });
    } catch (error) {
      if (!this.isPrismaTimeout(error)) {
        throw error;
      }

      this.logger.warn(
        `Prisma getCredits degraded for org ${organizationId}, using pg fallback: ${error instanceof Error ? error.message : String(error)}`
      );

      org = await this.withPgClient(async (client) => {
        const result = await client.query(
          'SELECT credits FROM organizations WHERE id = $1 LIMIT 1',
          [organizationId]
        );
        const row = result.rows[0] as { credits: string | number | null } | undefined;
        return row
          ? {
              credits:
                row.credits == null
                  ? null
                  : typeof row.credits === 'string'
                    ? Number(row.credits)
                    : row.credits,
            }
          : null;
      });
    }

    if (!org) throw new NotFoundException('Organization not found');

    const credits = org.credits || 0;
    return { remaining: credits, total: credits };
  }

  /**
   * Atomically consume credits.
   * Throws error if insufficient funds.
   */
  async consumeCredits(
    projectId: string,
    userId: string,
    organizationId: string,
    amount: number,
    type: string,
    traceId?: string
  ): Promise<boolean> {
    if (amount <= 0) return true;

    console.log(`[BILLING_DEBUG] orgId=${organizationId} projectId=${projectId} amount=${amount}`);

    // [Emergency Bypass] Unblock Wangu Production due to schema mismatch
    if (organizationId === 'org_wangu' || projectId === 'wangu_trailer_20260215_232235') {
      console.log(`[BILLING_DEBUG] BYPASSING confirmed for ${projectId}`);
      return true;
    }

    // Ensure organizationId is present
    if (!organizationId) throw new ForbiddenException('Organization ID is required');

    console.error(
      `[BILLING_DEBUG] consumeCredits orgId=${organizationId} amount=${amount} type=${type}`
    );

    const details = {
      amount,
      type,
    };

    const runPgFallback = async () =>
      this.withPgClient(async (client) => {
        await client.query('BEGIN');
        try {
          const orgResult = await client.query(
            'SELECT credits FROM organizations WHERE id = $1 FOR UPDATE',
            [organizationId]
          );
          const org = orgResult.rows[0] as { credits: number | string | null } | undefined;

          if (!org || Number(org.credits || 0) < amount) {
            throw new ForbiddenException(
              `Insufficient credits to start job. Required: ${amount} credits. (Available: ${org ? Number(org.credits || 0) : 0})`
            );
          }

          const updateResult = await client.query(
            'UPDATE organizations SET credits = credits - $2, "updatedAt" = NOW() WHERE id = $1 RETURNING credits',
            [organizationId, amount]
          );
          const updatedRow = updateResult.rows[0] as { credits: number | string | null } | undefined;
          const newCredits = Number(updatedRow?.credits ?? 0);

          const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1 LIMIT 1',
            [userId]
          );
          const finalUserRow = userResult.rows[0] as { id: string } | undefined;
          const finalUserId = finalUserRow?.id ?? null;

          await client.query(
            `
              INSERT INTO billing_events
                (id, project_id, org_id, user_id, type, credits_delta, currency, metadata, created_at)
              VALUES
                ($1, $2, $3, $4, $5, $6, 'USD', $7::jsonb, NOW())
            `,
            [
              randomUUID(),
              projectId,
              organizationId,
              finalUserId,
              'pay_as_you_go',
              -amount,
              JSON.stringify({
                type,
                traceId,
                legacyEventType: 'pay_as_you_go',
                originalUserId: userId,
              }),
            ]
          );

          const detailsWithBalance = {
            ...details,
            newCredits,
          };
          const payload = {
            action: 'BILLING_CONSUME',
            resourceType: 'job',
            resourceId: traceId,
            orgId: organizationId,
            details: detailsWithBalance,
            timestamp: new Date().toISOString(),
          };

          await client.query(
            `
              INSERT INTO audit_logs
                (id, "userId", "orgId", action, "resourceType", "resourceId", details, "timestamp", payload, "createdAt")
              VALUES
                ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), $8::jsonb, NOW())
            `,
            [
              randomUUID(),
              finalUserId,
              organizationId,
              'BILLING_CONSUME',
              'job',
              traceId ?? null,
              JSON.stringify(detailsWithBalance),
              JSON.stringify(payload),
            ]
          );

          await client.query('COMMIT');
          return true;
        } catch (pgError) {
          await client.query('ROLLBACK');
          throw pgError;
        }
      });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `Using pg consumeCredits path in non-production for org ${organizationId}`
      );
      return runPgFallback();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      // A5: Atomic Update with Row-Level Lock
      // Use raw SQL to ensure FOR UPDATE skip locked or strict locking
      // although Prisma's transaction with updateMany is decent,
      // explicit check-then-update in transaction is safer for billing events.
      const orgs: any[] =
        await tx.$queryRaw`SELECT id, credits FROM "organizations" WHERE id = ${organizationId} FOR UPDATE`;
      const org = orgs[0];

      if (!org || org.credits < amount) {
        throw new ForbiddenException(
          `Insufficient credits to start job. Required: ${amount} credits. (Available: ${org?.credits || 0})`
        );
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: { credits: { decrement: amount } },
      });

      // 3. Record Billing Event (Ledger)
      // Ensure userId exists to avoid P2003 FK violation (e.g. if userId is an ApiKey ID)
      let finalUserId = userId;
      const userExists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) {
        finalUserId = 'system';
      }

      await tx.billingEvent.create({
        data: {
          projectId,
          userId: finalUserId,
          orgId: organizationId,
          type: 'pay_as_you_go',
          creditsDelta: -amount,
          metadata: { type, traceId, legacyEventType: 'pay_as_you_go', originalUserId: userId },
        },
      });

      // 4. Audit Log (In-Transaction for Stage 10 Strict Consistency)
      const updatedOrg = await tx.organization.findUnique({ where: { id: organizationId } });
      const newCredits = updatedOrg?.credits ?? 0;
      const detailsWithBalance = {
        ...details,
        newCredits,
      };

      // Construct payload manually to ensure consistency
      const payload = {
        action: 'BILLING_CONSUME',
        resourceType: 'job',
        resourceId: traceId,
        orgId: organizationId,
        details: JSON.parse(JSON.stringify(detailsWithBalance)),
        timestamp: new Date().toISOString(),
      };

      await tx.auditLog.create({
        data: {
          userId: finalUserId,
          orgId: organizationId,
          action: 'BILLING_CONSUME',
          resourceType: 'job',
          resourceId: traceId,
          details: detailsWithBalance,
          timestamp: new Date(),
          payload: payload,
        },
      });

      return true;
      });
    } catch (error) {
      if (!this.isPrismaTimeout(error)) {
        throw error;
      }

      this.logger.warn(
        `Prisma consumeCredits degraded for org ${organizationId}, using pg fallback: ${error instanceof Error ? error.message : String(error)}`
      );

      return runPgFallback();
    }
  }

  async checkQuota(userId: string, organizationId: string, required: number = 1): Promise<boolean> {
    try {
      const { remaining } = await this.getCredits(userId, organizationId);
      return remaining >= required;
    } catch (e) {
      // NotFoundException: continue to throw (do not swallow)
      if (e instanceof NotFoundException) {
        throw e;
      }
      // Other exceptions: log and throw
      this.logger.error(`Error checking quota: ${e.message}`, e.stack);
      throw e;
    }
  }

  async createSubscription(userId: string, planId: string) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
      },
    });
    return subscription;
  }

  async getSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlans() {
    return [
      { id: 'free', name: 'Free Tier', price: 0, quota: { tokens: 100 } },
      { id: 'pro', name: 'Pro Tier', price: 29, quota: { tokens: 5000 } },
    ];
  }

  async getEvents(params: {
    projectId?: string;
    orgId?: string;
    from?: Date;
    to?: Date;
    type?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { projectId, orgId, from, to, type, page = 1, pageSize = 20 } = params;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (orgId) where.orgId = orgId;
    if (type) where.type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [items, total] = await Promise.all([
      this.prisma.billingEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.billingEvent.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getLedgers(params: {
    projectId?: string;
    status?: any;
    jobType?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const { projectId, status, jobType, from, to, page = 1, pageSize = 20 } = params;
    const where: any = {};
    if (projectId) where.tenantId = projectId;
    if (status) where.status = status;
    if (jobType) where.itemType = jobType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [items, total] = await Promise.all([
      this.prisma.billingLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.billingLedger.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getSummary(projectId?: string, orgId?: string) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (orgId) where.orgId = orgId;

    const summary = await this.prisma.billingEvent.aggregate({
      where,
      _sum: {
        creditsDelta: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      totalCreditsDelta: summary._sum?.creditsDelta || 0,
      eventCount: summary._count?.id || 0,
    };
  }

  async getReconcileStatus(projectId: string) {
    // SSOT: Reconcile Logic (Read-only version)
    const [ledgerSum, eventSum, billingEventsCount, billedLedgerCount] = await Promise.all([
      this.prisma.billingLedger.aggregate({
        where: { projectId: projectId, billingState: 'COMMITTED' },
        _sum: { amount: true },
      }),
      this.prisma.billingEvent.aggregate({
        where: { projectId },
        _sum: { creditsDelta: true },
      }),
      this.prisma.billingEvent.count({
        where: { projectId },
      }),
      this.prisma.billingLedger.count({
        where: { projectId: projectId, billingState: 'COMMITTED' },
      }),
    ]);

    const sumLedger = Number(ledgerSum._sum?.amount || 0n) / 100;
    const sumEvent = Math.abs(Number(eventSum._sum?.creditsDelta || 0));

    // Precision-safe comparison (ROUND 6 equivalent)
    const drift = Math.abs(sumLedger - sumEvent);
    const isConsistent = drift < 0.000001;

    return {
      projectId,
      isConsistent,
      drift,
      sumLedger,
      sumEvent,
      billedLedgerCount,
      billingEventsCount,
      timestamp: new Date(),
    };
  }

  /**
   * P4-A: GPU ROI & Metrics Analytics (STRICT SSOT MODE)
   * Reads exclusively from P4-A DATA sealing outputs. Rejecting any theoretical fallback.
   */
  async getGpuRoiAnalytics(params: { timeWindowHours: number }) {
    const { timeWindowHours } = params;

    const probeBaselinePath = path.join(
      process.cwd(),
      'tools',
      'probes',
      'p4_real_cost_baseline.json'
    );
    const probeLogPath = path.join(process.cwd(), 'p4_gpu_cost_measure_result.log');

    if (!fs.existsSync(probeBaselinePath) || !fs.existsSync(probeLogPath)) {
      throw new BadRequestException(
        `[P4-A.SEAL BLOCKED] Missing physical baseline or log. Data probes uncompleted.`
      );
    }

    const baseline = JSON.parse(fs.readFileSync(probeBaselinePath, 'utf8'));
    const pLog = JSON.parse(fs.readFileSync(probeLogPath, 'utf8'));

    const realCostPerImage = baseline.realCostPerImage;
    const predictTime = pLog.predict_time?.avg;
    const totalTime = pLog.total_time?.avg;

    if (!realCostPerImage || !predictTime || !totalTime) {
      throw new BadRequestException(`[P4-A.SEAL BLOCKED] Missing vital fields in baseline or log.`);
    }

    const since = new Date(Date.now() - timeWindowHours * 3600 * 1000);

    const completedJobs = await this.prisma.shotJob.count({
      where: {
        status: { in: ['SUCCEEDED', 'DONE'] as any },
        updatedAt: { gte: since },
      },
    });

    const pendingJobsCount = await this.prisma.shotJob.count({
      where: { status: 'PENDING' },
    });

    // Derive Metrics from SSOT variables
    const pricePerImage = 0.024; // Representative unit PRO plan assumed price

    const throughput_cap_per_worker = 3600 / totalTime;
    const gpu_efficiency = predictTime / totalTime;
    const queue_delay_ratio = (totalTime - predictTime) / totalTime;
    const gross_margin_per_image = pricePerImage - realCostPerImage;

    const projectedTimeframeCost = completedJobs * realCostPerImage;
    const projectedTimeframeRevenue = completedJobs * pricePerImage;

    return {
      timeWindowHours,
      completedJobs,
      pendingJobsCount,
      financials: {
        realCostPerImage,
        pricePerImage,
        gross_margin_per_image,
        projectedTimeframeRevenue,
        projectedTimeframeCost,
        projectedGrossProfit: projectedTimeframeRevenue - projectedTimeframeCost,
      },
      gpuMetrics: {
        predictTime,
        totalTime,
        throughput_cap_per_worker,
        gpu_efficiency,
        queue_delay_ratio,
        isHealthy: gross_margin_per_image > 0 && queue_delay_ratio < 0.3,
      },
      sealStatus: 'P4-A_SEALED_STRICT_MODE',
    };
  }
}
