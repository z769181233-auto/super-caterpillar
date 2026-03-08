export interface WorkerJobBase {
    id: string;
    projectId?: string | null;
    organizationId?: string | null;
    traceId?: string | null;
    payload: any;
    engineConfig?: any;
    taskId?: string | null;
    [key: string]: any;
}
export interface WorkerPayloadBase {
    [key: string]: unknown;
}
