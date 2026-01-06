import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
// JobType 枚举类型
type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER' | 'NOVEL_ANALYSIS' | 'VIDEO_RENDER' | 'SHOT_RENDER' | 'CE03_VISUAL_DENSITY' | 'CE04_VISUAL_ENRICHMENT' | 'CE06_NOVEL_PARSING' | 'CE07_MEMORY_UPDATE';

export class CreateJobDto {
  @IsEnum(['IMAGE', 'VIDEO', 'STORYBOARD', 'AUDIO', 'NOVEL_ANALYZE_CHAPTER', 'NOVEL_ANALYSIS', 'VIDEO_RENDER', 'SHOT_RENDER', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT', 'CE06_NOVEL_PARSING', 'CE07_MEMORY_UPDATE'] as const)
  type: JobType;

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
}











