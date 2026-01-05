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
  basicTextSegmentation,
  applyAnalyzedStructureToDatabase,
} from './novel-analysis-processor';

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

  constructor(private readonly prisma: PrismaClient) { }

  /**
   * 检查是否支持指定的引擎标识
   */
  supports(engineKey: string): boolean {
    return engineKey === 'default_novel_analysis' || engineKey === 'local_novel_analysis';
  }

  /**
   * 调用引擎执行 NOVEL_ANALYSIS 任务
   * 注意：保持与原有 processNovelAnalysisJob 相同的输入/输出结构
   */
  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const startTime = Date.now();

    try {
      // 验证 JobType
      if (input.jobType !== 'NOVEL_ANALYSIS') {
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

      // 记录解析开始日志
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_START',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        novelSourceId: novelSource.id,
        rawTextLength: rawText.length,
        adapter: this.name,
      });

      const parseStartTime = Date.now();

      // 解析（使用原有的 basicTextSegmentation 函数）
      const structure = basicTextSegmentation(rawText, projectId);

      const parseDuration = Date.now() - parseStartTime;

      // 记录解析完成日志
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_PARSED',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        stats: structure.stats,
        parsingDurationMs: parseDuration,
        adapter: this.name,
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
      const writtenStructure = applyResult.finalStructure;

      const writeDuration = Date.now() - writeStartTime;
      const totalDuration = Date.now() - startTime;

      // S3-B Fine-Tune: 记录写库完成日志（包含修正统计）
      logStructured('info', {
        action: 'NOVEL_ANALYSIS_WRITE_COMPLETE',
        jobId: input.payload.jobId || 'unknown',
        projectId,
        writeDurationMs: writeDuration,
        totalDurationMs: totalDuration,
        stats: writtenStructure.stats,
        applyStats: applyResult.stats, // S3-B Fine-Tune: 包含创建/更新/删除统计
        adapter: this.name,
      });

      // S3-A: 返回成功结果，包含完整的 analyzed 结构（用于后续 Task 输出和前端展示）
      return {
        status: 'SUCCESS' as EngineInvokeStatus,
        output: {
          analyzed: writtenStructure, // 返回完整的 AnalyzedProjectStructure
          stats: structure.stats, // 同时保留 stats 用于兼容
        },
        metrics: {
          durationMs: totalDuration,
          parsingDurationMs: parseDuration,
          writeDurationMs: writeDuration,
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

    // 注册 CE06 Http 适配器
    // 物理引擎基准地址由环境变量提供
    const ce06BaseUrl = env.engineRealHttpBaseUrl || process.env.CE06_BASE_URL || 'http://localhost:8000';
    const ce06Adapter = new HttpEngineAdapterWorker('ce06_novel_parsing', ce06BaseUrl, '/story/parse');
    this.adapters.set(ce06Adapter.name, ce06Adapter);

    // 注册 CE07 Http 适配器
    const ce07Adapter = new HttpEngineAdapterWorker('ce07_memory_update', ce06BaseUrl, '/memory/update');
    this.adapters.set(ce07Adapter.name, ce07Adapter);
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

