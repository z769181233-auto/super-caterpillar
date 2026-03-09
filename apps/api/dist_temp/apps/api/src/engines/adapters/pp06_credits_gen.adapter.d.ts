import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export declare class PP06CreditsGenAdapter implements EngineAdapter {
    private readonly redis;
    private readonly audit;
    private readonly cost;
    readonly name = "pp06_credits_gen";
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
