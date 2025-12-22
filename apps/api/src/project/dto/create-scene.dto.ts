import { IsNumber, IsString, IsOptional, IsObject, Min, MaxLength } from 'class-validator';

export class CreateSceneDto {
  @IsNumber()
  @Min(1, { message: 'Scene index must be at least 1' })
  index: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Scene title must not exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Scene summary must not exceed 2000 characters' })
  summary?: string;

  @IsOptional()
  @IsObject()
  characters?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Scene location must not exceed 100 characters' })
  location?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}











