import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';

@Injectable()
export class DialogueOptimizationAdapter implements EngineAdapter {
  public readonly name = 'dialogue_optimization';
  private readonly logger = new Logger(DialogueOptimizationAdapter.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly costLedgerService: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === 'dialogue_optimization';
  }

  private requireTraceId(value: unknown): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    throw new Error('[DialogueOptimizationAdapter] Missing context.traceId');
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    let traceId: string;
    try {
      traceId = this.requireTraceId(input.context?.traceId);
    } catch (error: any) {
      return {
        status: 'FAILED' as any,
        error: {
          code: 'DIALOGUE_TRACE_ID_REQUIRED',
          message: error.message,
        },
      };
    }

    const payload = input.payload || {};
    const dialogue = payload.dialogue || '';
    const persona = payload.persona || 'neutral';

    if (!dialogue) {
      return {
        status: 'FAILED' as any,
        error: { code: 'DIA_NO_TEXT', message: 'Missing dialogue input' },
      };
    }

    const inputHash = createHash('sha256')
      .update(dialogue + persona)
      .digest('hex');
    const cacheKey = `dialogue:v1:${inputHash}`;

    // 1. Cache Check
    try {
      const cached = await this.redisService.getJson(cacheKey);
      if (cached) {
        await this.auditHelper(input, traceId, 'HIT', cacheKey);
        await this.recordCost(input, traceId, 0, { status: 'CACHE_HIT' });
        return {
          status: 'SUCCESS' as any,
          output: { ...cached, source: 'cache', meta: { cached: true } },
        };
      }
    } catch (e) {
      this.logger.warn(`Cache read error: ${e}`);
    }

    // 2. Deterministic Stub Logic
    let optimized = dialogue;
    const ooc_flags: string[] = [];
    const rules_applied: string[] = [];

    // Rule: OOC Check
    // If persona is 'polite' and dialogue contains rude words
    if (persona === 'polite' && dialogue.toLowerCase().match(/(shutup|shut up|idiot)/)) {
      ooc_flags.push('RUDE_DETECTED');
    }

    // Rule: Optimization (Grammar/Style)
    if (dialogue.match(/\bgonna\b/i)) {
      optimized = optimized.replace(/\bgonna\b/gi, 'going to');
      rules_applied.push('expand_contraction');
    }
    if (dialogue.match(/\bwanna\b/i)) {
      optimized = optimized.replace(/\bwanna\b/gi, 'want to');
      rules_applied.push('expand_contraction');
    }

    const diff_count = rules_applied.length;

    const output = {
      optimized,
      ooc_flags,
      rules_applied,
      diff_summary: { count: diff_count },
      meta: { implementation: 'rule_engine_v1', persona },
    };

    // 3. Save Cache (7 days)
    await this.redisService.setJson(cacheKey, output, 60 * 60 * 24 * 7);

    // 4. Audit & Cost (MISS = 1)
    await this.auditHelper(input, traceId, 'MISS', 'generated');
    await this.recordCost(input, traceId, 1);

    return {
      status: 'SUCCESS' as any,
      output: { ...output, source: 'generated' },
    };
  }

  private async auditHelper(
    input: EngineInvokeInput,
    traceId: string,
    type: 'HIT' | 'MISS',
    resourceId: string
  ) {
    await this.auditService.log({
      action: 'DIALOGUE_OPTIMIZATION',
      resourceId: resourceId,
      resourceType: 'dialogue_result',
      details: {
        projectId: input.context.projectId,
        userId: input.context.userId || 'system',
        cache: type,
        traceId,
      },
    });
  }

  private async recordCost(
    input: EngineInvokeInput,
    traceId: string,
    amount: number,
    extra: any = {}
  ) {
    await this.costLedgerService.recordFromEvent({
      userId: input.context.userId || 'system',
      projectId: input.context.projectId || '',
      jobId: input.context.jobId,
      jobType: input.jobType || 'NOVEL_ANALYSIS', // Using NOVEL_ANALYSIS as closest valid enum
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: {
        type: 'dialogue_optimization',
        traceId,
        ...extra,
      },
    });
  }
}
