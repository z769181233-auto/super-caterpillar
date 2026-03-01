import { IsString, IsOptional, IsObject, IsNumber, IsBoolean } from 'class-validator';

/**
 * 创建角色档案 DTO
 */
export class CreateCharacterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  baseImageUrl?: string;

  @IsOptional()
  @IsString()
  basePrompt?: string;

  @IsObject()
  attributes: {
    age?: number;
    gender?: string;
    ethnicity?: string;
    clothing?: string;
    hairstyle?: string;
    accessories?: string[];
    [key: string]: any;
  };

  @IsOptional()
  timeline?: Array<{
    episodeId: string;
    changes: Record<string, any>;
  }>;
}

/**
 * 更新角色档案 DTO
 */
export class UpdateCharacterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  baseImageUrl?: string;

  @IsOptional()
  @IsString()
  basePrompt?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  timeline?: Array<{
    episodeId: string;
    changes: Record<string, any>;
  }>;

  @IsOptional()
  @IsString()
  loraModelId?: string;

  @IsOptional()
  @IsString()
  loraTrainingStatus?: string;
}

/**
 * 记录角色出现 DTO
 */
export class RecordAppearanceDto {
  @IsString()
  shotId: string;

  @IsString()
  renderedImageUrl: string;

  @IsOptional()
  @IsString()
  promptUsed?: string;

  @IsOptional()
  @IsNumber()
  consistencyScore?: number;
}

/**
 * 触发 LoRA 训练 DTO
 */
export class TrainLoraDto {
  @IsOptional()
  @IsNumber()
  minConsistencyScore?: number;

  @IsOptional()
  @IsBoolean()
  forceRetrain?: boolean;
}
