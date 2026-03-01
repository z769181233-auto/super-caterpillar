import { Injectable, Logger, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DistributedLock } from '../common/distributed-lock';
import Redis from 'ioredis';

/**
 * A5 增强：Billing Service with 分布式锁
 *
 * 防止并发扣费竞态条件：
 * 1. Redis 分布式锁（组织级别）
 * 2. PostgreSQL 事务
 * 3. 数据库 CHECK 约束
 *
 * 三层防护确保资金安全
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private distributedLock: DistributedLock | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis | null
  ) {
    // 初始化分布式锁（如果Redis可用）
    if (this.redis) {
      this.distributedLock = new DistributedLock({
        redis: this.redis,
        defaultTTL: 5000, // 5秒默认锁定时间
        maxRetries: 3,
        retryDelay: 100,
      });
      this.logger.log('[A5] Distributed lock initialized for billing');
    } else {
      this.logger.warn('[A5] Redis not available, distributed lock disabled (degraded mode)');
    }
  }

  /**
   * Get available credits for an organization.
   */
  async getCredits(
    userId: string,
    organizationId: string
  ): Promise<{ remaining: number; total: number }> {
    if (!organizationId) {
      throw new ForbiddenException('Organization ID is required for billing check');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { credits: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const credits = org.credits || 0;
    return { remaining: credits, total: credits };
  }

  /**
   * A5 增强：Atomically consume credits with distributed lock
   *
   * 三层防护：
   * 1. Redis 分布式锁（防止跨进程并发）
   * 2. PostgreSQL 事务（ACID保证）
   * 3. Database CHECK约束（最终防线）
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

    if (!organizationId) throw new ForbiddenException('Organization ID is required');

    console.error(
      `[BILLING_DEBUG] consumeCredits orgId=${organizationId} amount=${amount} type=${type}`
    );

    // A5 增强：分布式锁保护（如果可用）
    if (this.distributedLock) {
      const lockKey = `billing:consume:${organizationId}`;
      return this.distributedLock.withLock(
        lockKey,
        async () => {
          return this._doConsumeCredits(projectId, userId, organizationId, amount, type, traceId);
        },
        10000
      ); // 10秒锁定时间
    } else {
      // 降级模式：仅依赖数据库事务
      this.logger.warn('[A5] Executing without distributed lock (degraded mode)');
      return this._doConsumeCredits(projectId, userId, organizationId, amount, type, traceId);
    }
  }

  /**
   * 内部扣费逻辑（受分布式锁保护）
   */
  private async _doConsumeCredits(
    projectId: string,
    userId: string,
    organizationId: string,
    amount: number,
    type: string,
    traceId?: string
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Atomic Update: Decrement credits ONLY if sufficient
      // A5 增强：配合数据库CHECK约束，双重保护
      const result = await tx.organization.updateMany({
        where: {
          id: organizationId,
          credits: { gte: amount },
        },
        data: {
          credits: { decrement: amount },
        },
      });

      if (result.count === 0) {
        // 更新失败，检查原因
        const org = await tx.organization.findUnique({ where: { id: organizationId } });

        if (!org) throw new NotFoundException('Organization not found');

        this.logger.warn(
          `[A5] Insufficient credits for Org ${organizationId}. Required: ${amount}, Available: ${org.credits}`
        );
        throw new ForbiddenException(
          `Insufficient credits to start job. Required: ${amount} credits. (Available: ${org.credits})`
        );
      }

      // 2. Record Billing Event (Ledger)
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

      // 3. Audit Log
      const updatedOrg = await tx.organization.findUnique({ where: { id: organizationId } });
      const newCredits = updatedOrg?.credits ?? 0;
      const details = {
        amount,
        type,
        newCredits,
        lockProtected: this.distributedLock !== null, // A5: 记录是否使用分布式锁
      };

      const payload = {
        action: 'BILLING_CONSUME',
        resourceType: 'job',
        resourceId: traceId,
        orgId: organizationId,
        details: JSON.parse(JSON.stringify(details)),
        timestamp: new Date().toISOString(),
      };

      await tx.auditLog.create({
        data: {
          userId: finalUserId,
          orgId: organizationId,
          action: 'BILLING_CONSUME',
          resourceType: 'job',
          resourceId: traceId,
          details: details,
          timestamp: new Date(),
          payload: payload,
        },
      });

      return true;
    });
  }

  async checkQuota(userId: string, organizationId: string, required: number = 1): Promise<boolean> {
    try {
      const { remaining } = await this.getCredits(userId, organizationId);
      return remaining >= required;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
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
}
