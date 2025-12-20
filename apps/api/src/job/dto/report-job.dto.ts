import { IsEnum, IsOptional, IsObject, IsString } from 'class-validator';
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

  @IsObject()
  @IsOptional()
  metrics?: any;
}

