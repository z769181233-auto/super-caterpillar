import { Injectable, Inject, Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { ce08RealEngine } from '@scu/engines-ce08';

@Injectable()
export class CE08CharacterArcAdapter extends NlpBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('ce08_character_arc', new NlpCache(redis), audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 实现具体的角色弧光分析逻辑 - 升级为 AI 驱动
   */
  protected async processLogic(payload: any): Promise<any> {
    const text = payload.text || payload.structured_text || '';
    const characterName = payload.characterName || 'Unknown';

    // 调用 AI 引擎分析角色弧光
    const result = await ce08RealEngine.run({
      character_name: characterName,
      scenario_text: text,
      previous_state: payload.previousState,
    }) as any;

    return {
      character: result.character_name || 'UNKNOWN',
      archetype: result.archetype || 'UNKNOWN',
      state: result.current_state || 'UNKNOWN',
      markers: result.progression_markers || ['STATIC'],
      arc_status: result.arc_status || 'UNKNOWN',
      ai_description: result.description || 'UNKNOWN',
      meta: {
        engine: result.audit_trail?.engine_version || 'truth_v1',
      },
    };
  }
}
