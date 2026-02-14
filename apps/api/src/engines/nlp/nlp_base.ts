import { Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { NlpCache } from './nlp_cache';
import { NlpTokenizer } from './nlp_tokenizer';
import { NlpBaseOutput, validateNlpOutput } from './nlp_output_schema';
import { performance } from 'perf_hooks';

/**
 * NLP Base Engine
 * 设计初衷：以后 CE01/CE05/CE08 等引擎都不再重复写“hash/cache/audit/ledger/输出规范”
 */
export abstract class NlpBaseEngine {
  protected readonly logger: Logger;

  constructor(
    public readonly name: string,
    protected readonly cache: NlpCache,
    protected readonly audit: AuditService,
    protected readonly cost: CostLedgerService
  ) {
    this.logger = new Logger(`${NlpBaseEngine.name}[${name}]`);
  }

  /**
   * 实现 EngineAdapter 接口
   */
  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  /**
   * 实现 EngineAdapter 接口的 invoke
   */
  abstract invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;

  /**
   * 核心模板方法
   */
  async execute(input: EngineInvokeInput, payload: any): Promise<EngineInvokeResult> {
    const t0 = performance.now();
    const cacheKey = this.cache.generateKey(this.name, payload);

    // 1. Cache Check
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      await this.auditHelper(input, 'HIT', cacheKey);
      await this.recordCost(input, 0, { status: 'CACHE_HIT' });
      return {
        status: 'SUCCESS' as any,
        output: { ...cached, meta: { ...cached.meta, source: 'cache', cached: true } },
      };
    }

    // 2. Main Logic (Implemented by Subclasses)
    try {
      const analysis = await this.processLogic(payload, input);
      const chars = NlpTokenizer.countChars(JSON.stringify(payload));
      const tokens = NlpTokenizer.estimateTokens(JSON.stringify(payload));
      const durationMs = Math.round(performance.now() - t0);

      const result: NlpBaseOutput = {
        status: 'PASS',
        analysis,
        metrics: { chars, estimatedTokens: tokens, durationMs },
        meta: {
          source: 'generated',
          implementation: 'nlp_base_v1',
          cached: false,
        },
      };

      // 3. Schema Validate
      if (!validateNlpOutput(result)) {
        throw new Error('Invalid NLP output structure');
      }

      // 4. Save Cache
      await this.cache.set(cacheKey, result);

      // 5. Audit & Cost (MISS = 1 unit)
      await this.auditHelper(input, 'MISS', 'generated');
      await this.recordCost(input, 1);

      return {
        status: 'SUCCESS' as any,
        output: result,
        metrics: { durationMs },
      };
    } catch (e: any) {
      this.logger.error(`Execution failed: ${e.message}`, e.stack);
      return {
        status: 'FAILED' as any,
        error: { code: 'NLP_BASE_ERROR', message: e.message },
      };
    }
  }

  /**
   * 由子类实现具体业务逻辑
   */
  protected abstract processLogic(payload: any, input: EngineInvokeInput): Promise<any>;

  private async auditHelper(input: EngineInvokeInput, type: 'HIT' | 'MISS', resourceId: string) {
    await this.audit.log({
      action: `NLP_${this.name.toUpperCase()}`,
      resourceId: resourceId,
      resourceType: 'nlp_result',
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
      jobType: input.jobType || 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: { type: 'nlp_base', traceId: input.context.traceId || 'unknown', ...extra },
    });
  }
}
