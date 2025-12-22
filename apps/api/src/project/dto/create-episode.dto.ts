import { IsNumber, IsString, MinLength, IsOptional, Min, Max, MaxLength } from 'class-validator';

export class CreateEpisodeDto {
  @IsNumber()
  @Min(1, { message: 'Episode index must be at least 1' })
  index: number;

  @IsString()
  @MinLength(1, { message: 'Episode name must not be empty' })
  @MaxLength(200, { message: 'Episode name must not exceed 200 characters' })
  name: string; // @deprecated 保留用于向后兼容，新代码应使用 title

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Episode title must not be empty' })
  @MaxLength(200, { message: 'Episode title must not exceed 200 characters' })
  title?: string; // 影视工业标准：Episode 标题

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Episode summary must not exceed 2000 characters' })
  summary?: string;
}











