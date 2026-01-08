import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum BudgetLevel {
    OK = 'OK',
    WARN = 'WARN', // 80%
    BLOCK_HIGH_COST = 'BLOCK_HIGH_COST', // 100%
    BLOCK_ALL_CONSUME = 'BLOCK_ALL_CONSUME', // 120%
}

@Injectable()
export class BudgetService {
    private readonly logger = new Logger(BudgetService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getBudgetStatus(organizationId: string, projectId?: string): Promise<{ ratio: number; level: BudgetLevel }> {
        const startTime = Date.now();
        this.logger.log(`BUDGET_IN orgId=${organizationId}`);

        try {
            // 商业级逻辑：如果传入了 projectId，优先查该项目的成本中心，否则查 Org 的默认成本中心
            // 目前 schema 中 CostCenter 只有 organizationId 关联。
            const costCenter = await this.prisma.costCenter.findFirst({
                where: { organizationId },
                orderBy: { createdAt: 'desc' }
            });

            if (!costCenter) {
                const costMs = Date.now() - startTime;
                this.logger.log(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} result=NO_COST_CENTER`);
                return { ratio: 0, level: BudgetLevel.OK };
            }

            const ratio = costCenter.budget > 0 ? costCenter.currentCost / costCenter.budget : 0;

            let level: BudgetLevel;
            if (ratio >= 1.2) level = BudgetLevel.BLOCK_ALL_CONSUME;
            else if (ratio >= 1.0) level = BudgetLevel.BLOCK_HIGH_COST;
            else if (ratio >= 0.8) level = BudgetLevel.WARN;
            else level = BudgetLevel.OK;

            const costMs = Date.now() - startTime;

            // 超时警告（防卡死硬化）
            if (costMs > 2000) {
                this.logger.warn(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} SLOW_QUERY ratio=${ratio.toFixed(2)} level=${level}`);
            } else {
                this.logger.log(`BUDGET_OUT orgId=${organizationId} costMs=${costMs} ratio=${ratio.toFixed(2)} level=${level}`);
            }

            return { ratio, level };
        } catch (error: any) {
            const costMs = Date.now() - startTime;
            this.logger.error(`BUDGET_ERR orgId=${organizationId} costMs=${costMs} error=${error?.message}`);
            throw error;
        }
    }
}
