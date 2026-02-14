import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CE05ConflictDetectorAdapter extends NlpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('ce05_conflict_detector', new NlpCache(redis), audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的冲突检测逻辑 (REAL-STUB)
   */
  protected async processLogic(payload: any): Promise<any> {
    const text = payload.text || '';
    const conflicts: string[] = [];

    const keywords = ['shouted', 'argued', 'hated', 'slapped', 'refused', 'but', 'however'];
    for (const kw of keywords) {
      if (text.toLowerCase().includes(kw)) {
        conflicts.push(`KEYWORD_MATCH:${kw.toUpperCase()}`);
      }
    }

    return {
      conflict_detected: conflicts.length > 0,
      conflict_points: conflicts,
      intensity: Math.min(conflicts.length * 0.2, 1.0),
      meta: { implementation: 'ce05_stub_v1' },
    };
  }
}
