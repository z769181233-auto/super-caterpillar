// JobType 和 JobStatus 枚举类型
export type JobType = 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO' | 'NOVEL_ANALYZE_CHAPTER';
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface Job {
  id: string;
  shotId: string;
  type: JobType;
  status: JobStatus;
  payload: any;
  result?: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: Date | null;
  lastError?: string | null;
  lockedAt?: Date | null;
  processor: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobProcessor {
  /**
   * 检查是否支持该 Job 类型
   */
  supports(type: JobType): boolean;

  /**
   * 处理 Job
   * @param job Job 对象
   * @returns 处理结果（包含 result 字段）
   */
  process(job: Job): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }>;
}
