/**
 * EngineTask DTO
 * 引擎任务视图 DTO，用于任务中心、监控系统等场景
 * 
 * 注意：所有字段均从现有表（Task / ShotJob）推导，不新增数据库字段
 */

export type EngineExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRYING';

export interface EngineJobSummary {
  id: string;
  jobType: string;
  status: EngineExecutionStatus;
  attempts: number;
  retryCount: number;
  maxRetry: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface EngineTaskSummary {
  taskId: string;
  projectId: string;
  taskType: string;
  status: string;
  engineKey: string;
  adapterName: string;
  jobs: EngineJobSummary[];
  createdAt: string;
  updatedAt: string;
}

