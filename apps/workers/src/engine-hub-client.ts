/**
 * Engine Hub Client (Worker 端)
 * Stage2: Worker 端的 Engine Hub 客户端实现
 * 
 * 注意：Worker 是独立进程，不能使用 NestJS 依赖注入
 * 因此这里创建一个简单的实现，直接使用 EngineAdapterClient
 */

import { PrismaClient } from 'database';
import {
  EngineInvocationRequest,
  EngineInvocationResult,
  NovelAnalysisEngineInput,
  NovelAnalysisEngineOutput,
} from '@scu/shared-types';
import { EngineAdapterClient } from './engine-adapter-client';
import { EngineInvokeInput, EngineInvokeResult, EngineInvokeStatus } from '@scu/shared-types';

/**
 * Engine Hub Client (Worker 端)
 * 提供统一的引擎调用接口，使用 EngineInvocationRequest/Result
 */
export class EngineHubClient {
  private engineAdapterClient: EngineAdapterClient;

  constructor(prisma: PrismaClient) {
    this.engineAdapterClient = new EngineAdapterClient(prisma);
  }

  /**
   * 调用引擎
   * @param req 引擎调用请求
   * @returns 引擎调用结果
   */
  async invoke<TInput, TOutput>(
    req: EngineInvocationRequest<TInput>,
  ): Promise<EngineInvocationResult<TOutput>> {
    const started = Date.now();

    try {
      // 1. 转换 EngineInvocationRequest 为 EngineInvokeInput
      const engineInput: EngineInvokeInput = {
        engineKey: req.engineKey,
        jobType: this.inferJobTypeFromEngineKey(req.engineKey),
        payload: {
          ...req.payload,
          engineVersion: req.engineVersion,
        },
        context: {
          ...req.metadata,
        },
      };

      // 2. 调用 EngineAdapterClient
      const engineResult: EngineInvokeResult = await this.engineAdapterClient.invoke(engineInput);

      // 3. 转换 EngineInvokeResult 为 EngineInvocationResult
      if (engineResult.status === 'SUCCESS' as EngineInvokeStatus) {
        // 对于 NOVEL_ANALYSIS，需要从 output 中提取 analyzed 结构
        // 注意：NovelAnalysisLocalAdapterWorker 返回的是 { ...structure.stats }
        // 但我们需要返回 { analyzed: AnalyzedProjectStructure }
        // 这里需要从 Adapter 内部获取完整的 structure，但当前实现只返回 stats
        // 为了保持兼容，我们暂时返回 output 本身，后续可以在 Adapter 中返回完整结构
        let output: TOutput;

        if (req.engineKey === 'novel_analysis' || req.engineKey === 'default_novel_analysis') {
          // NOVEL_ANALYSIS 的特殊处理：需要从数据库重新读取 analyzed 结构
          // 或者修改 Adapter 返回完整结构（当前先保持兼容）
          // 这里暂时返回 output 本身，实际使用时需要从数据库读取
          output = engineResult.output as TOutput;
        } else {
          output = engineResult.output as TOutput;
        }

        return {
          success: true,
          output,
          metrics: {
            latencyMs: Date.now() - started,
            ...(engineResult.metrics || {}),
          },
        };
      } else {
        return {
          success: false,
          error: {
            code: engineResult.error?.code || 'ENGINE_CALL_FAILED',
            message: engineResult.error?.message || 'Engine execution failed',
            details: engineResult.error?.details,
          },
          metrics: {
            latencyMs: Date.now() - started,
            ...(engineResult.metrics || {}),
          },
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: e?.code || 'ENGINE_CALL_FAILED',
          message: e?.message || 'Engine invocation failed',
          details: {
            engineKey: req.engineKey,
            engineVersion: req.engineVersion,
            ...(e?.details || {}),
          },
        },
        metrics: {
          latencyMs: Date.now() - started,
        },
      };
    }
  }

  /**
   * 根据 engineKey 推断 jobType
   */
  private inferJobTypeFromEngineKey(engineKey: string): string {
    if (engineKey === 'novel_analysis' || engineKey === 'default_novel_analysis') {
      return 'NOVEL_ANALYSIS';
    }
    return 'UNKNOWN';
  }
}

