export interface WorkerJobBase {
  id: string;
  projectId?: string | null;
  organizationId?: string | null;
  traceId?: string | null;
  payload: any;
  engineConfig?: any; // 允许 any 以兼容 Prisma 的 JsonValue (含 null)
  taskId?: string | null;
  [key: string]: any;
}

export interface WorkerPayloadBase {
  [key: string]: unknown;
}
