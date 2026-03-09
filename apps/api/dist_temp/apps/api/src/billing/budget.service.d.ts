import { PrismaService } from '../prisma/prisma.service';
export declare enum BudgetLevel {
    OK = "OK",
    WARN = "WARN",
    BLOCK_HIGH_COST = "BLOCK_HIGH_COST",
    BLOCK_ALL_CONSUME = "BLOCK_ALL_CONSUME"
}
export declare class BudgetService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getBudgetStatus(organizationId: string, projectId?: string): Promise<{
        ratio: number;
        level: BudgetLevel;
    }>;
}
