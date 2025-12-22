import { IsString, IsOptional } from 'class-validator';

export class ImportNovelDto {
  // projectId 从 URL 参数 @Param('projectId') 获取，不在此 DTO 中
  // @IsString()
  // projectId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  rawText?: string;

  // 兼容前端可能发送的原始 text 字段
  @IsString()
  @IsOptional()
  text?: string;

  // 新增字段：支持从 import-file 接口返回的数据
  @IsString()
  @IsOptional()
  novelName?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;
}

