type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER' | 'NOVEL_ANALYSIS' | 'VIDEO_RENDER' | 'SHOT_RENDER' | 'CE02_VISUAL_DENSITY' | 'CE03_VISUAL_DENSITY' | 'CE04_VISUAL_ENRICHMENT' | 'CE06_NOVEL_PARSING' | 'CE07_MEMORY_UPDATE' | 'TIMELINE_PREVIEW' | 'CE11_SHOT_GENERATOR';
export declare class CreateJobDto {
    type: JobType;
    jobType?: string;
    projectId?: string;
    organizationId?: string;
    payload?: Record<string, any>;
    engine?: string;
    engineConfig?: Record<string, any>;
    traceId?: string;
    isVerification?: boolean;
    dedupeKey?: string;
    parentJobId?: string;
    priority?: number;
}
export {};
