import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class CE15MultiCharSceneAdapter implements EngineAdapter {
    private readonly redis;
    private readonly audit;
    private readonly cost;
    readonly name = "ce15_multi_char_scene";
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private processLogic;
}
