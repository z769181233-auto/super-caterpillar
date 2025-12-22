/**
 * EngineAdapter 抽象层类型定义
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章（EngineAdapter 总体设计）
 * 参考《毛毛虫宇宙_TaskSystemAsyncExecutionSpec_V1.0》中 Engine 调用相关章节
 */

/**
 * 引擎调用输入
 */
export interface EngineInvokeInput {
  /**
   * Job 类型（如 NOVEL_ANALYSIS, SHOT_RENDER）
   */
  jobType: string;

  /**
   * 引擎标识（如 default_novel_analysis, gemini-v1, openai-gpt4）
   */
  engineKey: string;

  /**
   * Job 负载数据（具体内容由 JobType 决定）
   */
  payload: Record<string, any> & {
    /**
     * 可选：指定引擎版本（S3-B.2）
     */
    engineVersion?: string;
  };

  /**
   * 上下文信息（projectId, sceneId, shotId 等）
   */
  context: {
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    episodeId?: string;
    seasonId?: string;
    [key: string]: any;
  };
}

/**
 * 引擎调用结果状态
 */
export enum EngineInvokeStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYABLE = 'RETRYABLE',
}

/**
 * 引擎调用结果
 */
export interface EngineInvokeResult {
  /**
   * 执行状态
   */
  status: EngineInvokeStatus;

  /**
   * 输出数据（成功时返回）
   */
  output?: Record<string, any>;

  /**
   * 错误信息（失败时返回）
   */
  error?: {
    message: string;
    code?: string;
    details?: any;
  };

  /**
   * 指标信息（可选，用于监控）
   */
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    cost?: number;
    [key: string]: any;
  };
}

/**
 * EngineAdapter 接口
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章
 */
export interface EngineAdapter {
  /**
   * 适配器名称（唯一标识）
   */
  name: string;

  /**
   * 检查是否支持指定的引擎标识
   * @param engineKey 引擎标识
   * @returns 是否支持
   */
  supports(engineKey: string): boolean;

  /**
   * 调用引擎执行任务
   * @param input 调用输入
   * @returns 调用结果
   */
  invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}

