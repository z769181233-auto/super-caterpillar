import { Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { NlpCache } from './nlp_cache';
export declare abstract class NlpBaseEngine {
    readonly name: string;
    protected readonly cache: NlpCache;
    protected readonly audit: AuditService;
    protected readonly cost: CostLedgerService;
    protected readonly logger: Logger;
    constructor(name: string, cache: NlpCache, audit: AuditService, cost: CostLedgerService);
    supports(engineKey: string): boolean;
    abstract invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    execute(input: EngineInvokeInput, payload: any): Promise<EngineInvokeResult>;
    protected abstract processLogic(payload: any, input: EngineInvokeInput): Promise<any>;
    private auditHelper;
    private recordCost;
}
