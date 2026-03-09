import { Logger } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
export interface PpBaseOutput {
    status: 'PASS' | 'FAIL';
    assetUrl: string;
    meta: {
        source: 'cache' | 'generated';
        implementation: string;
        engine: string;
        cached: boolean;
        [key: string]: any;
    };
    metrics: {
        durationMs: number;
        [key: string]: any;
    };
}
export declare abstract class PpBaseEngine {
    readonly name: string;
    protected readonly redis: RedisService;
    protected readonly audit: AuditService;
    protected readonly cost: CostLedgerService;
    protected readonly logger: Logger;
    constructor(name: string, redis: RedisService, audit: AuditService, cost: CostLedgerService);
    supports(engineKey: string): boolean;
    abstract invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected generateCacheKey(payload: any): string;
    execute(input: EngineInvokeInput, payload: any): Promise<EngineInvokeResult>;
    protected abstract processLogic(payload: any, input: EngineInvokeInput): Promise<{
        assetUrl: string;
        meta?: any;
        metrics?: any;
    }>;
    private auditHelper;
    private recordCost;
}
