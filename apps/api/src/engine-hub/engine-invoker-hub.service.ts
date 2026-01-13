/**
 * Engine Invoker Hub Service
 * Stage2: 统一的引擎调用服务，接收 EngineInvocationRequest，返回 EngineInvocationResult
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineInvocationRequest, EngineInvocationResult } from '@scu/shared-types';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';

/**
 * Engine Invoker Hub
 * 路由 + 调用聚合，统一包装为 EngineInvocationResult
 */
@Injectable()
export class EngineInvokerHubService {
  private readonly logger = new Logger(EngineInvokerHubService.name);

  constructor(
    private readonly engineRegistry: EngineRegistryHubService,
    private readonly memoryRegistry: EngineRegistry,
    private readonly moduleRef: ModuleRef,
    private readonly httpEngineAdapter: HttpEngineAdapter,
    private readonly auditLogService: AuditLogService
  ) { }

  /**
   * 调用引擎
   * @param req 引擎调用请求
   * @returns 引擎调用结果
   */
  async invoke<TInput, TOutput>(
    req: EngineInvocationRequest<TInput>
  ): Promise<EngineInvocationResult<TOutput>> {
    const started = Date.now();
    let fallbackReason: string | undefined;

    // 0. 故障注入 (Fault Injection) - 仅在 GATE_MODE 下生效
    const isGateMode = process.env.GATE_MODE === '1';
    const forceFailKeys = (process.env.ENGINE_FORCE_FAIL_KEYS || '').split(',').filter(Boolean);
    const disableKeys = (process.env.ENGINE_DISABLE_KEYS || '').split(',').filter(Boolean);

    if (isGateMode && forceFailKeys.includes(req.engineKey)) {
      const result: EngineInvocationResult<TOutput> = {
        success: false,
        selectedEngineKey: req.engineKey,
        error: {
          code: 'FAULT_INJECTED',
          message: `Engine ${req.engineKey} matched ENGINE_FORCE_FAIL_KEYS`,
        },
        metrics: { latencyMs: Date.now() - started },
      };
      await this.logInvocation(req, result);
      return result;
    }

    // 0.5. 优先检查内存注册表 (In-Memory Override)
    // 用于 "Gateway" 模式：DB声明为 HTTP (通过Binding检查)，但实际执行由本地 Adapter 拦截
    const memoryAdapter = this.memoryRegistry.findAdapter(req.engineKey);
    if (memoryAdapter) {
      const engineInput: EngineInvokeInput = {
        engineKey: req.engineKey,
        jobType: this.inferJobTypeFromEngineKey(req.engineKey),
        payload: { ...req.payload, engineVersion: req.engineVersion },
        context: { ...req.metadata },
      };
      const engineResult = await memoryAdapter.invoke(engineInput);
      let output: TOutput | undefined;

      if (engineResult.status === 'SUCCESS') {
        output = engineResult.output as TOutput;
      } else {
        throw new Error(engineResult.error?.message || 'Memory Adapter execution failed');
      }

      const result: EngineInvocationResult<TOutput> = {
        success: true,
        selectedEngineKey: req.engineKey,
        output,
        metrics: { latencyMs: Date.now() - started },
      };
      await this.logInvocation(req, result);
      return result;
    }

    // 1. 查找引擎描述符 (DB)
    let descriptor = this.engineRegistry.find(req.engineKey, req.engineVersion);

    // 1.1 检查禁用列表
    if (isGateMode && descriptor && disableKeys.includes(descriptor.engineKey)) {
      this.logger.warn(
        `Engine ${descriptor.engineKey} is disabled via ENGINE_DISABLE_KEYS, attempting fallback...`
      );
      fallbackReason = `Engine ${descriptor.engineKey} disabled by Gate`;
      descriptor = null; // 强制触发找不到引擎的逻辑或后续 fallback
    }

    if (!descriptor) {
      const result: EngineInvocationResult<TOutput> = {
        success: false,
        error: {
          code: 'ENGINE_NOT_FOUND',
          message: `Engine ${req.engineKey}@${req.engineVersion ?? 'default'} not registered or disabled`,
        },
        fallbackReason,
        metrics: {
          latencyMs: Date.now() - started,
        },
      };
      await this.logInvocation(req, result);
      return result;
    }

    try {
      let output: TOutput;
      let engineResult: EngineInvokeResult | undefined;

      if (descriptor.mode === 'local') {
        // 2. 本地 adapter 调用
        if (!descriptor.adapterToken) {
          throw new Error(`Local adapter token not specified for ${descriptor.engineKey}`);
        }

        const adapter = this.moduleRef.get<EngineAdapter>(descriptor.adapterToken, {
          strict: false,
        });

        if (!adapter) {
          throw new Error(`Adapter ${descriptor.adapterToken} not found in module`);
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
          throw new Error(engineResult.error?.message || 'Engine execution failed');
        }
      } else {
        // 3. HTTP adapter 调用
        if (!descriptor.httpConfig) {
          throw new Error(`HTTP config not specified for ${descriptor.engineKey}`);
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
          throw new Error(engineResult.error?.message || 'Engine execution failed');
        }
      }

      const finalResult: EngineInvocationResult<TOutput> = {
        success: true,
        selectedEngineKey: descriptor.engineKey,
        selectedEngineVersion: descriptor.version,
        fallbackReason,
        output,
        metrics: {
          latencyMs: Date.now() - started,
          usage: {
            inputTokens: engineResult?.metrics?.tokensIn || 0,
            outputTokens: engineResult?.metrics?.tokensOut || 0,
            totalTokens:
              (engineResult?.metrics?.tokensUsed as number) ||
              (engineResult?.metrics?.tokens as number) ||
              0,
            costUsd:
              (engineResult?.metrics?.cost as number) ||
              (engineResult?.metrics?.costUsd as number) ||
              0,
          },
          ...(engineResult?.metrics || {}),
        },
      };

      await this.logInvocation(req, finalResult);
      return finalResult;
    } catch (e: unknown) {
      const errorObj = e as any;
      this.logger.error(
        `Engine invocation failed: ${req.engineKey}@${req.engineVersion ?? 'default'}`,
        errorObj?.stack || errorObj?.message
      );

      const result: EngineInvocationResult<TOutput> = {
        success: false,
        selectedEngineKey: descriptor.engineKey,
        selectedEngineVersion: descriptor.version,
        fallbackReason,
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

      await this.logInvocation(req, result);
      return result;
    }
  }

  /**
   * 记录引擎调用审计日志
   */
  private async logInvocation(req: EngineInvocationRequest<any>, res: EngineInvocationResult<any>) {
    await this.auditLogService.record({
      action: 'ENGINE_HUB_INVOKE',
      resourceType: 'engine',
      resourceId: res.selectedEngineKey || req.engineKey,
      traceId: req.metadata?.traceId,
      details: {
        request: {
          engineKey: req.engineKey,
          engineVersion: req.engineVersion,
        },
        response: {
          success: res.success,
          selectedEngineKey: res.selectedEngineKey,
          selectedEngineVersion: res.selectedEngineVersion,
          fallbackReason: res.fallbackReason,
          error: res.error,
          metrics: res.metrics,
        },
      },
    });
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
