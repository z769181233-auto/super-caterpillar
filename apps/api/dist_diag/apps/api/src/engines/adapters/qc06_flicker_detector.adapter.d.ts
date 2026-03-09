import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class QC06FlickerDetectorAdapter implements EngineAdapter {
    private readonly redis;
    private readonly audit;
    private readonly cost;
    readonly name = "qc06_flicker_detector";
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
