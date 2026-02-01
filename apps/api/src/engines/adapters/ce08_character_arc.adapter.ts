import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

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
     * 实现具体的角色弧光分析逻辑 (REAL-STUB)
     */
    protected async processLogic(payload: any): Promise<any> {
        const text = payload.text || '';
        const traits: string[] = [];

        if (payload.characterName) {
            if (text.toLowerCase().includes('decided') || text.toLowerCase().includes('realized')) {
                traits.push('INTERNAL_GROWTH');
            }
            if (text.toLowerCase().includes('fought') || text.toLowerCase().includes('won') || text.toLowerCase().includes('lost')) {
                traits.push('EXTERNAL_ACTION');
            }
        }

        return {
            character: payload.characterName || 'unknown',
            progression: traits,
            arc_status: traits.length > 0 ? 'DEVELOPING' : 'STATIC'
        };
    }
}
