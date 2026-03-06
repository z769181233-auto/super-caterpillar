export interface EngineInvokeInput {
    jobType: string;
    engineKey: string;
    payload: Record<string, any> & {
        engineVersion?: string;
    };
    context: {
        projectId?: string;
        sceneId?: string;
        shotId?: string;
        episodeId?: string;
        seasonId?: string;
        [key: string]: any;
    };
}
export declare enum EngineInvokeStatus {
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    RETRYABLE = "RETRYABLE"
}
export interface EngineInvokeResult {
    status: EngineInvokeStatus;
    output?: Record<string, any>;
    error?: {
        message: string;
        code?: string;
        details?: any;
    };
    metrics?: {
        durationMs?: number;
        tokensUsed?: number;
        cost?: number;
        [key: string]: any;
    };
}
export interface EngineAdapter {
    name: string;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
