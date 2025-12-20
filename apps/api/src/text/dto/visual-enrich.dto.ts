import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

/**
 * Visual Enrich DTO
 * CE04: Visual Enrichment 输入参数
 */
export class VisualEnrichDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsOptional()
  previousJobId?: string;

  @IsUUID()
  @IsOptional()
  sceneId?: string;

  @IsUUID()
  @IsOptional()
  shotId?: string;
}

