import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export declare class StyleTransferReplicateAdapter implements EngineAdapter {
    private readonly redisService;
    private readonly auditService;
    private readonly costLedgerService;
    readonly name = "style_transfer";
    private readonly logger;
    constructor(redisService: RedisService, auditService: AuditService, costLedgerService: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private generateStubFile;
    private auditHelper;
    private recordCost;
}
