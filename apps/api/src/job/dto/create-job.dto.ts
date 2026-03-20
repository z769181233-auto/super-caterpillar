import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
// JobType 枚举类型
type JobType =
  | 'IMAGE'
  | 'VIDEO'
  | 'STORYBOARD'
  | 'AUDIO'
  | 'NOVEL_ANALYZE_CHAPTER'
  | 'NOVEL_ANALYSIS'
  | 'VIDEO_RENDER'
  | 'SHOT_RENDER'
  | 'CE02_VISUAL_DENSITY'
  | 'CE03_VISUAL_DENSITY'
  | 'CE04_VISUAL_ENRICHMENT'
  | 'CE06_NOVEL_PARSING'
  | 'CE07_MEMORY_UPDATE'
  | 'TIMELINE_PREVIEW'
  | 'CE11_SHOT_GENERATOR'
  | 'CE_FILM_IR_PLAN'
  | 'CE_SHOT_PLAN'
  | 'CE_CONSISTENCY_CHECK'
  | 'CE_CONTENT_JUDGE';

export class CreateJobDto {
  @IsEnum([
    'IMAGE',
    'VIDEO',
    'STORYBOARD',
    'AUDIO',
    'NOVEL_ANALYZE_CHAPTER',
    'NOVEL_ANALYSIS',
    'VIDEO_RENDER',
    'SHOT_RENDER',
    'CE02_VISUAL_DENSITY',
    'CE03_VISUAL_DENSITY',
    'CE04_VISUAL_ENRICHMENT',
    'CE06_NOVEL_PARSING',
    'CE07_MEMORY_UPDATE',
    'TIMELINE_PREVIEW',
    'CE11_SHOT_GENERATOR',
    'CE_FILM_IR_PLAN',
    'CE_SHOT_PLAN',
    'CE_CONSISTENCY_CHECK',
    'CE_CONTENT_JUDGE',
    'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
  ] as const)
  type: JobType;

  @IsOptional()
  @IsString()
  jobType?: string; // 系统 worker 仍会发送的兼容别名，新代码应优先使用 type

  @IsOptional()
  @IsString()
  projectId?: string; // Project-level job 创建上下文（system-worker/HMAC 路径仍使用）

  @IsOptional()
  @IsString()
  organizationId?: string; // 组织上下文（system-worker/HMAC 路径仍使用）

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsString()
  engine?: string; // Studio v0.6: 引擎标识

  @IsOptional()
  @IsObject()
  engineConfig?: Record<string, any>; // Studio v0.6: 引擎配置

  @IsOptional()
  @IsString()
  traceId?: string; // 追踪 ID

  @IsOptional()
  isVerification?: boolean;

  @IsOptional()
  @IsString()
  dedupeKey?: string;

  @IsOptional()
  @IsString()
  parentJobId?: string;

  @IsOptional()
  priority?: number;
}
