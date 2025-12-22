import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * POST /story/parse (CE06) DTO
 */
export class ParseStoryDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  rawText: string;

  @IsOptional()
  @IsObject()
  options?: {
    // 可选配置
    engineKey?: string;
    engineVersion?: string;
  };
}

