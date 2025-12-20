import { IsArray, IsString, IsOptional, IsBoolean } from 'class-validator';

export class RetryJobDto {
  @IsBoolean()
  @IsOptional()
  resetAttempts?: boolean;
}

export class ForceFailJobDto {
  @IsString()
  @IsOptional()
  message?: string;
}

export class BatchRetryJobsDto {
  @IsArray()
  @IsString({ each: true })
  jobIds: string[];
}

export class BatchCancelJobsDto {
  @IsArray()
  @IsString({ each: true })
  jobIds: string[];
}

export class BatchForceFailJobsDto {
  @IsArray()
  @IsString({ each: true })
  jobIds: string[];

  @IsString()
  @IsOptional()
  note?: string;
}

export class BatchJobOperationDto {
  @IsArray()
  @IsString({ each: true })
  jobIds: string[];

  @IsString()
  @IsOptional()
  note?: string;
}

