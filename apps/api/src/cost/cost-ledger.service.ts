import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@scu/database';

const ALLOWED_BILLING_UNITS = new Set(['job', 'tokens', 'seconds', 'frames']);

export interface RecordCostEventParams {
    userId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey?: string;
    costAmount: number;
    currency?: string;
    billingUnit: string;
    quantity: number;
    metadata?: any;
}

@Injectable()
export class CostLedgerService {
    private readonly logger = new Logger(CostLedgerService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * 从Worker事件记录成本到账本
     * 幂等:同一(jobId, jobType)only记一次
     * SSOT:仅由API调用,Worker通过事件触发
     */
    async recordFromEvent(e: RecordCostEventParams) {
        // 验证billingUnit白名单
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

        const data: Prisma.CostLedgerCreateInput = {
            user: { connect: { id: e.userId } },
            project: { connect: { id: e.projectId } },
            jobId: e.jobId,
            jobType: e.jobType,
            engineKey: e.engineKey,
            costAmount: e.costAmount,
            currency: 'USD', // ✅ SSOT统一;若有币种系统再扩
            billingUnit: e.billingUnit,
            quantity: e.quantity,
            metadata: e.metadata ?? undefined,
        };

        // ✅ 幂等:同一(jobId, jobType)只记一次
        try {
            return await this.prisma.costLedger.create({ data });
        } catch (err: any) {
            // Prisma unique conflict: P2002
            if (err?.code === 'P2002') {
                this.logger.warn(
                    `COST_LEDGER_DEDUPED=1 jobId=${e.jobId} jobType=${e.jobType}`,
                );
                // 返回既有记录作为幂等成功
                const existing = await this.prisma.costLedger.findFirst({
                    where: { jobId: e.jobId, jobType: e.jobType },
                    orderBy: { createdAt: 'desc' },
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
            {} as Record<string, { count: number; total: number }>,
        );

        return byType;
    }
}
