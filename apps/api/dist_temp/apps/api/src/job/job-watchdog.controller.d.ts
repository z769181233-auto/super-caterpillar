import { JobWatchdogService } from './job-watchdog.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class JobWatchdogController {
    private readonly watchdogService;
    private readonly prisma;
    constructor(watchdogService: JobWatchdogService, prisma: PrismaService);
    triggerWatchdog(): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }>;
    getStuckJobs(): Promise<{
        success: boolean;
        count: number;
        jobs: {
            stuckDuration: number;
            leaseExpired: boolean;
            id: string;
            createdAt: Date;
            type: import("database").$Enums.JobType;
            status: import("database").$Enums.JobStatus;
            updatedAt: Date;
            workerId: string | null;
            maxRetry: number;
            retryCount: number;
            leaseUntil: Date | null;
            lastError: string | null;
            worker: {
                status: import("database").$Enums.WorkerStatus;
                workerId: string;
                lastHeartbeat: Date;
            } | null;
        }[];
        timestamp: string;
    }>;
    getWatchdogStats(): Promise<{
        success: boolean;
        stats: {
            totalRunning: number;
            stuck: {
                byUpdatedAt: number;
                byLease: number;
                both: number;
                total: number;
            };
            last24h: {
                recovered: number;
                failed: number;
            };
        };
        timestamp: string;
    }>;
}
