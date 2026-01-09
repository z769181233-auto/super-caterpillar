import { calculateTotalCredits, getModelPrice } from '@scu/billing/model-price-table';
import type { EngineBillingUsage } from '@scu/engines/ce06';
import { ApiClient } from '../api-client';

/**
 * CostLedger 服务 (Worker 侧)
 *
 * P1-1: 计费硬化
 * - 转向 ApiClient.postCostEvent 以对齐商业级审计链路
 * - 支持 attempt 试次标识
 * - SSOT 价格表：packages/billing/model-price-table.ts
 */

export class CostLedgerService {
  constructor(private apiClient: ApiClient) { }

  /**
   * 记录计费（通过 API 事件）
   */
  async recordGenericBilling(params: {
    jobId: string;
    jobType: string;
    traceId: string;
    projectId: string;
    userId: string;
    orgId: string;
    attempt?: number;
    billingUsage: EngineBillingUsage;
  }): Promise<void> {
    const { jobId, jobType, projectId, userId, attempt, billingUsage } = params;

    if (!billingUsage || billingUsage.totalTokens <= 0) {
      console.warn('[BILLING_SKIP] billing_usage missing or totalTokens<=0');
      return;
    }

    // 计算 Credits（从 SSOT 价格表）
    const totalCredits = calculateTotalCredits(billingUsage.totalTokens, billingUsage.model);

    try {
      await this.apiClient.postCostEvent({
        userId,
        projectId,
        jobId,
        jobType,
        attempt,
        costAmount: totalCredits,
        currency: 'USD',
        billingUnit: 'tokens',
        quantity: billingUsage.totalTokens,
        metadata: {
          promptTokens: billingUsage.promptTokens,
          completionTokens: billingUsage.completionTokens,
          totalTokens: billingUsage.totalTokens,
          model: billingUsage.model,
          traceId: params.traceId,
        },
      });

      console.log(
        `[CostLedger] ✅ Event sent: jobId=${jobId}, attempt=${attempt}, credits=${totalCredits.toFixed(4)}, model=${billingUsage.model}`
      );
    } catch (error: any) {
      // API 侧已处理 P2002 幂等，此处仅做降级日志
      console.error(`[CostLedger] ❌ Event failed: ${error.message}`);
    }
  }

  async recordCE06Billing(params: any) {
    return this.recordGenericBilling(params);
  }

  async recordCE03Billing(params: any) {
    return this.recordGenericBilling(params);
  }

  async recordCE04Billing(params: any) {
    return this.recordGenericBilling(params);
  }

  async recordShotRenderBilling(params: any) {
    return this.recordGenericBilling(params);
  }
}
