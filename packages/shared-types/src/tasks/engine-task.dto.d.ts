export type EngineExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RETRYING';
export interface EngineJobSummary {
    id: string;
    jobType: string;
    status: EngineExecutionStatus;
    attempts: number;
    retryCount: number;
    maxRetry: number | null;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
}
export interface EngineTaskSummary {
    taskId: string;
    projectId: string;
    taskType: string;
    status: string;
    engineKey: string;
    adapterName: string;
    jobs: EngineJobSummary[];
    createdAt: string;
    updatedAt: string;
}
