export type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER';
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export interface Job {
    id: string;
    shotId: string;
    type: JobType;
    status: JobStatus;
    payload: any;
    result?: any;
    priority: number;
    attempts: number;
    maxAttempts: number;
    scheduledAt?: Date | null;
    lastError?: string | null;
    lockedAt?: Date | null;
    processor: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface JobProcessor {
    supports(type: JobType): boolean;
    process(job: Job): Promise<{
        success: boolean;
        result?: any;
        error?: string;
    }>;
}
