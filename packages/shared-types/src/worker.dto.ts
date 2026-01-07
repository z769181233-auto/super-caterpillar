export interface WorkerJobBase {
    id: string;
    projectId: string;
    traceId?: string;
    payload: unknown;
    engineConfig?: Record<string, any>;
    taskId?: string;
    [key: string]: any; // 支持任意额外字段（向后兼容）
}

export interface WorkerPayloadBase {
    [key: string]: unknown;
}
