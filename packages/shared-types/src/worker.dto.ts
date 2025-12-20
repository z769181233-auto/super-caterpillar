export interface WorkerJobBase {
    id: string;
    projectId: string;
    traceId?: string;
    payload: unknown;
    taskId?: string;
    [key: string]: unknown; // Allow flex props for legacy compatibility
}

export interface WorkerPayloadBase {
    [key: string]: unknown;
}
