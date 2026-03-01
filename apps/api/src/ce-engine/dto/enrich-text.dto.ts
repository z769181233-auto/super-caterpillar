import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * POST /text/enrich (CE04) DTO
 */
export class EnrichTextDto {
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
