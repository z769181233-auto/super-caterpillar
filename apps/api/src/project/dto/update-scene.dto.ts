import { IsString, IsOptional } from 'class-validator';

export class UpdateSceneDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  summary?: string;
}
