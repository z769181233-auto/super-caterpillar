/**
 * 状态枚举与文案映射（与后端对齐）
 * 禁止硬编码状态字符串
 */

// Job 状态枚举
export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'FORCE_FAILED'
  | 'QUEUED';

// Job 状态中文文案映射
export const JobStatusMap: Record<JobStatus, string> = {
  PENDING: '等待中',
  RUNNING: '执行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
  FORCE_FAILED: '强制失败',
  QUEUED: '排队中',
};

// 分析状态枚举（与 NovelAnalysisStatus 对齐）
export type AnalysisStatus = 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';

// 分析状态中文文案映射
export const AnalysisStatusMap: Record<AnalysisStatus, string> = {
  PENDING: '等待分析',
  ANALYZING: '分析中',
  DONE: '分析完成',
  FAILED: '分析失败',
};

/**
 * 获取 Job 状态中文文案
 */
export function getJobStatusText(status: string): string {
  return JobStatusMap[status as JobStatus] || status;
}

/**
 * 获取分析状态中文文案
 */
export function getAnalysisStatusText(status: string | null | undefined): string {
  if (!status) return '等待分析';
  return AnalysisStatusMap[status as AnalysisStatus] || status;
}
