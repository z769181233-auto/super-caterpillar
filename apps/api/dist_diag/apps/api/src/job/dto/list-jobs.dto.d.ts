type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER' | 'NOVEL_ANALYSIS' | 'VIDEO_RENDER';
type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export declare class ListJobsDto {
    status?: JobStatus;
    type?: JobType;
    processor?: string;
    shotId?: string;
    projectId?: string;
    engineKey?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}
export {};
