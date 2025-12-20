import { IsString, IsOptional } from 'class-validator';

export class ImportNovelFileDto {
  // projectId 从 URL 参数 @Param('projectId') 获取，不在此 DTO 中
  // @IsString()
  // projectId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  author?: string;
}

