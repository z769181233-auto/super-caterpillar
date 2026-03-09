import { EngineRegistry } from '../engine/engine-registry.service';
import { ShotRenderRouterAdapter } from './../engines/adapters/shot_render_router.adapter';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class ProdGateController {
    private readonly registry;
    private readonly shotRouter;
    private readonly orchestratorService;
    private readonly jobService;
    private readonly db;
    private readonly logger;
    constructor(registry: EngineRegistry, shotRouter: ShotRenderRouterAdapter, orchestratorService: OrchestratorService, jobService: JobService, db: PrismaService);
    private resolveArtifactDir;
    networkCheck(): Promise<{
        error: string;
        dns?: undefined;
        tcp?: undefined;
        pg?: undefined;
    } | {
        dns: unknown;
        tcp: unknown;
        pg: {
            success: boolean;
            result: unknown;
            error?: undefined;
            code?: undefined;
        } | {
            success: boolean;
            error: any;
            code: any;
            result?: undefined;
        };
        error?: undefined;
    }>;
    triggerShotRender(body: {
        shotId: string;
        artifactDir: string;
        prompt?: string;
        seed?: number;
        jobId?: string;
    }): Promise<{
        success: boolean;
        jobId: string;
        traceId: string;
        status: import("database").$Enums.JobStatus;
        artifactDir: string;
    }>;
    getJobStatus(jobId: string): Promise<{
        id: string;
        createdAt: Date;
        payload: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        result: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        type: import("database").$Enums.JobType;
        status: import("database").$Enums.JobStatus;
        updatedAt: Date;
        projectId: string;
        organizationId: string;
        traceId: string | null;
        episodeId: string | null;
        sceneId: string | null;
        shotId: string | null;
        taskId: string | null;
        workerId: string | null;
        priority: number;
        maxRetry: number;
        retryCount: number;
        attempts: number;
        leaseUntil: Date | null;
        lockedBy: string | null;
        engineConfig: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        lastError: string | null;
        isVerification: boolean;
        dedupeKey: string | null;
        outputSha256: string | null;
        engineProvider: string | null;
        engineRunId: string | null;
        engineModel: string | null;
        securityProcessed: boolean;
        currentStep: string | null;
    }>;
    triggerStage1Pipeline(body: {
        novelText: string;
        projectId?: string;
        organizationId?: string;
    }): Promise<{
        success: boolean;
        data: {
            success: boolean;
            pipelineRunId: string;
            jobId: string;
            projectId: string;
            episodeId: string;
        };
    }>;
    triggerNovelAnalysis(body: {
        projectId: string;
        filePath?: string;
        rawText?: string;
        jobId?: string;
    }): Promise<{
        success: boolean;
        jobId: any;
        traceId: string;
        status: any;
    }>;
}
