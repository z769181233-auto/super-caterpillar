/**
 * EngineAdapterClient
 * Worker 端使用 EngineAdapter 的客户端
 * 
 * 【重要】该文件只在 Worker 进程中使用，不可被 API 端 import。
 * Worker 端与 API 端完全解耦，Worker 端的 Adapter 注册来源只在 Worker 侧代码范围内。
 * 
 * 注意：Worker 是独立进程，不能使用 NestJS 依赖注入
 * 因此这里创建一个简单的 Adapter 实例，直接调用处理逻辑
 */

import { PrismaClient } from 'database';
import axios from 'axios';
import { env } from '@scu/config';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import {
  mapCE06OutputToProjectStructure,
  applyAnalyzedStructureToDatabase,
} from './novel-analysis-processor';
import { VisualDensityLocalAdapterWorker } from './adapters/visual-density.adapter';
import { VisualEnrichmentLocalAdapterWorker } from './adapters/visual-enrichment.adapter';
import { CE06EngineSelector } from '@scu/engines/ce06/selector';
import { CE06Input } from '@scu/engines/ce06/types';
import { createHash } from 'crypto';

/**
 * 计算输入/输出的哈希值（用于审计）
 */
function hashData(data: any): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
}

/**
 * 结构化日志输出函数（与 Worker 端保持一致）
 */
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const logMessage = JSON.stringify(logEntry);
  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}

/**
 * NovelAnalysisLocalAdapter（Worker 端版本）
 * 将现有的 NOVEL_ANALYSIS 本地处理逻辑包装为 EngineAdapter
 * 注意：与 API 端的 NovelAnalysisLocalAdapter 逻辑相同，但不依赖 NestJS
 */
export class NovelAnalysisLocalAdapterWorker implements EngineAdapter {
  public readonly name = 'default_novel_analysis';
  private readonly selector = new CE06EngineSelector();

  constructor(private readonly prisma: PrismaClient) { }

  /**
   * 检查是否支持指定的引擎标识
   */
  supports(engineKey: string): boolean {
    return engineKey === 'default_novel_analysis' || engineKey === 'local_novel_analysis' || engineKey === 'ce06_novel_parsing';
  }

