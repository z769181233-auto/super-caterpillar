export interface CEDagRunRequest {
    projectId: string;
    novelSourceId: string;
    shotId: string;
    rawText?: string;
    runId?: string;
    traceId?: string;
    referenceSheetId?: string;
}
export declare class CEDagRunRequestDto {
    projectId: string;
    novelSourceId: string;
    shotId: string;
    rawText?: string;
    runId?: string;
    traceId?: string;
    referenceSheetId?: string;
}
export interface CEDagRunResult {
    runId: string;
    traceId: string;
    ce06JobId: string;
    ce03JobId: string;
    ce04JobId: string;
    shotRenderJobIds: string[];
    videoJobId?: string;
    timelineComposeJobId?: string;
    timelinePreviewJobId?: string;
    videoKey?: string;
    previewUrl?: string;
    ce03Score: number;
    ce04Score: number;
    warningsCount: number;
    startedAtIso: string;
    finishedAtIso: string;
}
export declare enum CEDagStatus {
    PENDING = "PENDING",
    CE06_RUNNING = "CE06_RUNNING",
    CE03_RUNNING = "CE03_RUNNING",
    CE04_RUNNING = "CE04_RUNNING",
    RENDERING_SHOTS = "RENDERING_SHOTS",
    COMPOSING_VIDEO = "COMPOSING_VIDEO",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED"
}
export interface CEDagJobIds {
    ce06JobId?: string;
    ce03JobId?: string;
    ce04JobId?: string;
    shotRenderJobIds?: string[];
    videoJobId?: string;
    timelineComposeJobId?: string;
    timelinePreviewJobId?: string;
}
