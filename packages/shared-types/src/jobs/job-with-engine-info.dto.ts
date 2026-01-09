/**
 * S3-C.3: 统一 Job 级别的引擎信息数据模型
 *
 * 用于前后端统一的数据结构，确保所有页面使用相同的数据格式
 */

/**
 * 性能指标
 */
export interface JobEngineMetrics {
  durationMs: number | null;
  costUsd: number | null;
  tokens?: number | null;
}

/**
 * 质量评分
 */
export interface JobQualityScore {
  score: number | null;
  confidence: number | null;
}

/**
 * 带引擎信息的 Job 数据模型
 *
 * 用于所有需要展示引擎信息的 API 响应
 */
export interface JobWithEngineInfo {
  // 基础字段
  id: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;

  // S3-C.3: 引擎信息（统一字段）
  engineKey: string; // 引擎标识（必填，从 payload.engineKey 或默认引擎提取）
  engineVersion: string | null; // 引擎版本（可选，从 payload.engineVersion 提取）
  adapterName: string; // 适配器名称（必填，从 adapter.name 或 engineKey 提取）

  // S3-C.3: 质量指标（统一字段）
  qualityScore: JobQualityScore | null;

  // S3-C.3: 性能指标（统一字段）
  metrics: JobEngineMetrics | null;
}
