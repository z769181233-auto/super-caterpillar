import { JsonObject, JsonValue } from './json';

export interface WorkerJobBase<
  TPayload extends WorkerPayloadBase = Record<string, any>,
  TEngineConfig = JsonValue,
> {
  id: string;
  projectId?: string | null;
  organizationId?: string | null;
  traceId?: string | null;
  payload: TPayload;
  engineConfig?: TEngineConfig; // 兼容 Prisma JsonValue (含 null)
  taskId?: string | null;
  [key: string]: unknown;
}

export type WorkerPayloadBase = Record<string, unknown>;
