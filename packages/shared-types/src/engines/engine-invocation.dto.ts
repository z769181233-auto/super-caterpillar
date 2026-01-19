/**
 * Engine Hub 统一调用接口
 * Stage2: 为所有引擎提供统一的调用输入/输出接口
 */

import { AnalyzedProjectStructure } from '../novel-analysis.dto';

/**
 * 标准引擎调用入参（对所有引擎通用）
 */
export interface EngineInvocationRequest<TInput = unknown> {
  /**
   * 引擎标识（如 "novel_analysis", "image_generation"）
   */
  engineKey: string;

  /**
   * 引擎版本（如 "v1" / "default"）
   */
  engineVersion?: string;

  /**
   * Job 类型（可选，用于推断默认引擎）
   */
  jobType?: string;

  /**
   * 具体业务输入
   */
  payload: TInput;

  /**
   * 元数据（任务上下文信息）
   */
  metadata?: {
    taskId?: string;
    jobId?: string;
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    episodeId?: string;
    seasonId?: string;
    traceId?: string;
    [key: string]: unknown;
  };
}

/**
 * 标准引擎调用结果（对所有引擎通用）
 */
export interface EngineInvocationResult<TOutput = unknown> {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 输出数据（成功时返回）
   */
  output?: TOutput;

  /**
   * 错误信息（失败时返回）
   */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /**
   * 最终选择的引擎标识（用于审计）
   */
  selectedEngineKey?: string;

  /**
   * 最终选择的引擎版本（用于审计）
   */
  selectedEngineVersion?: string;

  /**
   * 回退原因（如果有发生 fallback）
   */
  fallbackReason?: string;

  /**
   * 指标信息（可选，用于监控）
   */
  metrics?: {
    latencyMs?: number;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      costUsd?: number;
    };
    [key: string]: unknown;
  };
}

/**
 * NOVEL_ANALYSIS 引擎输入
 */
export interface NovelAnalysisEngineInput {
  /**
   * 小说源 ID
   */
  novelSourceId: string;

  /**
   * 项目 ID
   */
  projectId: string;

  /**
   * 可选配置
   */
  options?: {
    /**
     * 分段模式
     */
    segmentationMode?: 'auto' | 'by-chapter';
    [key: string]: unknown;
  };
}

/**
 * NOVEL_ANALYSIS 引擎输出
 */
export interface NovelAnalysisEngineOutput {
  /**
   * 分析后的项目结构
   */
  analyzed: AnalyzedProjectStructure;
}
