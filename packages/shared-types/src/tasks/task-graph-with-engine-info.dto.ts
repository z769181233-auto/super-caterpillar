/**
 * S3-C.3: 统一 Task Graph 数据模型（带引擎信息）
 * 
 * 用于 Task Graph API 的响应结构
 */

import { JobEngineMetrics, JobQualityScore } from '../jobs/job-with-engine-info.dto';

/**
 * Task Graph 中的 Job 节点（带引擎信息）
 */
export interface TaskGraphJobNode {
  jobId: string;
  jobType: string;
  status: string;
  attempts: number;
  retryCount: number;
  maxRetry: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;

  // S3-C.3: 引擎信息（统一字段）
  engineKey: string;
  engineVersion: string | null;
  adapterName: string;

  // S3-C.3: 质量指标（统一字段）
  qualityScore: JobQualityScore | null;

  // S3-C.3: 性能指标（统一字段）
  metrics: JobEngineMetrics | null;
}

/**
 * Task Graph（带引擎信息）
 */
export interface TaskGraphWithEngineInfo {
  taskId: string;
  projectId: string;
  taskType: string;
  status: string;

  // S3-C.3: Job 节点（包含引擎信息）
  jobs: TaskGraphJobNode[];

  // S3-C.3: 质量反馈聚合（可选）
  qualityFeedback?: {
    avgScore: number | null;
    avgConfidence: number | null;
    total: number;
  };
}

