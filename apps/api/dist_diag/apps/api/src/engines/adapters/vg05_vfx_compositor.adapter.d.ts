import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class VG05VFXCompositorAdapter extends VgBaseEngine {
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected processLogic(payload: any): Promise<any>;
}
