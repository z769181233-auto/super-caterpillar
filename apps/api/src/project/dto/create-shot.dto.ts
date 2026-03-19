import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  Min,
  MaxLength,
  MinLength,
  IsArray,
} from 'class-validator';

export class CreateShotDto {
  @IsNumber()
  @Min(1, { message: 'Shot index must be at least 1' })
  @IsOptional()
  index?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Shot title must not exceed 200 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Shot description must not exceed 2000 characters' })
  description?: string;

  @IsString()
  @MinLength(1, { message: 'Shot type must not be empty' })
  type: string;

  @IsObject()
  @IsOptional()
  params?: Record<string, any>;

  @IsString()
  @IsOptional()
  shotType?: string;

  @IsObject()
  @IsOptional()
  camera?: Record<string, any>;

  @IsArray()
  @IsOptional()
  characters?: string[];

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  emotion?: string;

  @IsNumber()
  @IsOptional()
  durationSec?: number;

  @IsString()
  @IsOptional()
  novelQuote?: string;
}
