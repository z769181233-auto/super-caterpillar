import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1, { message: 'Project name must not be empty' })
  @MaxLength(200, { message: 'Project name must not exceed 200 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Project description must not exceed 1000 characters' })
  description?: string;
}

