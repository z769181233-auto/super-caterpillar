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
      // P1: Production Block Gate
      const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
      let targetEngineKey = req.engineKey;

      if (PRODUCTION_MODE) {
        // P1 Hard Requirement: NO SILENT REDIRECTS allowed in production.
        // Aliases like 'ce06-v3' must be blocked if we want full determinism.
        const ALIASES = [
          'ce06-v3',
          'ce06',
          'default_novel_parsing',
          'ce03-v1',
          'ce03',
          'shot_render',
          'ce11_shot_generator_real',
        ];

        const isAlias = ALIASES.includes(targetEngineKey);
        const PROHIBITED_PATTERNS = ['gate_', 'default_', 'test_'];
        const isProhibited = PROHIBITED_PATTERNS.some((p) => targetEngineKey.startsWith(p));

        if (isAlias || isProhibited) {
          throw new Error(
            `[P1-GATE] Security Violation: Prohibited engine or alias '${targetEngineKey}' blocked in Production mode. Explicit engine keys required.`
          );
        }
      }

      // 远程化核心逻辑：将请求转发至 API 侧的母引擎入口
      const payload = {
        engineKey: targetEngineKey,
        engineVersion: req.engineVersion,
        payload: req.payload,
        metadata: {
          ...req.metadata,
          traceId: req.metadata?.traceId || `worker-remote-${Date.now()}`,
        },
      };

      const response = await (this.apiClient as any).request(
        'POST',
        '/api/_internal/engine/invoke',
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
