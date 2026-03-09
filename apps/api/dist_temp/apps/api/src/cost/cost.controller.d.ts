import { CostLedgerService, RecordCostEventParams } from './cost-ledger.service';
declare class CostEventDto implements RecordCostEventParams {
    userId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey?: string;
    attempt?: number;
    costAmount: number;
    currency: string;
    billingUnit: string;
    quantity: number;
    metadata?: any;
}
export declare class InternalEventsController {
    private readonly costLedger;
    constructor(costLedger: CostLedgerService);
    hmacPing(): {
        ok: boolean;
        ts: number;
        message: string;
    };
    recordCost(dto: CostEventDto): Promise<{
        ok: boolean;
        deduplicated: boolean;
        amountDeducted: number;
    }>;
}
export declare class CostController {
    private readonly costLedgerService;
    constructor(costLedgerService: CostLedgerService);
    getProjectCosts(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        jobId: string;
        projectId: string;
        billingState: string;
        amount: bigint;
        idempotencyKey: string;
    }[]>;
    getCostSummary(projectId: string): Promise<{
        projectId: string;
        total: number;
        currency: string;
        itemCount: number;
    }>;
    getCostByJobType(projectId: string): Promise<Record<string, {
        count: number;
        total: number;
    }>>;
}
export {};
