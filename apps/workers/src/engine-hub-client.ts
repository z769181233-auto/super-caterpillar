/**
 * Engine Hub Client (Worker 端)
 * Stage2: Worker 端的 Engine Hub 客户端实现
 *
 * 注意：Worker 是独立进程，不能使用 NestJS 依赖注入
 * 远程化版本：通过 ApiClient 转发请求至 API 母引擎入口
 */

import { EngineInvocationRequest, EngineInvocationResult } from '@scu/shared-types';
import { ApiClient } from './api-client';

/**
 * Engine Hub Client (Worker 端)
 * 提供统一的引擎调用接口，使用 EngineInvocationRequest/Result
 */
export class EngineHubClient {
  constructor(private readonly apiClient: ApiClient) {}

  /**
   * 调用引擎
   * @param req 引擎调用请求
   * @returns 引擎调用结果
   */
  async invoke<TInput, TOutput>(
    req: EngineInvocationRequest<TInput>
  ): Promise<EngineInvocationResult<TOutput>> {
    const started = Date.now();

    try {
      // 远程化核心逻辑：将请求转发至 API 侧的母引擎入口
      // 映射参数以符合 API /_internal/engine/invoke 端点预期
      const payload = {
        engineKey: req.engineKey,
        engineVersion: req.engineVersion,
        payload: req.payload,
        metadata: {
          ...req.metadata,
          traceId: req.metadata?.traceId || `worker-remote-${Date.now()}`,
        },
      };

      // 注意：ApiClient 尚未提供通用的 post 方法用于普通请求，这里需要手动调用私有 request
      // 或者使用现有的针对端点封装的方法。鉴于 Spec 要求“最佳方案”，我们直接使用 ApiClient 的能力。

      // 直接通过 ApiClient 的私有 request 发起调用 (由于 request 是私有的，我们通过 ApiClient 公开一个 invoke 方法或直接在该类中处理)
      // 为简化实现并符合 Spec，我们假设 ApiClient 已具备基础请求能力。

      // 实际开发：ApiClient 中并未导出通用的 request，但 postAuditLog 使用了 request('POST', '/api/audit/logs', payload)
      // 我们通过反射或在该类中模拟逻辑。

      // 这里的“最佳方案”指令要求的是内容整体替换。

      const response = await (this.apiClient as any).request(
        'POST',
        '/_internal/engine/invoke',
        payload
      );

      if (!response || !response.success) {
        throw new Error(`ENGINE_HUB_REMOTE_FAILED: ${JSON.stringify(response?.error || response)}`);
      }

      const result = response.data as EngineInvocationResult<TOutput>;

      return {
        ...result,
        metrics: {
          ...result.metrics,
          latencyMs: Date.now() - started, // 覆盖为端到端总延迟
        },
      };
    } catch (e: any) {
      return {
        success: false,
        error: {
          code: e?.code || 'ENGINE_REMOTE_INVOKE_FAILED',
          message: e?.message || 'Remote engine hub invocation failed',
          details: {
            engineKey: req.engineKey,
            engineVersion: req.engineVersion,
          },
        },
        metrics: {
          latencyMs: Date.now() - started,
        },
      };
    }
  }

  /**
   * 根据 engineKey 推断 jobType (保留供参考)
   */
  private inferJobTypeFromEngineKey(engineKey: string): string {
    if (engineKey === 'novel_analysis' || engineKey === 'default_novel_analysis') {
      return 'NOVEL_ANALYSIS';
    }
    if (engineKey === 'ce06_novel_parsing') {
      return 'CE06_NOVEL_PARSING';
    }
    if (engineKey === 'ce03_visual_density') {
      return 'CE03_VISUAL_DENSITY';
    }
    if (engineKey === 'ce04_visual_enrichment') {
      return 'CE04_VISUAL_ENRICHMENT';
    }
    if (engineKey === 'shot_render' || engineKey === 'default_shot_render') {
      return 'SHOT_RENDER';
    }
    return 'UNKNOWN';
  }
}
