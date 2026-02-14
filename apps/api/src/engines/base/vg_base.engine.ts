import { Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

export interface VgBaseOutput {
  status: 'PASS' | 'FAIL';
  assetUrl: string;
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
 * VG Base Engine
 * 设计初衷：统一视觉生成引擎的 Cache (7d), Audit, Ledger 以及输出规范
 */
export abstract class VgBaseEngine {
  protected readonly logger: Logger;

  constructor(
    public readonly name: string,
    protected readonly redis: RedisService,
    protected readonly audit: AuditService,
    protected readonly cost: CostLedgerService
  ) {
    this.logger = new Logger(`${VgBaseEngine.name}[${name}]`);
  }

  /**
   * 实现 EngineAdapter 接口
   */
  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  /**
   * 实现 EngineAdapter 接口的 invoke (由子类转发到 execute)
   */
  abstract invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;

  /**
   * 生成基于 Payload 的唯一 Key (SHA256)
   */
  protected generateCacheKey(payload: any): string {
    const str = JSON.stringify(payload);
    const hash = createHash('sha256').update(str).digest('hex');
    return `vg_cache:${this.name}:v1:${hash}`;
  }

  /**
   * 核心模板方法
   */
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

    // 2. Main Logic (Implemented by Subclasses)
    try {
      const result = await this.processLogic(payload, input);
      const durationMs = Math.round(performance.now() - t0);

      const finalOutput: VgBaseOutput = {
        status: 'PASS',
        assetUrl: result.assetUrl,
        meta: {
          source: 'generated',
          implementation: 'vg_base_v1',
          engine: this.name,
          cached: false,
          ...result.meta,
        },
        metrics: {
          durationMs,
          ...result.metrics,
        },
      };

      // 3. Save Cache (7 days)
      await this.redis.setJson(cacheKey, finalOutput, 60 * 60 * 24 * 7);

      // 4. Audit & Cost (MISS = 1 unit)
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
        error: { code: 'VG_BASE_ERROR', message: e.message },
      };
    }
  }

  /**
   * 由子类实现具体业务逻辑
   */
  protected abstract processLogic(
    payload: any,
    input: EngineInvokeInput
  ): Promise<{ assetUrl: string; meta?: any; metrics?: any }>;

  private async auditHelper(input: EngineInvokeInput, type: 'HIT' | 'MISS', resourceId: string) {
    await this.audit.log({
      action: `VG_${this.name.toUpperCase()}`,
      resourceId: resourceId,
      resourceType: 'vg_result',
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
      jobType: input.jobType || 'VG_RENDER',
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: { type: 'vg_base', traceId: input.context.traceId || 'unknown', ...extra },
    });
  }
}
