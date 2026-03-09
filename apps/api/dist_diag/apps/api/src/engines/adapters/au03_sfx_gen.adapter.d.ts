import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class AU03SFXGenAdapter extends AuBaseEngine {
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected processLogic(payload: any): Promise<any>;
}
