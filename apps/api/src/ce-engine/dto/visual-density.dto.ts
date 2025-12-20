import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * POST /text/visual-density (CE03) DTO
 */
export class VisualDensityDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsObject()
  options?: {
    // 可选配置
    engineKey?: string;
    engineVersion?: string;
  };
}

