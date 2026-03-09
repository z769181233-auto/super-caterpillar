import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
export interface RecordCostEventParams {
    userId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey?: string;
    attempt?: number;
    costAmount: number;
    currency?: string;
    billingUnit: string;
    quantity: number;
    metadata?: any;
}
export declare class CostLedgerService {
    private readonly prisma;
    private readonly billingService;
    private readonly logger;
    constructor(prisma: PrismaService, billingService: BillingService);
    recordFromEvent(e: RecordCostEventParams): Promise<{
        deduped: boolean;
        amountDeducted: number;
    }>;
    getProjectCosts(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        jobId: string;
        projectId: string;
        billingState: string;
        amount: bigint;
        idempotencyKey: string;
    }[]>;
    getProjectCostSummary(projectId: string): Promise<{
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
