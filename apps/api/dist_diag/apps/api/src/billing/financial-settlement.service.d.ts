import { PrismaService } from '../prisma/prisma.service';
export interface BillingEntry {
    tenantId: string;
    traceId: string;
    itemType: string;
    itemId: string;
    chargeCode: string;
    amount: number;
    currency?: string;
    status: 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';
    evidenceRef?: string;
}
export declare class FinancialSettlementService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    writeBillingLedger(entry: BillingEntry): Promise<void>;
    calculateCE06Cost(charCount: number): number;
    calculateShotRenderCost(): number;
    calculateVideoRenderCost(): number;
}
