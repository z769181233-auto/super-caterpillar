import { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
export declare class AdminController {
    private readonly prisma;
    private readonly workerService;
    private readonly orchestratorService;
    constructor(prisma: PrismaService, workerService: WorkerService, orchestratorService: OrchestratorService);
    reclaim(): Promise<{
        reclaimed: number;
    }>;
    setCredits(body: {
        orgId: string;
        credits: number;
    }): Promise<{
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    }>;
    enqueueTest(body: {
        projectId: string;
        jobType: string;
        payload?: any;
        organizationId?: string;
        priority?: number;
    }): Promise<{
        ok: boolean;
        error: string;
        jobId?: undefined;
    } | {
        ok: boolean;
        jobId: string;
        error?: undefined;
    }>;
    startStage1Pipeline(body: {
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
    triggerStage4Scan(body: {
        storageKey: string;
        projectId: string;
        organizationId: string;
    }): Promise<{
        ok: boolean;
        error: string;
        jobId?: undefined;
        projectId?: undefined;
    } | {
        ok: boolean;
        jobId: string;
        projectId: string;
        error?: undefined;
    }>;
}