  /**
   * 调用引擎执行 NOVEL_ANALYSIS 任务
   * 注意：保持与原有 processNovelAnalysisJob 相同的输入/输出结构
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();

    try {
      // 验证 JobType
      if (input.jobType !== 'NOVEL_ANALYSIS' && input.jobType !== 'CE06_NOVEL_PARSING') {
        throw new Error(`Unsupported job type: ${input.jobType}`);
      }

      // 从 context 或 payload 中获取 projectId
      const projectId = input.context.projectId || input.payload.projectId;
      if (!projectId) {
        throw new Error('NOVEL_ANALYSIS Job 缺少 projectId');
      }

      // 从 payload 中获取 novelSourceId（可选）
      const novelSourceId = input.payload.novelSourceId;

      // 查找原始小说文本
      let novelSource: any | null = null;

      if (novelSourceId) {
        novelSource = await this.prisma.novelSource.findUnique({
          where: { id: novelSourceId },
        });
      } else {
        // 没指定则取该项目最新的一条
        novelSource = await this.prisma.novelSource.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' as const },
        });
      }

      if (!novelSource || !novelSource.rawText) {
        throw new Error('未找到小说源数据或 rawText 为空');
      }

      const rawText: string = novelSource.rawText as string;

      const parseStartTime = Date.now();

      // S3-A: 尝试使用三态选择器 (Real/Replay/Legacy)
      const ce06Input: CE06Input = {
        structured_text: rawText,  // Stage-3-B: SSOT 要求字段
        novelSourceId: novelSource.id,
        projectId,
        rawText,  // 向后兼容
        options: {
          model: input.payload.engineVersion || 'gemini-2.0-flash',
        }
      };

      const selectedOutput = await this.selector.invoke(ce06Input);
      let structure: any;
      let engineInfo = { key: 'legacy_stub', version: '1.0' };

      if (selectedOutput) {
        // 使用新引擎结果
        structure = mapCE06OutputToProjectStructure(projectId, selectedOutput);
        engineInfo = {
          key: (selectedOutput as any).engineInfo?.key || 'ce06_engine',
          version: (selectedOutput as any).engineInfo?.version || '1.0'
        };
      } else {
        // 使用 Legacy Stub (Legacy 模式或选择器返回 null)
        // @ts-ignore
        const { basicTextSegmentation } = require('./novel-analysis-processor');
        structure = basicTextSegmentation(rawText, projectId);
      }

      const parseDuration = selectedOutput ? ((selectedOutput as any).performance?.latencyMs || (Date.now() - parseStartTime)) : (Date.now() - parseStartTime);

      // 记录解析完成日志
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_PARSED',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        stats: structure.stats,
        adapter: this.name,
        engineKey: engineInfo.key,
        parsingDurationMs: parseDuration,
      });

      const writeStartTime = Date.now();

      // 记录写库开始日志
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_WRITE_START',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        stats: structure.stats,
        adapter: this.name,
      });

      // S3-B Fine-Tune: 落库（使用增强后的 applyAnalyzedStructureToDatabase 函数）
      const applyResult = await applyAnalyzedStructureToDatabase(this.prisma, structure);
      const writtenStructure = structure; // 已经更新了结构

      const writeDuration = Date.now() - writeStartTime;
      const totalDuration = Date.now() - startTime;

      // S3-A: 写入 AuditLog 和 CostLedger (如果不是 LEGACY_STUB 模式)
      if (selectedOutput) {
        const jobId = input.payload.jobId || 'unknown';
        const inputHash = hashData(ce06Input);
        const outputHash = hashData(selectedOutput);

        // 写入审计日志 (直接通过 DB)
        await this.prisma.auditLog.create({
          data: {
            action: 'CE06_NOVEL_ANALYSIS_COMPLETE',
            resourceType: 'PROJECT',
            resourceId: projectId,
            details: {
              engineKey: engineInfo.key,
              engineVersion: engineInfo.version,
              inputHash,
              outputHash,
              latencyMs: parseDuration,
              tokensIn: (selectedOutput as any).performance?.tokensIn || (selectedOutput as any).billing_usage?.promptTokens || 0,
              tokensOut: (selectedOutput as any).performance?.tokensOut || (selectedOutput as any).billing_usage?.completionTokens || 0,
            }
          }
        });

        // Stage-3-B: 计费逻辑已由 CostLedgerService 统一处理
        // 这段旧代码保留注释供参考
        /*
        if (selectedOutput.performance.tokensOut! > 0) {
          await this.prisma.costLedger.create({
            data: {
              userId: novelSource.ownerId || 'system',
              projectId,
              jobId,
              jobType: 'NOVEL_ANALYSIS',
              engineKey: engineInfo.key,
              costAmount: selectedOutput.performance.costUsd || 0,
              billingUnit: 'tokens',
              quantity: (selectedOutput.performance.tokensIn || 0) + (selectedOutput.performance.tokensOut || 0),
              metadata: {
                model: selectedOutput.engineInfo.model
              }
            }
          }).catch(() => { }); // 幂等保护：unique(jobId, jobType) 会抛错
        }
        */
      }

      // S3-B Fine-Tune: 记录写库完成日志（包含修正统计）
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_WRITE_COMPLETE',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        writeDurationMs: writeDuration,
        totalDurationMs: totalDuration,
        stats: writtenStructure.stats,
        adapter: this.name,
      });

      // S3-A: 返回成功结果，包含完整的 analyzed 结构（用于后续 Task 输出和前端展示）
      const output = (input.jobType === 'CE06_NOVEL_PARSING' || input.engineKey === 'ce06_novel_parsing')
        ? (selectedOutput || {})
        : {
          analyzed: writtenStructure,
          stats: structure.stats,
        };

      return {
        status: 'SUCCESS' as EngineInvokeStatus,
        output,
        metrics: {
          latencyMs: parseDuration,
          tokensIn: (selectedOutput as any).performance?.tokensIn || (selectedOutput as any).billing_usage?.promptTokens || 0,
          tokensOut: (selectedOutput as any).performance?.tokensOut || (selectedOutput as any).billing_usage?.completionTokens || 0,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // 记录失败日志
      logStructured('error', {
        action: 'NOVEL_ANALYSIS_FAILED',
        jobId: input.payload.jobId || 'unknown',
        projectId: input.context.projectId || input.payload.projectId,
        error: error?.message || 'Unknown error',
        errorStack: error?.stack,
        durationMs: duration,
        adapter: this.name,
      });

      // 返回失败结果
      return {
        status: 'FAILED' as EngineInvokeStatus,
        error: {
          message: error?.message || 'Unknown error',
          code: 'NOVEL_ANALYSIS_ERROR',
          details: error?.stack,
        },
        metrics: {
          durationMs: duration,
        },
      };
    }
  }
}

