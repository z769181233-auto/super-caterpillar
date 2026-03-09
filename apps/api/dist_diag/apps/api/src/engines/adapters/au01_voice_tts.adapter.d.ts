import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { AudioService } from '../../audio/audio.service';
export declare class AU01VoiceTTSAdapter extends AuBaseEngine {
    private readonly audioService;
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService, audioService: AudioService);
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected processLogic(payload: any): Promise<any>;
}
