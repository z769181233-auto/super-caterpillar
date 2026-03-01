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

  // B3-2: 负载上报增强字段
  @IsNumber()
  @IsOptional()
  cpuUsagePercent?: number; // CPU 使用率 (0-100)

  @IsNumber()
  @IsOptional()
  memoryUsageMb?: number; // 内存使用量 (MB)

  @IsNumber()
  @IsOptional()
  queueDepth?: number; // 当前队列深度 (待处理任务数)

  @IsNumber()
  @IsOptional()
  avgProcessingTimeMs?: number; // 平均任务处理时间 (ms)

  @IsOptional()
  metadata?: Record<string, any>; // 扩展元数据
}
