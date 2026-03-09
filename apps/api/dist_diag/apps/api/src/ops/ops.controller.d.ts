import { PrismaService } from '../prisma/prisma.service';
import { OpsMetricsService } from './ops-metrics.service';
export declare class OpsController {
    private readonly prisma;
    private readonly metricsService;
    constructor(prisma: PrismaService, metricsService: OpsMetricsService);
    getMetrics(): Promise<{
        job_success_rate_15m: number;
        job_counts_by_type: Record<string, number>;
        queue_depth: number;
        oldest_pending_age_ms: number;
        published_assets_24h: number;
        rework_rate_1h: number;
        ce23_real_scored_1h: number;
        ce23_real_shadow_1h: number;
        ce23_real_fail_1h: number;
        ce23_real_fail_rate_1h: number;
        rework_stats_1h: {
            avg_rework_cost_estimate: number;
            ce23_guardrail_blocked_1h: number;
            ce23_real_marginal_fail_1h: number;
            total_evaluations_1h: number;
            total_fails_1h: number;
            blocked_by_budget_1h: number;
            blocked_by_max_attempt_1h: number;
            idempotency_hit_1h: number;
            blocked_by_rate_limit_1h: number;
        };
        cost_by_engineKey_24h: Record<string, number>;
        audio_kill_switch_active: number;
        audio_vendor_calls_1h: number;
        audio_cache_hits_1h: number;
        audio_cache_misses_1h: number;
        audio_preview_requests_1h: number;
        audio_cache_hit_rate_1h: number;
        audio_metrics: {
            audio_vendor_calls_total: number;
            audio_cache_hits_total: number;
            audio_cache_misses_total: number;
            audio_preview_requests_total: number;
            audio_vendor_calls_1h: number;
            audio_cache_hits_1h: number;
            audio_cache_misses_1h: number;
            audio_preview_requests_1h: number;
            audio_cache_hit_rate_1h: number;
            audio_kill_switch_active: number;
        };
        timestamp: string;
    }>;
    diagnoseJob(jobId: string): Promise<{
        job: {
            id: string;
            type: import("database").$Enums.JobType;
            status: import("database").$Enums.JobStatus;
            priority: number;
            maxRetry: number;
            retryCount: number;
            attempts: number;
            workerId: string | null;
            worker: {
                id: string;
                workerId: string;
                status: import("database").$Enums.WorkerStatus;
                lastHeartbeat: Date;
            } | null;
            taskId: string | null;
            task: {
                id: string;
                type: import("database").$Enums.TaskType;
                status: import("database").$Enums.TaskStatus;
            } | null;
            createdAt: Date;
            updatedAt: Date;
            lastError: string | null;
            traceId: string | null;
        };
        engineBinding: {
            id: string;
            engineId: string;
            engineKey: string;
            engineVersionId: string | null;
            status: import("database").$Enums.JobEngineBindingStatus;
            boundAt: Date;
            executedAt: Date | null;
            completedAt: Date | null;
            errorMessage: string | null;
            engine: {
                id: string;
                engineKey: string;
                adapterName: string;
                enabled: boolean;
            } | null;
            engineVersion: {
                id: string;
                versionName: string;
                enabled: boolean;
            } | null;
        } | null;
        auditLogs: {
            id: string;
            action: string;
            resourceType: string;
            resourceId: string | null;
            details: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
            createdAt: Date;
        }[];
    }>;
}
