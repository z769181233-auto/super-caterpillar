import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
export declare class BillingService {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    private distributedLock;
    constructor(prisma: PrismaService, redis: Redis | null);
    getCredits(userId: string, organizationId: string): Promise<{
        remaining: number;
        total: number;
    }>;
    consumeCredits(projectId: string, userId: string, organizationId: string, amount: number, type: string, traceId?: string): Promise<boolean>;
    private _doConsumeCredits;
    checkQuota(userId: string, organizationId: string, required?: number): Promise<boolean>;
    createSubscription(userId: string, planId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string | null;
        status: import("database").$Enums.SubscriptionStatus;
        updatedAt: Date;
        organizationId: string | null;
        planId: string;
        tier: import("database").$Enums.UserTier;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
    }>;
    getSubscription(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string | null;
        status: import("database").$Enums.SubscriptionStatus;
        updatedAt: Date;
        organizationId: string | null;
        planId: string;
        tier: import("database").$Enums.UserTier;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
    } | null>;
    getPlans(): Promise<{
        id: string;
        name: string;
        price: number;
        quota: {
            tokens: number;
        };
    }[]>;
    getEvents(params: {
        projectId?: string;
        orgId?: string;
        from?: Date;
        to?: Date;
        type?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            userId: string | null;
            orgId: string;
            type: string;
            projectId: string;
            metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            creditsDelta: number;
            currency: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getLedgers(params: {
        projectId?: string;
        status?: any;
        jobType?: string;
        from?: Date;
        to?: Date;
        page?: number;
        pageSize?: number;
    }): Promise<{
        items: {
            id: string;
            createdAt: Date;
            jobId: string;
            projectId: string;
            billingState: string;
            amount: bigint;
            idempotencyKey: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getSummary(projectId?: string, orgId?: string): Promise<{
        totalCreditsDelta: number;
        eventCount: number;
    }>;
    getReconcileStatus(projectId: string): Promise<{
        projectId: string;
        isConsistent: boolean;
        drift: number;
        sumLedger: number;
        sumEvent: number;
        billedLedgerCount: number;
        billingEventsCount: number;
        timestamp: Date;
    }>;
}
