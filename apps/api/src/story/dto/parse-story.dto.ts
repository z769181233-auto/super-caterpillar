import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

/**
 * Parse Story DTO
 * CE06: Novel Parsing 输入参数
 */
export class ParseStoryDto {
  @IsString()
  @IsNotEmpty()
  rawText: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  novelTitle?: string;

  @IsString()
  @IsOptional()
  novelAuthor?: string;
}
