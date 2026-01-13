import { calculateTotalCredits, getModelPrice } from '@scu/billing/model-price-table';
import { costLedgerRecordsTotal } from '@scu/observability';
import type { EngineBillingUsage } from '@scu/engines-ce06';
import { ApiClient } from '../api-client';
import * as util from 'util';

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
   * 记录计费（通用入口 - 商业级闭环）
   * P0 Hotfix: 支持 0-cost 记账与多维用量 (tokens/seconds)
   */
  async recordEngineBilling(params: {
    runId?: string; // Optional (if not available, fallback to jobId/traceId logic)
    jobId: string;
    jobType: string;
    traceId: string;
    projectId: string;
    userId: string;
    orgId: string;
    attempt?: number;
    billingUsage?: EngineBillingUsage; // Optional if only using seconds
    gpuSeconds?: number;
    cpuSeconds?: number;
    cost?: number; // Explicit cost override (e.g. from PricingRouter)
    engineKey: string;
    idempotencyKey?: string; // Optional override
  }): Promise<void> {
    const {
      jobId, jobType, projectId, userId, billingUsage,
      gpuSeconds = 0, cpuSeconds = 0, cost,
      engineKey
    } = params;

    // Validate Usage: at least one metric must be present
    const totalTokens = billingUsage?.totalTokens || 0;
    const hasUsage = totalTokens > 0 || gpuSeconds > 0 || cpuSeconds > 0;

    // P0 Hotfix: Allow cost=0 if explicitly provided (for closed-loop audit)
    // or if we have usage but calculated cost is 0.
    // However, if NO usage and NO cost provided, we skip.
    if (!hasUsage && cost === undefined) {
      process.stdout.write(
        util.format(`[BILLING_SKIP] No usage (tokens/gpu/cpu) and no explicit cost for ${jobId}`) + '\n'
      );
      return;
    }

    // Determine Final Cost
    let finalCost = 0;
    if (cost !== undefined) {
      finalCost = cost;
    } else if (totalTokens > 0 && billingUsage?.model) {
      finalCost = calculateTotalCredits(totalTokens, billingUsage.model);
    }
    // TODO: Add pricing logic for gpuSeconds/cpuSeconds if not provided in 'cost'
    // For now, we assume caller or PricingRouter provides 'cost' for time-based metrics

    try {
      // Idempotency Key Strategy: runId:engineKey or jobId (fallback)
      const idempotencyKey = params.idempotencyKey ||
        (params.runId ? `${params.runId}:${engineKey}` : `${jobId}:${engineKey}`);

      await this.apiClient.postCostEvent({
        userId,
        projectId,
        jobId,
        jobType,
        attempt: params.attempt,
        costAmount: finalCost,
        currency: 'USD', // Standardized for now
        billingUnit: totalTokens > 0 ? 'tokens' : (gpuSeconds > 0 ? 'gpu_seconds' : 'cpu_seconds'),
        quantity: totalTokens > 0 ? totalTokens : (gpuSeconds > 0 ? gpuSeconds : cpuSeconds),
        metadata: {
          engineKey,
          traceId: params.traceId,
          runId: params.runId,
          gpuSeconds,
          cpuSeconds,
          totalTokens,
          model: billingUsage?.model || 'unknown',
          idempotencyKey // Pass to API for deduplication
        },
      });

      process.stdout.write(
        util.format(
          `[CostLedger] ✅ Event sent: type=${jobType}, cost=${finalCost.toFixed(4)}, engine=${engineKey}`
        ) + '\n'
      );
      costLedgerRecordsTotal.inc({ status: 'success' });
    } catch (error: any) {
      process.stderr.write(util.format(`[CostLedger] ❌ Event failed: ${error.message}`) + '\n');
      costLedgerRecordsTotal.inc({ status: 'failed' });
    }
  }

  /**
   * Deprecated/Wrapper methods for backward compatibility
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
    // Map to new generic method
    return this.recordEngineBilling({
      ...params,
      engineKey: 'generic', // Default fallback
    });
  }

  async recordCE06Billing(params: any) {
    // P0 Hotfix: Use correct engineKey instead of 'generic'
    return this.recordEngineBilling({
      ...params,
      engineKey: params.engineKey || 'ce06_novel_parsing',
    });
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
