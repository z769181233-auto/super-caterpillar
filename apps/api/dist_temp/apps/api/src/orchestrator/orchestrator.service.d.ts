import { PublishedVideoService } from '../publish/published-video.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TaskService } from '../task/task.service';
import { JobService } from '../job/job.service';
import { EngineRegistry } from '../engine/engine-registry.service';
export declare class OrchestratorService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly taskService;
    private readonly jobService;
    private readonly engineRegistry;
    private readonly publishedVideoService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, taskService: TaskService, jobService: JobService, engineRegistry: EngineRegistry, publishedVideoService: PublishedVideoService);
    dispatch(): Promise<{
        pending: number;
        dispatched: number;
        recovered: number;
        retryReady: number;
        message: string;
    }>;
    scheduleRecovery(): Promise<{
        pending: number;
        dispatched: number;
        recovered: number;
        retryReady: number;
        message: string;
    }>;
    private recoverJobsFromOfflineWorkers;
    private processRetryJobs;
    getStats(): Promise<{
        timestamp: string;
        jobs: {
            pending: number;
            running: number;
            retrying: number;
            failed: number;
            succeeded: number;
            total: number;
        };
        workers: {
            total: number;
            online: number;
            offline: number;
            idle: number;
            busy: number;
        };
        retries: {
            recent24h: {
                total: number;
                byType: Record<string, {
                    count: number;
                    totalRetryCount: number;
                }>;
            };
        };
        queue: {
            avgWaitTimeMs: number;
            avgWaitTimeSeconds: number;
        };
        recovery: {
            recent1h: {
                recoveredJobs: number;
            };
        };
        engines: Record<string, {
            pending: number;
            running: number;
            failed: number;
        }>;
    }>;
    handleJobSucceededEvent(job: any): Promise<void>;
    handleJobCompletion(jobId: string, result: any): Promise<void>;
    private handleV1PipelineChain;
    private checkAndSpawnAudioGen;
    private checkAndSpawnStage1VideoRender;
    private aggregateAndSpawnVideoRender;
    private checkAndSpawnCE09;
    createCECoreDAG(projectId: string, organizationId: string, novelSourceId: string): Promise<{
        taskId: string;
        jobIds: string[];
    }>;
    startStage1Pipeline(params: {
        novelText: string;
        projectId?: string;
        referenceSheetId?: string;
    }): Promise<{
        success: boolean;
        pipelineRunId: string;
        jobId: string;
        projectId: string;
        episodeId: string;
    }>;
    private markOfflineWorkersInternal;
    private reclaimJobsFromDeadWorkersInternal;
    private getDeadWorkerIdsInternal;
}
