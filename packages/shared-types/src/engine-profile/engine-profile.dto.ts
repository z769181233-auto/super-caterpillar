/**
 * S4-A: 引擎画像与统计相关类型定义
 * 
 * 用于引擎画像 API 的请求和响应结构
 */

/**
 * 引擎画像查询参数
 */
export interface EngineProfileQuery {
  engineKey?: string;      // 可选，若为空则统计所有引擎
  projectId?: string;      // 可选，用于单项目视角
  from?: string;           // ISO8601 时间范围起始（可选）
  to?: string;             // ISO8601 时间范围结束（可选）
}

/**
 * 引擎画像统计结果
 */
export interface EngineProfileSummary {
  engineKey: string;
  engineVersion?: string | null;
  adapterName?: string | null;
  
  // 基础统计
  totalJobs: number;
  successCount: number;
  failedCount: number;
  retryCount: number;
  
  // 质量指标（平均值）
  avgQualityScore?: number | null;
  avgConfidence?: number | null;
  
  // 性能指标（平均值）
  avgDurationMs?: number | null;
  avgTokens?: number | null;
  avgCostUsd?: number | null;
  
  // 成功率
  successRate?: number | null;  // successCount / totalJobs
}

/**
 * 引擎画像 API 响应
 */
export interface EngineProfileResponse {
  summaries: EngineProfileSummary[];
  total: number;
}

