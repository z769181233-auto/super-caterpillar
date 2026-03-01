import { Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

export interface PpBaseOutput {
  status: 'PASS' | 'FAIL';
  assetUrl: string; // Video/Asset file URL
  meta: {
    source: 'cache' | 'generated';
    implementation: string;
    engine: string;
    cached: boolean;
    [key: string]: any;
  };
  metrics: {
    durationMs: number;
    [key: string]: any;
  };
}

/**
 * PP Base Engine (Post-Production)
 * 设计初衷：统一后期合成类引擎的 Cache (7d), Audit, Ledger 以及输出规范
 */
export abstract class PpBaseEngine {
  protected readonly logger: Logger;

  constructor(
    public readonly name: string,
    protected readonly redis: RedisService,
    protected readonly audit: AuditService,
    protected readonly cost: CostLedgerService
  ) {
    this.logger = new Logger(`${PpBaseEngine.name}[${name}]`);
  }

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  abstract invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;

  protected generateCacheKey(payload: any): string {
    const str = JSON.stringify(payload);
    const hash = createHash('sha256').update(str).digest('hex');
    return `pp_cache:${this.name}:v1:${hash}`;
  }

  async execute(input: EngineInvokeInput, payload: any): Promise<EngineInvokeResult> {
    const t0 = performance.now();
    const cacheKey = this.generateCacheKey(payload);

    // 1. Cache Check
    try {
      const cached = await this.redis.getJson(cacheKey);
      if (cached) {
        await this.auditHelper(input, 'HIT', cacheKey);
        await this.recordCost(input, 0, { status: 'CACHE_HIT' });
        return {
          status: 'SUCCESS' as any,
          output: { ...cached, meta: { ...cached.meta, source: 'cache', cached: true } },
        };
      }
    } catch (e: any) {
      this.logger.warn(`Cache lookup failed: ${e.message}`);
    }

    // 2. Main Logic
    try {
      const result = await this.processLogic(payload, input);
      const durationMs = Math.round(performance.now() - t0);

      const finalOutput: PpBaseOutput = {
        status: 'PASS',
        assetUrl: result.assetUrl,
        meta: {
          source: 'generated',
          implementation: 'pp_base_v1',
          engine: this.name,
          cached: false,
          ...result.meta,
        },
        metrics: {
          durationMs,
          ...result.metrics,
        },
      };

      await this.redis.setJson(cacheKey, finalOutput, 60 * 60 * 24 * 7);
      await this.auditHelper(input, 'MISS', 'generated');
      await this.recordCost(input, 1);

      return {
        status: 'SUCCESS' as any,
        output: finalOutput,
        metrics: { durationMs },
      };
    } catch (e: any) {
      this.logger.error(`Execution failed: ${e.message}`, e.stack);
      return {
        status: 'FAILED' as any,
        error: { code: 'PP_BASE_ERROR', message: e.message },
      };
    }
  }

  protected abstract processLogic(
    payload: any,
    input: EngineInvokeInput
  ): Promise<{ assetUrl: string; meta?: any; metrics?: any }>;

  private async auditHelper(input: EngineInvokeInput, type: 'HIT' | 'MISS', resourceId: string) {
    await this.audit.log({
      action: `PP_${this.name.toUpperCase()}`,
      resourceId: resourceId,
      resourceType: 'pp_result',
      traceId: input.context.traceId || 'unknown',
      details: {
        projectId: input.context.projectId,
        userId: input.context.userId,
        cache: type,
        engine: this.name,
      },
      userId: input.context.userId || 'system',
      organizationId: input.context.organizationId,
    });
  }

  private async recordCost(input: EngineInvokeInput, amount: number, extra: any = {}) {
    await this.cost.recordFromEvent({
      userId: input.context.userId || 'system',
      projectId: input.context.projectId || '',
      jobId: input.context.jobId,
      jobType: input.jobType || 'PP_RENDER',
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: { type: 'pp_base', traceId: input.context.traceId || 'unknown', ...extra },
    });
  }
}
