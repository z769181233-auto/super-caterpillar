import { AnalyzedProjectStructure } from '../novel-analysis.dto';
export declare class EngineInvocationRequest<TInput = unknown> {
    engineKey: string;
    engineVersion?: string;
    jobType?: string;
    payload: TInput;
    metadata?: {
        taskId?: string;
        jobId?: string;
        projectId?: string;
        sceneId?: string;
        shotId?: string;
        episodeId?: string;
        seasonId?: string;
        traceId?: string;
        [key: string]: unknown;
    };
    context?: any;
}
export interface EngineInvocationResult<TOutput = unknown> {
    success: boolean;
    output?: TOutput;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    selectedEngineKey?: string;
    selectedEngineVersion?: string;
    fallbackReason?: string;
    metrics?: {
        latencyMs?: number;
        usage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
            costUsd?: number;
        };
        [key: string]: unknown;
    };
}
export interface NovelAnalysisEngineInput {
    novelSourceId: string;
    projectId: string;
    options?: {
        segmentationMode?: 'auto' | 'by-chapter';
        [key: string]: unknown;
    };
}
export interface NovelAnalysisEngineOutput {
    analyzed: AnalyzedProjectStructure;
}
