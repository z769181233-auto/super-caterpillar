import { IsOptional, IsString, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
// JobType 和 JobStatus 枚举类型
type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER' | 'NOVEL_ANALYSIS' | 'VIDEO_RENDER';
type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export class ListJobsDto {
  @IsOptional()
  @IsEnum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const)
  status?: JobStatus;

  @IsOptional()
  @IsEnum(['IMAGE', 'VIDEO', 'STORYBOARD', 'AUDIO', 'NOVEL_ANALYZE_CHAPTER', 'NOVEL_ANALYSIS', 'VIDEO_RENDER'] as const)
  type?: JobType;

  @IsOptional()
  @IsString()
  processor?: string;

  @IsOptional()
  @IsString()
  shotId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  engineKey?: string;

  @IsOptional()
  @IsDateString()
  from?: string; // ISO date string

  @IsOptional()
  @IsDateString()
  to?: string; // ISO date string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}











