import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from 'database';

const ALLOWED_BILLING_UNITS = new Set(['job', 'tokens', 'seconds', 'frames']);

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

  constructor(private readonly prisma: PrismaService) {}

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

    // 验证数量
    if (!Number.isFinite(e.quantity) || e.quantity <= 0) {
      throw new Error(`INVALID_QUANTITY=${e.quantity}`);
    }

    const attemptNum = e.attempt ?? 0;

    // P1-1 商业级基线：强制校验 Job 状态，仅 SUCCEEDED 允许计费
    const job = await this.prisma.shotJob.findUnique({
      where: { id: e.jobId },
      select: { id: true, status: true, attempts: true, type: true },
    });

    if (!job) {
      throw new Error(`BILLING_REJECTED_JOB_NOT_FOUND jobId=${e.jobId}`);
    }

    // ✅ 仅成功任务允许计费
    if (job.status !== 'SUCCEEDED') {
      throw new Error(`BILLING_REJECTED_JOB_NOT_SUCCEEDED status=${job.status} jobId=${e.jobId}`);
    }

    // 验证 attempt 合法性：不允许 attempt > job.attempts 或 < 0
    if (!Number.isInteger(attemptNum) || attemptNum < 0) {
      throw new Error(`INVALID_ATTEMPT=${attemptNum}`);
    }
    if (attemptNum > (job.attempts ?? 0)) {
      throw new Error(
        `BILLING_REJECTED_ATTEMPT_GT_JOB attempts=${job.attempts} attempt=${attemptNum} jobId=${e.jobId}`
      );
    }

    const data: Prisma.CostLedgerCreateInput = {
      user: { connect: { id: e.userId } },
      project: { connect: { id: e.projectId } },
      jobId: e.jobId,
      jobType: e.jobType,
      engineKey: e.engineKey,
      attempt: attemptNum,
      costAmount: e.costAmount,
      currency: 'USD', // ✅ SSOT 统一
      billingUnit: e.billingUnit,
      quantity: e.quantity,
      metadata: e.metadata ?? undefined,
    };

    // ✅ 幂等: 同一 (jobId, attempt) 只记一次
    try {
      return await this.prisma.costLedger.create({ data });
    } catch (err: any) {
      // Prisma unique conflict: P2002
      if (err?.code === 'P2002') {
        this.logger.warn(`COST_LEDGER_DEDUPED=1 jobId=${e.jobId} attempt=${attemptNum}`);
        // 返回既有记录作为幂等成功
        const existing = await this.prisma.costLedger.findUnique({
          where: { jobId_attempt: { jobId: e.jobId, attempt: attemptNum } },
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
    return this.prisma.costLedger.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取项目成本汇总
   */
  async getProjectCostSummary(projectId: string) {
    const rows = await this.prisma.costLedger.findMany({
      where: { projectId },
    });
    const total = rows.reduce((s, r) => s + r.costAmount, 0);

    return {
      projectId,
      total,
      currency: 'USD',
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
        const type = cost.jobType || 'UNKNOWN';
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0 };
        }
        acc[type].count++;
        acc[type].total += cost.costAmount;
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    return byType;
  }
}
