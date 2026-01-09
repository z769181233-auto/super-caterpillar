import { IsString, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateSeasonDto {
  @IsNumber()
  @Min(1, { message: 'Season index must be at least 1' })
  @IsOptional()
  index?: number;

  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'Season title must not be empty' })
  @MaxLength(200, { message: 'Season title must not exceed 200 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Season description must not exceed 2000 characters' })
  description?: string;
}
