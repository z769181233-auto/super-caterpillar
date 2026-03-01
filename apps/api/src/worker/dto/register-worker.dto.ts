import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class RegisterWorkerDto {
  @IsString()
  workerId: string;

  @IsString()
  name: string;

  @IsObject()
  @IsOptional()
  capabilities?: {
    supportedJobTypes?: string[];
    supportedModels?: string[];
    maxBatchSize?: number;
  };

  @IsNumber()
  @IsOptional()
  gpuCount?: number;

  @IsNumber()
  @IsOptional()
  gpuMemory?: number;

  @IsString()
  @IsOptional()
  gpuType?: string;
}
