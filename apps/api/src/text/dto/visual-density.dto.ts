import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

/**
 * Visual Density DTO
 * CE03: Visual Density 输入参数
 */
export class VisualDensityDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsOptional()
  sceneId?: string;

  @IsUUID()
  @IsOptional()
  shotId?: string;
}
