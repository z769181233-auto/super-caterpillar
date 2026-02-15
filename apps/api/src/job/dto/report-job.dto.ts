import { IsEnum, IsOptional, IsObject, IsString, IsInt } from 'class-validator';
import { JobStatus } from 'database';

export class ReportJobDto {
  @IsEnum(JobStatus)
  status: JobStatus;

  @IsObject()
  @IsOptional()
  result?: any;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsOptional()
  metrics?: any;

  @IsInt()
  @IsOptional()
  attempts?: number;

  @IsOptional()
  context?: any;
}
