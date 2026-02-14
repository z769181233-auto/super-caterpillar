import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CE13PacingAnalyzerAdapter extends NlpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('ce13_pacing_analyzer', new NlpCache(redis), audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的角色进度分析逻辑 (REAL-STUB)
   */
  protected async processLogic(payload: any): Promise<any> {
    const text = payload.text || '';
    const sentenceCount = text.split(/[.!?]/).filter((s: string) => s.trim().length > 0).length;
    const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
    const avgWordPerSentence = wordCount / (sentenceCount || 1);

    let pacing = 'MODERATE';
    if (avgWordPerSentence < 8) pacing = 'FAST';
    if (avgWordPerSentence > 20) pacing = 'SLOW';

    return {
      pacing,
      metrics: {
        avg_word_per_sentence: avgWordPerSentence,
        sentence_count: sentenceCount,
        word_count: wordCount,
      },
      tension_level: pacing === 'FAST' ? 'HIGH' : pacing === 'SLOW' ? 'LOW' : 'MEDIUM',
    };
  }
}
