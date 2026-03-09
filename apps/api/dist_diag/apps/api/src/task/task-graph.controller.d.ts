import { TaskGraphService } from './task-graph.service';
import { QualityScoreService } from '../quality/quality-score.service';
import { QualityFeedbackService } from '../quality/quality-feedback.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
export declare class TaskGraphController {
    private readonly taskGraphService;
    private readonly qualityScoreService;
    private readonly qualityFeedbackService;
    private readonly engineRegistry;
    private readonly engineConfigStore;
    private readonly prisma;
    private readonly jobService;
    constructor(taskGraphService: TaskGraphService, qualityScoreService: QualityScoreService, qualityFeedbackService: QualityFeedbackService, engineRegistry: EngineRegistry, engineConfigStore: EngineConfigStoreService, prisma: PrismaService, jobService: JobService);
    getTaskGraph(taskId: string): Promise<{
        success: boolean;
        error: {
            code: string;
            message: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            jobs: any[];
            qualityScores: any[];
            qualityFeedback: import("../quality/quality-feedback.service").QualityFeedbackResult;
            taskId: string;
            projectId: string;
            taskType: string;
            status: string;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
        error?: undefined;
    }>;
    private enrichJobsWithEngineInfo;
    private buildQualityScores;
}
