/**
 * CE DAG Pipeline Types
 * Phase 1: Minimal contract types (SSOT)
 */

export interface CEDagRunRequest {
  projectId: string;
  novelSourceId: string;
  shotId: string; // ✅ 必需：ShotJob 挂载维度
  runId?: string; // auto-generated if not provided
  traceId?: string; // auto-generated if not provided
}

import { IsString, IsOptional } from 'class-validator';

/**
 * Controller DTO class (for runtime metadata/validation/Swagger)
 */
export class CEDagRunRequestDto {
  @IsString()
  projectId!: string;

  @IsString()
  novelSourceId!: string;

  @IsString()
  shotId!: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}

export interface CEDagRunResult {
  runId: string;
  traceId: string;
  ce06JobId: string;
  ce03JobId: string;
  ce04JobId: string;
  shotRenderJobIds: string[];
  videoJobId?: string;
  videoKey?: string;
  ce03Score: number; // visualDensityScore
  ce04Score: number; // enrichmentQuality
  warningsCount: number;
  startedAtIso: string;
  finishedAtIso: string;
}

export enum CEDagStatus {
  PENDING = 'PENDING',
  CE06_RUNNING = 'CE06_RUNNING',
  CE03_RUNNING = 'CE03_RUNNING',
  CE04_RUNNING = 'CE04_RUNNING',
  RENDERING_SHOTS = 'RENDERING_SHOTS',
  COMPOSING_VIDEO = 'COMPOSING_VIDEO',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export interface CEDagJobIds {
  ce06JobId?: string;
  ce03JobId?: string;
  ce04JobId?: string;
  shotRenderJobIds?: string[];
  videoJobId?: string;
}
