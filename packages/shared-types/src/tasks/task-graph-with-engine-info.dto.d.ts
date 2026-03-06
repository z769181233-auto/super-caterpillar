import { JobEngineMetrics, JobQualityScore } from '../jobs/job-with-engine-info.dto';
export interface TaskGraphJobNode {
    jobId: string;
    jobType: string;
    status: string;
    attempts: number;
    retryCount: number;
    maxRetry: number | null;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    engineKey: string;
    engineVersion: string | null;
    adapterName: string;
    qualityScore: JobQualityScore | null;
    metrics: JobEngineMetrics | null;
}
export interface TaskGraphWithEngineInfo {
    taskId: string;
    projectId: string;
    taskType: string;
    status: string;
    jobs: TaskGraphJobNode[];
    qualityFeedback?: {
        avgScore: number | null;
        avgConfidence: number | null;
        total: number;
    };
}
