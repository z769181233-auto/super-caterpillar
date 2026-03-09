import { BillingService } from './billing.service';
import { BillingSettlementService } from './billing-settlement.service';
import { AuthenticatedUser } from '@scu/shared-types';
export declare class BillingController {
    private readonly billingService;
    private readonly billingSettlementService;
    constructor(billingService: BillingService, billingSettlementService: BillingSettlementService);
    subscribe(user: AuthenticatedUser, planId: string): Promise<{
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
    getSubscription(user: AuthenticatedUser): Promise<{
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
    settle(user: AuthenticatedUser, organizationId: string | null, projectId: string): Promise<{
        processedCount: number;
        failedCount: number;
        durationMs?: undefined;
    } | {
        processedCount: number;
        failedCount: number;
        durationMs: number;
    }>;
    getEvents(organizationId: string | null, projectId?: string, from?: string, to?: string, type?: string, page?: string, pageSize?: string): Promise<{
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
    getLedgers(organizationId: string | null, projectId?: string, status?: any, jobType?: string, from?: string, to?: string, page?: string, pageSize?: string): Promise<{
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
    getSummary(organizationId: string | null, projectId?: string): Promise<{
        totalCreditsDelta: number;
        eventCount: number;
    }>;
    getReconcileStatus(organizationId: string | null, projectId: string): Promise<{
        projectId: string;
        isConsistent: boolean;
        drift: number;
        sumLedger: number;
        sumEvent: number;
        billedLedgerCount: number;
        billingEventsCount: number;
        timestamp: Date;
    }>;
    getGpuRoiAnalytics(timeWindowHours?: string): Promise<{
        timeWindowHours: number;
        completedJobs: number;
        pendingJobsCount: number;
        financials: {
            realCostPerImage: any;
            pricePerImage: number;
            gross_margin_per_image: number;
            projectedTimeframeRevenue: number;
            projectedTimeframeCost: number;
            projectedGrossProfit: number;
        };
        gpuMetrics: {
            predictTime: any;
            totalTime: any;
            throughput_cap_per_worker: number;
            gpu_efficiency: number;
            queue_delay_ratio: number;
            isHealthy: boolean;
        };
        sealStatus: string;
    }>;
}
