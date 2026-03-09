import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export declare class CharacterGenAdapter implements EngineAdapter {
    private readonly redisService;
    private readonly auditService;
    private readonly costLedgerService;
    readonly name = "character_gen";
    private readonly logger;
    constructor(redisService: RedisService, auditService: AuditService, costLedgerService: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private generateDeterministicStub;
    private auditHelper;
    private recordCost;
}
