import { IsString, IsOptional, IsObject, IsEnum, IsDateString } from 'class-validator';

export class UpdateShotDto {
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @IsOptional()
  @IsEnum([
    'DRAFT',
    'READY',
    'GENERATING',
    'GENERATED',
    'FAILED',
    'pending',
    'running',
    'success',
    'fail',
    'need_fix',
  ])
  status?: string;

  // Studio v0.2: 镜头编辑字段
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dialogue?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  // Studio v0.2: 审核字段
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;
}
