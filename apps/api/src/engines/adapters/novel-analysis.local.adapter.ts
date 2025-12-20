/**
 * NovelAnalysisLocalAdapter
 * 将现有的 NOVEL_ANALYSIS 本地处理逻辑包装为 EngineAdapter
 * 
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章
 * 注意：本轮只做"包一层"，不改业务逻辑输入/输出结构
 * 
 * 注意：API 端的 Adapter 主要用于注册和管理，实际执行在 Worker 端
 * Worker 端使用 NovelAnalysisLocalAdapterWorker 执行实际逻辑
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';

/**
 * NovelAnalysisLocalAdapter（API 端版本）
 * 主要用于注册和管理，实际执行在 Worker 端
 * 
 * 如果需要在 API 端也能执行，需要将处理逻辑提取到 shared 包中
 */
@Injectable()
export class NovelAnalysisLocalAdapter implements EngineAdapter {
  public readonly name = 'default_novel_analysis';
  private readonly logger = new Logger(NovelAnalysisLocalAdapter.name);

  /**
   * 检查是否支持指定的引擎标识
   */
  supports(engineKey: string): boolean {
    return engineKey === 'default_novel_analysis' || engineKey === 'local_novel_analysis';
  }

  /**
   * 调用引擎执行 NOVEL_ANALYSIS 任务
   * 
   * 注意：API 端的 Adapter 主要用于注册和管理，实际执行通常在 Worker 端
   * 如果需要在 API 端执行，需要将处理逻辑提取到 shared 包中
   * 本轮暂时返回错误，提示应在 Worker 端执行
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.warn(
      `NovelAnalysisLocalAdapter.invoke called in API context. This adapter should be used in Worker context.`,
    );

    // 返回错误，提示应在 Worker 端执行
    return {
      status: EngineInvokeStatus.FAILED,
      error: {
        message: 'NovelAnalysisLocalAdapter should be used in Worker context, not API context. Please use Worker-side adapter.',
        code: 'ADAPTER_CONTEXT_ERROR',
        details: {
          hint: 'The actual execution logic is in apps/workers/src/engine-adapter-client.ts',
        },
      },
    };
  }
}
