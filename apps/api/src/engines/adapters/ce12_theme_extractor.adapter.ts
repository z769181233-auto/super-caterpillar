import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { NlpBaseEngine } from '../nlp/nlp_base';
import { NlpCache } from '../nlp/nlp_cache';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CE12ThemeExtractorAdapter extends NlpBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('ce12_theme_extractor', new NlpCache(redis), audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    /**
     * 实现具体的角色主题提取逻辑 (REAL-STUB)
     */
    protected async processLogic(payload: any): Promise<any> {
        const text = payload.text || '';
        const themes: string[] = [];

        if (text.toLowerCase().includes('love') || text.toLowerCase().includes('heart')) themes.push('LOVE');
        if (text.toLowerCase().includes('war') || text.toLowerCase().includes('battle')) themes.push('CONFLICT');
        if (text.toLowerCase().includes('death') || text.toLowerCase().includes('grave')) themes.push('MORTALITY');
        if (text.toLowerCase().includes('justice') || text.toLowerCase().includes('law')) themes.push('JUSTICE');

        return {
            detected_themes: themes,
            primary_theme: themes[0] || 'GENERAL',
            relevance_score: themes.length > 0 ? 0.9 : 0.1
        };
    }
}
