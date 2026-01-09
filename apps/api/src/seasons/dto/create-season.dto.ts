import { IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateSeasonDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional() // Title is optional per legacy logic, but usually good to have. Logic defaults if missing.
  title?: string;

  @IsInt()
  @IsOptional()
  index?: number;

  @IsString()
  @IsOptional()
  name?: string; // Legacy compatibility
}
