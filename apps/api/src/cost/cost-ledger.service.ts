import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import type { Prisma } from 'database';

const ALLOWED_BILLING_UNITS = new Set([
  'job',
  'tokens',
  'seconds',
  'frames',
  'gpu_seconds',
  'cpu_seconds',
]);

export interface RecordCostEventParams {
  userId: string;
  projectId: string;
  jobId: string;
  jobType: string;
  engineKey?: string;
  attempt?: number; // ✅ P1-1: 支持按试次记录
  costAmount: number;
  currency?: string;
  billingUnit: string;
  quantity: number;
  metadata?: any;
}

@Injectable()
export class CostLedgerService {
  private readonly logger = new Logger(CostLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService
  ) { }

  /**
   * 从Worker事件记录成本到账本
   * 幂等: 同一 (jobId, attempt) only 记一次
   * SSOT: 仅由 API 调用, Worker 通过事件触发
   */
  async recordFromEvent(e: RecordCostEventParams) {
    // 验证 billingUnit 白名单
    if (!ALLOWED_BILLING_UNITS.has(e.billingUnit)) {
      throw new Error(`INVALID_BILLING_UNIT=${e.billingUnit}`);
    }

    // 验证金额
    if (!Number.isFinite(e.costAmount) || e.costAmount < 0) {
      throw new Error(`INVALID_COST_AMOUNT=${e.costAmount}`);
    }

    const attemptNum = e.attempt ?? 0;

    // P1-1 商业级基线：强制校验 Job 状态
    const job = await this.prisma.shotJob.findUnique({
      where: { id: e.jobId },
      select: { id: true, status: true, attempts: true, type: true, organizationId: true, traceId: true },
    });

    if (!job) {
      throw new Error(`BILLING_REJECTED_JOB_NOT_FOUND jobId=${e.jobId}`);
    }

    // ✅ 仅成功或运行中任务允许计费
    if (job.status !== 'SUCCEEDED' && job.status !== 'RUNNING') {
      throw new Error(`BILLING_REJECTED_JOB_NOT_SUCCEEDED status=${job.status} jobId=${e.jobId}`);
    }

    // V3.0 Align: Mapping to BillingLedger Schema
    const ledgerData: Prisma.BillingLedgerCreateInput = {
      tenantId: job.organizationId || e.userId,
      traceId: job.traceId || e.jobId,
      itemType: e.jobType,
      itemId: e.jobId,
      chargeCode: e.engineKey || e.jobType,
      amount: Math.round(e.costAmount * 100), // Convert to base units (e.g. cents or credits * 100)
      currency: 'CREDIT',
      status: 'POSTED',
      evidenceRef: `job:${e.jobId}:${attemptNum}`,
    };

    // ✅ 幂等: 基于 BillingLedger 的唯一索引 (tenantId, traceId, itemType, itemId, chargeCode)
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create Billing Ledger Record (V3.0 SSOT)
        const ledger = await tx.billingLedger.create({ data: ledgerData });

        // 2. Consume Credits (Atomically)
        await this.billingService.consumeCredits(
          e.projectId,
          e.userId,
          job.organizationId || 'missing',
          e.costAmount,
          `BILLING_V3:${e.jobType}`,
          e.jobId
        );

        return ledger;
      });
    } catch (err: any) {
      // Prisma unique conflict: P2002
      if (err?.code === 'P2002') {
        this.logger.warn(`BILLING_LEDGER_DEDUPED=1 jobId=${e.jobId} traceId=${ledgerData.traceId}`);
        const existing = await this.prisma.billingLedger.findFirst({
          where: {
            tenantId: ledgerData.tenantId,
            traceId: ledgerData.traceId,
            itemId: ledgerData.itemId,
            chargeCode: ledgerData.chargeCode
          },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * 查询项目的所有成本记录
   */
  async getProjectCosts(projectId: string) {
    return this.prisma.billingLedger.findMany({
      where: { tenantId: projectId }, // Assuming tenantId maps to org/project in this context
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取项目成本汇总
   */
  async getProjectCostSummary(projectId: string) {
    const rows = await this.prisma.billingLedger.findMany({
      where: { tenantId: projectId },
    });
    const total = rows.reduce((s, r) => s + (r.amount / 100), 0);

    return {
      projectId,
      total,
      currency: 'CREDIT',
      itemCount: rows.length,
    };
  }

  /**
   * 按Job类型分组统计
   */
  async getCostByJobType(projectId: string) {
    const costs = await this.getProjectCosts(projectId);

    const byType = costs.reduce(
      (acc, cost) => {
        const type = cost.itemType || 'UNKNOWN';
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0 };
        }
        acc[type].count++;
        acc[type].total += (cost.amount / 100);
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    return byType;
  }
}
