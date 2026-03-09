import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'database';
import { JobType } from 'database';
export interface CapacityCheckResult {
    allowed: boolean;
    reason?: string;
    errorCode?: string;
    currentCount?: number;
    limit?: number;
}
export declare class CapacityGateService {
    private readonly prisma;
    private readonly logger;
    private readonly MAX_CONCURRENT_VIDEO_RENDER;
    private readonly MAX_PENDING_JOBS;
    private readonly MAX_PENDING_VIDEO_RENDER;
    constructor(prisma: PrismaService);
    checkVideoRenderCapacity(organizationId: string, userId?: string, tx?: Prisma.TransactionClient): Promise<CapacityCheckResult>;
    checkJobCapacity(jobType: JobType, organizationId: string, userId?: string): Promise<CapacityCheckResult>;
    getCapacityUsage(organizationId: string): Promise<{
        videoRender: {
            inProgress: number;
            pending: number;
            limit: number;
            pendingLimit: number;
        };
        total: {
            pending: number;
            limit: number;
        };
    }>;
}
