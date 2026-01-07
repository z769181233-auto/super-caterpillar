/**
 * Engine Invoker Hub Service
 * Stage2: 统一的引擎调用服务，接收 EngineInvocationRequest，返回 EngineInvocationResult
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EngineInvocationRequest,
  EngineInvocationResult,
} from '@scu/shared-types';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';

/**
 * Engine Invoker Hub
 * 路由 + 调用聚合，统一包装为 EngineInvocationResult
 */
@Injectable()
export class EngineInvokerHubService {
  private readonly logger = new Logger(EngineInvokerHubService.name);

  constructor(
    private readonly engineRegistry: EngineRegistryHubService,
    private readonly moduleRef: ModuleRef,
    private readonly httpEngineAdapter: HttpEngineAdapter,
  ) { }

  /**
   * 调用引擎
   * @param req 引擎调用请求
   * @returns 引擎调用结果
   */
  async invoke<TInput, TOutput>(
    req: EngineInvocationRequest<TInput>,
  ): Promise<EngineInvocationResult<TOutput>> {
    const started = Date.now();

    // 1. 查找引擎描述符
    const descriptor = this.engineRegistry.find(
      req.engineKey,
      req.engineVersion,
    );

    if (!descriptor) {
      return {
        success: false,
        error: {
          code: 'ENGINE_NOT_FOUND',
          message: `Engine ${req.engineKey}@${req.engineVersion ?? 'default'} not registered`,
        },
        metrics: {
          latencyMs: Date.now() - started,
        },
      };
    }

    try {
      let output: TOutput;
      let engineResult: EngineInvokeResult | undefined;

      if (descriptor.mode === 'local') {
        // 2. 本地 adapter 调用
        if (!descriptor.adapterToken) {
          throw new Error(`Local adapter token not specified for ${descriptor.key}`);
        }

        const adapter = this.moduleRef.get<EngineAdapter>(
          descriptor.adapterToken,
          { strict: false },
        );

        if (!adapter) {
          throw new Error(
            `Adapter ${descriptor.adapterToken} not found in module`,
          );
        }

        // 转换 EngineInvocationRequest 为 EngineInvokeInput
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

        engineResult = await adapter.invoke(engineInput);

        // 转换 EngineInvokeResult 为 EngineInvocationResult
        if (engineResult.status === 'SUCCESS') {
          output = engineResult.output as TOutput;
        } else {
          throw new Error(
            engineResult.error?.message || 'Engine execution failed',
          );
        }
      } else {
        // 3. HTTP adapter 调用
        if (!descriptor.httpConfig) {
          throw new Error(`HTTP config not specified for ${descriptor.key}`);
        }

        // 使用现有的 HttpEngineAdapter
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

        engineResult = await this.httpEngineAdapter.invoke(engineInput);

        if (engineResult.status === 'SUCCESS') {
          output = engineResult.output as TOutput;
        } else {
          throw new Error(
            engineResult.error?.message || 'Engine execution failed',
          );
        }
      }

      return {
        success: true,
        output,
        metrics: {
          latencyMs: Date.now() - started,
          ...(engineResult?.metrics || {}),
        },
      };
    } catch (e: unknown) {
      const errorObj = e as any;
      this.logger.error(
        `Engine invocation failed: ${req.engineKey}@${req.engineVersion ?? 'default'}`,
        errorObj?.stack || errorObj?.message,
      );

      return {
        success: false,
        error: {
          code: errorObj?.code ?? 'ENGINE_CALL_FAILED',
          message: errorObj?.message ?? 'Engine invocation failed',
          details: {
            engineKey: req.engineKey,
            engineVersion: req.engineVersion,
            ...(errorObj?.details || {}),
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
   * @param engineKey 引擎标识
   * @returns Job 类型
   */
  private inferJobTypeFromEngineKey(engineKey: string): string {
    // 简单的映射规则
    if (engineKey === 'novel_analysis' || engineKey === 'default_novel_analysis') {
      return 'NOVEL_ANALYSIS';
    }
    // Stage13: CE Core Layer
    if (engineKey === 'ce06_novel_parsing') {
      return 'CE06_NOVEL_PARSING';
    }
    if (engineKey === 'ce03_visual_density') {
      return 'CE03_VISUAL_DENSITY';
    }
    if (engineKey === 'ce04_visual_enrichment') {
      return 'CE04_VISUAL_ENRICHMENT';
    }
    // 其他引擎的映射规则可以在这里扩展
    return 'UNKNOWN';
  }
}

