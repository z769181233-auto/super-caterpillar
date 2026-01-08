import type { PrismaClient } from 'database';
import { calculateTotalCredits, getModelPrice } from '@scu/billing/model-price-table';
import type { EngineBillingUsage } from '@scu/engines/ce06';

/**
 * CostLedger 服务
 * 
 * Stage-3-B: CE06 Credits 计费闭环
 * - 幂等写入：依赖 unique(jobId, jobType)
 * - SSOT 价格表：packages/billing/model-price-table.ts
 */

export class CostLedgerService {
    constructor(private prisma: PrismaClient) { }

    /**
     * 记录 CE06 计费（幂等）
     * 
     * @throws Error 如果 billing_usage 缺失或无效
     */
    async recordCE06Billing(params: {
        jobId: string;
        jobType: string;
        traceId: string;
        projectId: string;
        userId: string;
        orgId: string;
        engineKey?: string;
        billingUsage: EngineBillingUsage;
    }): Promise<void> {
        const { jobId, jobType, traceId, projectId, userId, orgId, engineKey, billingUsage } = params;

        // 强制校验
        if (!billingUsage || billingUsage.totalTokens <= 0) {
            throw new Error('[BILLING_ERROR] billing_usage missing or totalTokens<=0');
        }

        // 计算 Credits（从 SSOT 价格表）
        const unitCostCredits = getModelPrice(billingUsage.model);  // Credits per 1k tokens
        const totalCredits = calculateTotalCredits(billingUsage.totalTokens, billingUsage.model);

        try {
            await this.prisma.costLedger.create({
                data: {
                    // 主键与关联
                    jobId,
                    jobType,
                    projectId,
                    userId: userId || null,

                    // 追踪与隔离
                    traceId,
                    orgId,
                    costType: 'AI_PARSE',

                    // Credits 计费字段（新增）
                    unitCostCredits,          // Credits per 1k tokens
                    totalCredits,             // 总 Credits
                    modelName: billingUsage.model,

                    // 兼容字段（保留，用于向后兼容）
                    unitCost: unitCostCredits / 1000,  // Credits per token
                    quantity: billingUsage.totalTokens,
                    totalCost: totalCredits,

                    // 元数据
                    metadata: {
                        promptTokens: billingUsage.promptTokens,
                        completionTokens: billingUsage.completionTokens,
                        totalTokens: billingUsage.totalTokens,
                        model: billingUsage.model,
                    },
                } as any,
            });

            console.log(`[CostLedger] ✅ Recorded: jobId=${jobId}, credits=${totalCredits.toFixed(4)}, tokens=${billingUsage.totalTokens}, model=${billingUsage.model}`);
        } catch (error: any) {
            // 幂等性：重复记录静默忽略
            if (error?.code === 'P2002') {
                console.warn(`[CostLedger] ⚠️  Duplicate skipped (idempotent): jobId=${jobId}, jobType=${jobType}`);
                return;
            }

            // 其他错误抛出
            throw new Error(`[CostLedger] ❌ Failed to record: ${error.message}`);
        }
    }

    /**
     * 记录 CE03 计费 (Stage-3-C)
     */
    async recordCE03Billing(params: {
        jobId: string;
        jobType: string;
        traceId: string;
        projectId: string;
        userId: string;
        orgId: string;
        engineKey?: string;
        billingUsage: EngineBillingUsage;
    }): Promise<void> {
        // 复用 CE06 逻辑，但 costType 为 'AI_INFERENCE' (或保持 AI_PARSE 统一? Spec says E03_DENSITY_FAIL cost is per shot/tokens)
        // Spec: CE03 Cost: 1 Shot ($0.005) or tokens.
        // Replay Engine uses tokens. Real Engine uses tokens.
        // Let's us tokens for consistency with CE06 implementation.

        return this.recordCE06Billing({
            ...params,
            // override specific fields if needed
        });
    }
}
