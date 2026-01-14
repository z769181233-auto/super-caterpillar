/**
 * Engine Invoker Hub Service
 * Stage2: 统一的引擎调用服务，接收 EngineInvocationRequest，返回 EngineInvocationResult
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineInvocationRequest, EngineInvocationResult } from '@scu/shared-types';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CostLimitService } from '../cost/cost-limit.service';
import { getEngineCost } from '../cost/pricing';
import { createHash } from 'crypto';

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
    private readonly auditLogService: AuditLogService,
    private readonly costLimit: CostLimitService
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

    const jobId = req.metadata?.jobId || `manual_${started}`;
    const projectId = req.metadata?.projectId || 'default_project';
    const attempt = (req.metadata?.attempt as number) || 0;

    // 0.1 成本上限 Pre-Check (Budget Guard) & 重试上限 (Retry Guard)
    // 根据《项目成本控制说明书》：重试次数必须 <= 3
    if (attempt > 3) {
      const error = `RETRY_LIMIT_EXCEEDED: Job ${jobId} attempt ${attempt} exceeds max allowed (3)`;
      this.logger.error(error);
      throw new Error(error);
    }

    const isVerification = !!req.metadata?.isVerification;

    // 0.1 入口约束: 验证只能在 Gate 模式内部调用
    if (isVerification && process.env.GATE_MODE !== '1') {
      const error = 'SECURITY_VIOLATION: isVerification=true is only allowed when GATE_MODE=1';
      this.logger.error(error);
      throw new BadRequestException(error);
    }

    if (req.engineKey.includes('shot_render')) {
      if (!isVerification) {
        await this.costLimit.preCheckOrThrow({
          jobId,
          engineKey: req.engineKey,
          plannedOutputs: 1,
          estimatedCostUsd: 0.02,
        });
      } else {
        const verificationCostCapUsd = Number(process.env.VERIFICATION_COST_CAP_USD ?? '1');
        await this.costLimit.preCheckVerificationOrThrow({
          jobId,
          engineKey: req.engineKey,
          capUsd: verificationCostCapUsd,
        });
      }
    }

    try {
      let output: TOutput;
      let engineResult: EngineInvokeResult | undefined;

      // 0.5. 优先检查内存注册表 (In-Memory Override)
      const memoryAdapter = this.memoryRegistry.findAdapter(req.engineKey);
      if (memoryAdapter) {
        const engineInput: EngineInvokeInput = {
          engineKey: req.engineKey,
          jobType: this.inferJobTypeFromEngineKey(req.engineKey),
          payload: { ...req.payload, engineVersion: req.engineVersion },
          context: { ...req.metadata },
        };
        engineResult = await memoryAdapter.invoke(engineInput);

        if (engineResult.status === 'SUCCESS') {
          output = engineResult.output as TOutput;
        } else {
          throw new Error(engineResult.error?.message || 'Memory Adapter execution failed');
        }
      } else {
        // 1. 查找引擎描述符 (DB)
        let descriptor = this.engineRegistry.find(req.engineKey, req.engineVersion);

        // 1.1 检查禁用列表
        if (isGateMode && descriptor && disableKeys.includes(descriptor.engineKey)) {
          this.logger.warn(`Engine ${descriptor.engineKey} disabled by Gate`);
          fallbackReason = `Engine ${descriptor.engineKey} disabled by Gate`;
          descriptor = null;
        }

        if (!descriptor) {
          throw new Error(`Engine ${req.engineKey}@${req.engineVersion ?? 'default'} not registered or disabled`);
        }

        if (descriptor.mode === 'local') {
          const adapter = this.moduleRef.get<EngineAdapter>(descriptor.adapterToken, { strict: false });
          if (!adapter) throw new Error(`Adapter ${descriptor.adapterToken} not found`);

          const engineInput: EngineInvokeInput = {
            engineKey: req.engineKey,
            jobType: this.inferJobTypeFromEngineKey(req.engineKey),
            payload: { ...req.payload, engineVersion: req.engineVersion },
            context: { ...req.metadata },
          };
          engineResult = await adapter.invoke(engineInput);

          if (engineResult.status === 'SUCCESS') {
            output = engineResult.output as TOutput;
          } else {
            throw new Error(engineResult.error?.message || 'Engine execution failed');
          }
        } else {
          // HTTP adapter
          const engineInput: EngineInvokeInput = {
            engineKey: req.engineKey,
            jobType: this.inferJobTypeFromEngineKey(req.engineKey),
            payload: { ...req.payload, engineVersion: req.engineVersion },
            context: { ...req.metadata },
          };
          engineResult = await this.httpEngineAdapter.invoke(engineInput);

          if (engineResult.status === 'SUCCESS') {
            output = engineResult.output as TOutput;
          } else {
            throw new Error(engineResult.error?.message || 'Engine execution failed');
          }
        }
      }

      // 0.9 成本上限 Post-Apply (Billing & Guard)
      if (req.engineKey.includes('shot_render') && engineResult?.status === 'SUCCESS') {
        const audit = (engineResult.output as any)?.audit_trail;
        const provider = audit?.providerSelected || 'unknown';
        const costUsd = getEngineCost(req.engineKey, provider, { imageCount: 1 });
        const attempt = (req.metadata?.attempt as number) || 0;
        const idempotencyKey = `${jobId}:${req.engineKey}:${attempt}`;

        if (!isVerification) {
          await this.costLimit.postApplyUsage({
            jobId,
            projectId,
            engineKey: req.engineKey,
            pricingKey: audit?.pricing_key || 'UNKNOWN',
            actualOutputs: 1,
            gpuSeconds: engineResult.metrics?.gpuSeconds || 0,
            costUsd,
            attempt,
            metadata: { traceId: req.metadata?.traceId, provider },
          });
        } else {
          await this.costLimit.postApplyVerificationUsageNoLedger({
            jobId,
            engineKey: req.engineKey,
            costUsd,
            metadata: { traceId: req.metadata?.traceId, provider, isVerification: true },
          });
        }
      }

      const finalResult: EngineInvocationResult<TOutput> = {
        success: true,
        selectedEngineKey: req.engineKey,
        fallbackReason,
        output,
        metrics: {
          latencyMs: Date.now() - started,
          usage: {
            inputTokens: engineResult?.metrics?.tokensIn || 0,
            outputTokens: engineResult?.metrics?.tokensOut || 0,
            totalTokens: (engineResult?.metrics?.tokensUsed as number) || 0,
            costUsd: (engineResult?.metrics?.costUsd as number) || 0,
          },
          ...(engineResult?.metrics || {}),
        },
      };

      await this.logInvocation(req, finalResult);
      return finalResult;
    } catch (e: unknown) {
      const errorObj = e as any;
      const result: EngineInvocationResult<TOutput> = {
        success: false,
        selectedEngineKey: req.engineKey,
        fallbackReason,
        error: {
          code: errorObj?.code ?? 'ENGINE_CALL_FAILED',
          message: errorObj?.message ?? 'Engine invocation failed',
          details: { ...req.metadata, ...(errorObj?.details || {}) },
        },
        metrics: { latencyMs: Date.now() - started },
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
