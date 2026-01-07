import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { WorkerStatus } from 'database';

export class HeartbeatDto {
  // workerId 从 @Param 获取，不再从 body 中获取
  // @IsString()
  // workerId: string;

  @IsEnum(WorkerStatus)
  @IsOptional()
  status?: WorkerStatus;

  @IsNumber()
  @IsOptional()
  tasksRunning?: number;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsOptional()
  capabilities?: any;
}

