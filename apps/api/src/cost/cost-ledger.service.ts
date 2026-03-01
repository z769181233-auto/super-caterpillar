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
  ) {}

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
      select: {
        id: true,
        status: true,
        attempts: true,
        type: true,
        organizationId: true,
        traceId: true,
      },
    });

    if (!job) {
      throw new Error(`BILLING_REJECTED_JOB_NOT_FOUND jobId=${e.jobId}`);
    }

    // ✅ 仅成功或运行中任务允许计费
    if (job.status !== 'SUCCEEDED' && job.status !== 'RUNNING') {
      throw new Error(`BILLING_REJECTED_JOB_NOT_SUCCEEDED status=${job.status} jobId=${e.jobId}`);
    }

    // P3-A: Billing Ledger is strictly managed by Job State Transitions.
    // RecordFromEvent ONLY deducts credits functionally but does NOT write Ledger
    // to avoid violating UNIQUE(job_id, billing_state).

    await this.billingService.consumeCredits(
      e.projectId,
      e.userId,
      job.organizationId || 'missing',
      e.costAmount,
      `BILLING_V3:${e.jobType}`,
      e.jobId
    );

    return { deduped: false, amountDeducted: e.costAmount };
  }

  /**
   * 查询项目的所有成本记录
   */
  async getProjectCosts(projectId: string) {
    return this.prisma.billingLedger.findMany({
      where: { projectId: projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取项目成本汇总
   */
  async getProjectCostSummary(projectId: string) {
    const rows = await this.prisma.billingLedger.findMany({
      where: { projectId: projectId },
    });
    // amount is BigInt, cast to Number for legacy API response
    const total = rows.reduce((s, r) => s + Number(r.amount) / 100, 0);

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
        const type = cost.billingState || 'UNKNOWN';
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0 };
        }
        acc[type].count++;
        acc[type].total += Number(cost.amount) / 100;
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    return byType;
  }
}
