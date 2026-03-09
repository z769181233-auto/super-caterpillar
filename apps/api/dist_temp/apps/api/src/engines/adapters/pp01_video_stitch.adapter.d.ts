import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PpBaseEngine } from '../base/pp_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class PP01VideoStitchAdapter extends PpBaseEngine {
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected processLogic(payload: any): Promise<any>;
}
