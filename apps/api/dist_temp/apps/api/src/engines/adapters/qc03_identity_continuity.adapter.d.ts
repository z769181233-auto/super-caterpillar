import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { QcBaseEngine } from '../base/qc_base.engine';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export declare class QC03IdentityContinuityAdapter extends QcBaseEngine implements EngineAdapter {
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService);
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    protected processLogic(payload: any, input: EngineInvokeInput): Promise<{
        status: 'PASS' | 'FAIL' | 'WARN';
        reportUrl?: string;
        meta?: any;
        metrics?: any;
    }>;
}
