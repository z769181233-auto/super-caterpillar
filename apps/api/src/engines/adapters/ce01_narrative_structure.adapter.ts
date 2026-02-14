import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CE01NarrativeStructureAdapter extends NlpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    // We instantiate NlpCache here as it's a lightweight wrapper
    super('ce01_narrative_structure', new NlpCache(redis), audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的叙事结构分析逻辑 (REAL-STUB)
   */
  protected async processLogic(payload: any): Promise<any> {
    const text = payload.text || '';
    const beats: string[] = [];

    if (text.toLowerCase().includes('once upon a time') || text.toLowerCase().includes('deep in')) {
      beats.push('SETTING_ESTABLISHED');
    }
    if (text.includes('!') || text.toLowerCase().includes('suddenly')) {
      beats.push('INCITING_INCIDENT_PROBABLE');
    }
    if (text.length > 100) {
      beats.push('NARRATIVE_EXPANSION');
    }

    return {
      beats,
      structure_type: beats.length > 2 ? 'COMPLEX' : 'SIMPLE',
      confidence: 0.85,
    };
  }
}
