import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class Ce14NarrativeClimaxAdapter extends NlpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('ce14_narrative_climax', new NlpCache(redis), audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的高潮识别逻辑 (REAL-STUB)
   */
  protected async processLogic(payload: any, input: EngineInvokeInput): Promise<any> {
    if (process.env.NODE_ENV === 'production' && process.env.GATE_MODE !== '1') {
      throw new Error(`[ENGINE_UNAVAILABLE] CE14 Narrative Climax implementation required.`);
    }
    this.logger.warn(`CE14 Climax running in non-prod mode. No REAL implementation bound.`);
    throw new Error('[STUB_ERROR] CE14 Narrative Climax is a STUB; real implementation missing.');
  }
}