/**
 * HttpEngineAdapterWorker
 * 支持通过 HTTP 调用远程引擎服务
 */
export class HttpEngineAdapterWorker implements EngineAdapter {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
    private readonly path: string = '/story/parse',
  ) { }

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${this.baseUrl}${this.path}`, input.payload, {
        timeout: 30000,
      });

      const totalDuration = Date.now() - startTime;

      return {
        status: 'SUCCESS' as EngineInvokeStatus,
        output: response.data,
        metrics: {
          durationMs: totalDuration,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        status: 'FAILED' as EngineInvokeStatus,
        error: {
          message: error?.response?.data?.message || error?.message || 'Remote engine call failed',
          code: 'REMOTE_ENGINE_ERROR',
          details: error?.response?.data || error?.stack,
        },
        metrics: {
          durationMs: duration,
        },
      };
    }
  }
}

/**
 * 简单的 Adapter 查找器（Worker 端）
 * 用于根据 engineKey 和 jobType 查找合适的 Adapter
 */
export class EngineAdapterClient {
  private adapters: Map<string, EngineAdapter> = new Map();

  constructor(private readonly prisma: PrismaClient) {
    // 注册默认的 NovelAnalysisLocalAdapter
    const novelAdapter = new NovelAnalysisLocalAdapterWorker(prisma);
    this.adapters.set(novelAdapter.name, novelAdapter);

    // 注册 CE06 适配器 (根据模式选择 Local 或 Http)
    const ce06BaseUrl = env.engineRealHttpBaseUrl || process.env.CE06_BASE_URL || 'http://localhost:8000';
    if (process.env.STAGE3_ENGINE_MODE === 'REPLAY') {
      // Replay 模式下强制使用 Local Adapter mock 数据
      this.adapters.set('ce06_novel_parsing', novelAdapter);
      console.log('[EngineAdapterClient] ce06_novel_parsing -> LocalAdapter (REPLAY mode)');
    } else {
      const ce06Adapter = new HttpEngineAdapterWorker('ce06_novel_parsing', ce06BaseUrl, '/story/parse');
      this.adapters.set(ce06Adapter.name, ce06Adapter);
    }

    // 注册 CE07 Http 适配器
    const ce07Adapter = new HttpEngineAdapterWorker('ce07_memory_update', ce06BaseUrl, '/memory/update');
    this.adapters.set(ce07Adapter.name, ce07Adapter);

    // [P2] 注册 CE03 视觉密度适配器
    const ce03Adapter = new VisualDensityLocalAdapterWorker();
    this.adapters.set(ce03Adapter.name, ce03Adapter);

    // [P2] 注册 CE04 视觉丰富度适配器
    const ce04Adapter = new VisualEnrichmentLocalAdapterWorker();
    this.adapters.set(ce04Adapter.name, ce04Adapter);

    // [P2] 注册默认渲染器适配器 (自引用 processor)
    this.adapters.set('default_shot_render', {
      name: 'default_shot_render',
      supports: (k) => k === 'default_shot_render',
      invoke: async (input) => {
        // 由于这只是一个适配器层，真正的 logic 已经在 ce-core-processor.ts 中由 main.ts 分发了。
        // 但为了 EngineHubClient.invoke 能够正常工作，我们需要在这里也注册它。
        throw new Error('Direct invocation of default_shot_render via adapter is not recommended. Use dedicated processor.');
      }
    });
  }

  /**
   * 查找适配器
   */
  findAdapter(engineKey?: string, jobType?: string): EngineAdapter {
    // 1. 如果指定了 engineKey，优先查找
    if (engineKey) {
      const adapter = this.adapters.get(engineKey);
      if (adapter && adapter.supports(engineKey)) {
        return adapter;
      }
    }

    // 2. 根据 jobType 查找默认适配器
    if (jobType === 'NOVEL_ANALYSIS') {
      const adapter = this.adapters.get('default_novel_analysis');
      if (adapter) {
        return adapter;
      }
    }

    if (jobType === 'SHOT_RENDER') {
      const adapter = this.adapters.get('default_shot_render');
      if (adapter) {
        return adapter;
      }
    }

    throw new Error(
      `No engine adapter found for engineKey="${engineKey || 'undefined'}" jobType="${jobType || 'undefined'}"`,
    );
  }

  /**
   * 调用引擎
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const adapter = this.findAdapter(input.engineKey, input.jobType);
    return adapter.invoke(input);
  }
}

