import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { createHash } from 'crypto';

@Injectable()
export class EmotionAnalysisAdapter implements EngineAdapter {
  public readonly name = 'emotion_analysis';
  private readonly logger = new Logger(EmotionAnalysisAdapter.name);

  private isStubEnabled(): boolean {
    return process.env.ALLOW_ANALYSIS_STUBS === '1';
  }

  constructor(
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly costLedgerService: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === 'emotion_analysis';
  }

  private requireTraceId(value: unknown): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    throw new Error('[EmotionAnalysisAdapter] Missing context.traceId');
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    let traceId: string;
    try {
      traceId = this.requireTraceId(input.context?.traceId);
    } catch (error: any) {
      return {
        status: 'FAILED' as any,
        error: {
          code: 'EMOTION_TRACE_ID_REQUIRED',
          message: error.message,
        },
      };
    }

    if (!this.isStubEnabled()) {
      return {
        status: 'FAILED' as any,
        error: {
          code: 'EMOTION_ANALYSIS_NOT_IMPLEMENTED',
          message: 'EMOTION_ANALYSIS_NOT_IMPLEMENTED: regex stub disabled unless ALLOW_ANALYSIS_STUBS=1',
        },
      };
    }

    const payload = input.payload || {};
    const text = payload.text || '';
    if (!text) {
      return {
        status: 'FAILED' as any,
        error: { code: 'EMO_NO_TEXT', message: 'Missing text input' },
      };
    }

    const inputHash = createHash('sha256').update(text).digest('hex');
    const cacheKey = `emotion:v1:${inputHash}`;

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
    // Keywords: happy/joy -> joy; sad/cry -> sadness; angry/mad -> anger
    const lower = text.toLowerCase();
    let primary = 'neutral';
    const labels = ['neutral'];
    let intensity = 0.5;
    let reasons = ['no_signal_detected'];

    if (lower.match(/(happy|joy|glad|smile)/)) {
      primary = 'joy';
      labels.push('joy');
      intensity = 0.8;
      reasons = ['keyword_match: positive'];
    } else if (lower.match(/(sad|cry|grief|tear)/)) {
      primary = 'sadness';
      labels.push('sadness');
      intensity = 0.7;
      reasons = ['keyword_match: negative'];
    } else if (lower.match(/(angry|mad|furious|rage)/)) {
      primary = 'anger';
      labels.push('anger');
      intensity = 0.9;
      reasons = ['keyword_match: high_intensity'];
    }

    const output = {
      primary,
      labels: [...new Set(labels)],
      intensity,
      reasons,
      meta: { implementation: 'regex_v1' },
    };

    // 3. Save Cache (7 days)
    await this.redisService.setJson(cacheKey, output, 60 * 60 * 24 * 7);

    // 4. Audit & Cost
    await this.auditHelper(input, traceId, 'MISS', 'generated');
    await this.recordCost(input, traceId, 0, { status: 'STUB_GENERATED' });

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
      action: 'EMOTION_ANALYSIS',
      resourceId: resourceId,
      resourceType: 'emotion_result',
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
      jobType: input.jobType || 'EMOTION_ANALYSIS',
      engineKey: this.name,
      costAmount: amount,
      billingUnit: 'job',
      quantity: 1,
      attempt: (input.context as any).attempt || 1,
      metadata: { type: 'emotion_analysis', traceId, ...extra },
    });
  }
}
