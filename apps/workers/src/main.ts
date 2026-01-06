/**
 * Worker 主入口文件
 * 
 * 功能：
 * 1. 连接数据库
 * 2. 注册 Worker 节点
 * 3. 启动心跳循环
 * 4. 启动 Job 处理循环
 */

/// <reference path="./types/config.d.ts" />
import { PrismaClient, Prisma } from 'database';
import { env } from '@scu/config';
import { ApiClient } from './api-client';
import { EngineAdapterClient } from './engine-adapter-client';
import { EngineHubClient } from './engine-hub-client';
import { EngineInvokeInput, EngineInvokeResult, EngineInvokeStatus } from '@scu/shared-types';
import {
  EngineInvocationRequest,
  EngineInvocationResult,
  NovelAnalysisEngineInput,
  NovelAnalysisEngineOutput,
} from '@scu/shared-types';
import {
  processCE06Job,
  processCE03Job,
  processCE04Job,
  processShotRenderJob,
  processCE01Job,
  processGenericCEJob
} from './ce-core-processor';
import { processVideoRenderJob as processVideoRenderJobImpl } from './video-render.processor';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.databaseUrl,
    },
  },
  log: env.isDevelopment ? ['error', 'warn'] : ['error'],
});

/**
 * Worker 使用的统一 API 基础地址
 * 优先 env.apiUrl，兜底 http://localhost:3000
 */
const apiBaseUrl = env.apiUrl || 'http://localhost:3000';

if (!apiBaseUrl) {
  throw new Error(
    '[Worker] 启动失败：apiBaseUrl 为空，请检查 env.apiUrl / API_HOST / API_PORT'
  );
}

const apiClient = new ApiClient(
  apiBaseUrl.replace(/\/api\/?$/, ''),
  env.workerApiKey,
  env.workerApiSecret,
  env.workerId,
);

let isRunning = false;
let tasksRunning = 0;

// 创建 EngineAdapterClient 实例（Worker 端使用，保留用于向后兼容）
const engineAdapterClient = new EngineAdapterClient(prisma);

// 创建 EngineHubClient 实例（Stage2: 使用新的统一接口）
const engineHubClient = new EngineHubClient(prisma);

/**
 * 注册 Worker 节点
 */
async function registerWorker(): Promise<void> {
  console.log('[Worker] 正在注册 Worker 节点...');
  console.log(`[Worker] Worker ID: ${env.workerId}`);
  console.log(`[Worker] Worker Name: ${env.workerName}`);
  console.log(`[Worker] API URL: ${apiBaseUrl}`);
  console.log(`[Worker] Database URL: ${env.databaseUrl ? env.databaseUrl.substring(0, 30) + '...' : '未配置'}`);
  console.log(`[Worker] JOB_WORKER_ENABLED: ${env.jobWorkerEnabled}`);
  if (!env.workerApiKey || !env.workerApiSecret) {
    console.warn('[Worker] ⚠️  WARNING: WORKER_API_KEY or WORKER_API_SECRET not configured!');
    console.warn('[Worker] ⚠️  Worker will not be able to authenticate with API server.');
    console.warn('[Worker] ⚠️  Please set WORKER_API_KEY and WORKER_API_SECRET environment variables.');
  } else {
    console.log(`[Worker] API Key: ${env.workerApiKey.substring(0, 10)}... (configured)`);
    console.log(`[Worker] API Secret: ${env.workerApiSecret ? 'SET' : 'NOT SET'}`);
    console.log(`[Worker] DB URL: ${process.env.DATABASE_URL?.replace(/:[^:]+@/, ':***@')}`);

    // Test DB Connection
    try {
      console.log('[Worker] Testing DB Connection...');
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Worker] DB Connection Verified');
    } catch (error: any) {
      console.error(`[Worker] DB Connection Failed:`, error.message);
      process.exit(1);
    }
  }

  try {
    // 通过 API 注册 Worker
    await apiClient.registerWorker({
      workerId: env.workerId,
      name: env.workerName,
      capabilities: {
        supportedJobTypes: [
          'NOVEL_ANALYSIS',
          'VIDEO_RENDER',
          'CE01_REFERENCE_SHEET',
          'CE02_IDENTITY_LOCK',
          'CE03_VISUAL_DENSITY',
          'CE04_VISUAL_ENRICHMENT',
          'CE05_DIRECTOR_CONTROL',
          'CE06_NOVEL_PARSING',
          'CE07_MEMORY_UPDATE',
          'SHOT_RENDER',
          'VIDEO_RENDER',
        ],
        supportedModels: [],
        maxBatchSize: 1,
      },
    });

    console.log('[Worker] ✅ Worker 注册成功');
  } catch (error: any) {
    console.error('[Worker] ❌ Worker 注册失败:', error.message);
    throw error;
  }
}

/**
 * 发送心跳
 */
async function sendHeartbeat(): Promise<void> {
  try {
    // WorkerStatus 枚举值：online, idle, busy, offline
    const status = tasksRunning > 0 ? 'busy' : 'idle';
    await apiClient.heartbeat({
      workerId: env.workerId,
      status,
      tasksRunning,
    });
    if (tasksRunning === 0) {
      // 静默心跳，避免日志过多
    }
  } catch (error: any) {
    console.error('[Worker] ❌ 心跳发送失败:', error.message);
  }
}

/**
 * 处理单个 Job
 */
/**
 * 结构化日志输出函数
 */
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    traceId: data.traceId || data.job?.traceId || data.payload?.traceId,
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
 * Job 类型定义（从 API 返回）
 */
type JobFromApi = {
  id: string;
  type: string;
  payload: any;
  taskId: string;
  shotId?: string | null;
  projectId?: string | null;
};

/**
 * S3-A.3 阶段 2：构建 EngineInvokeInput（用于 NOVEL_ANALYSIS / NOVEL_ANALYSIS_HTTP）
 * 统一处理逻辑，支持现有 NOVEL_ANALYSIS 和新增 NOVEL_ANALYSIS_HTTP
 */
function buildEngineInvokeInputForNovelAnalysis(job: JobFromApi): EngineInvokeInput {
  const payload = job.payload || {};

  return {
    jobType: job.type, // 支持 NOVEL_ANALYSIS / NOVEL_ANALYSIS_HTTP
    engineKey: payload.engineKey || undefined, // 可选：由 EngineRegistry 决定默认引擎
    payload: {
      ...payload,
      jobId: job.id,
      projectId: job.projectId,
      taskId: job.taskId,
      // 这里可以顺手塞 novelSourceId / text 等业务字段，保持与现有 NOVEL_ANALYSIS 保持一致
      novelSourceId: payload.novelSourceId,
    },
    context: {
      projectId: job.projectId ?? undefined,
      taskId: job.taskId,
      jobId: job.id,
      shotId: job.shotId ?? undefined,
      // 预留：episodeId / sceneId / seasonId 等，将来可以补
    },
  };
}

/**
 * S3-A.3 阶段 2：统一处理 EngineInvokeResult 并上报 Job 状态
 * 复用现有逻辑，标准化处理 SUCCESS / FAILED / RETRYABLE 三种状态
 */
async function handleEngineResultAndReport(
  job: JobFromApi,
  engineResult: EngineInvokeResult,
): Promise<void> {
  if (engineResult.status === 'SUCCESS' as EngineInvokeStatus) {
    await apiClient.reportJobResult({
      jobId: job.id,
      status: 'SUCCEEDED',
      result: engineResult.output ?? null,
      metrics: engineResult.metrics ?? undefined,
    });
  } else if (engineResult.status === 'RETRYABLE' as EngineInvokeStatus) {
    await apiClient.reportJobResult({
      jobId: job.id,
      status: 'FAILED',
      error: engineResult.error ?? { message: 'RETRYABLE error without details' },
      retryable: true,
    });
  } else {
    await apiClient.reportJobResult({
      jobId: job.id,
      status: 'FAILED',
      error: engineResult.error ?? { message: 'FAILED without details' },
    });
  }
}

async function processJob(job: JobFromApi): Promise<void> {
  const jobStartTime = Date.now();
  const workerId = 'worker-main'; // 【假设】Worker ID，实际应从环境变量或配置获取

  // 记录 Job 处理开始日志
  logStructured('info', {
    action: 'JOB_PROCESSING_START',
    jobId: job.id,
    jobType: job.type,
    workerId,
    projectId: job.projectId || job.payload?.projectId,
  });

  tasksRunning++;

  try {
    // Stage13: CE Core Layer - 处理 CE06/CE03/CE04/CE01 等 Job
    // 优先匹配特定处理器，否则走通用处理器
    if (job.type === 'CE04_VISUAL_ENRICHMENT') {
      const result = await processCE04Job(prisma, { ...job, projectId: job.projectId || '' }, engineHubClient, apiClient);
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result,
      });
      return;
    } else if (job.type === 'CE03_VISUAL_DENSITY') {
      const result = await processCE03Job(prisma, { ...job, projectId: job.projectId || '' }, engineHubClient, apiClient);
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result,
      });
      return;
    } else if (job.type.startsWith('CE')) {
      const result = await processGenericCEJob(prisma, job as any, engineHubClient, apiClient);
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result,
      });
      return;
    }

    // Stage2: 使用 Engine Hub 统一接口处理 NOVEL_ANALYSIS
    if (job.type === 'NOVEL_ANALYSIS' || job.type === 'NOVEL_ANALYSIS_HTTP' || (job.type as any) === 'NOVEL_ANALYZE_CHAPTER') {
      const payload = job.payload || {};

      // 构造 EngineInvocationRequest
      const engineReq: EngineInvocationRequest<NovelAnalysisEngineInput> = {
        engineKey: payload.engineKey || 'novel_analysis',
        engineVersion: payload.engineVersion || 'default',
        payload: {
          novelSourceId: payload.novelSourceId,
          projectId: job.projectId || payload.projectId || '',
          options: {
            segmentationMode: payload.segmentationMode || 'auto',
          },
        },
        metadata: {
          jobId: job.id,
          taskId: job.taskId,
          projectId: job.projectId || payload.projectId || '',
          traceId: payload.traceId,
        },
      };

      // 调用 Engine Hub
      const result = await engineHubClient.invoke<NovelAnalysisEngineInput, NovelAnalysisEngineOutput>(engineReq);

      const duration = Date.now() - jobStartTime;

      // 处理结果
      if (!result.success || !result.output) {
        // 回报告错：保持现有 Job 报告协议
        logStructured('warn', {
          action: 'JOB_PROCESSING_FAILED',
          jobId: job.id,
          jobType: job.type,
          workerId,
          error: result.error?.message || 'Engine execution failed',
          errorCode: result.error?.code,
          durationMs: duration,
        });

        await apiClient.reportJobResult({
          jobId: job.id,
          status: 'FAILED',
          error: result.error || { message: 'Engine execution failed', code: 'ENGINE_CALL_FAILED' },
        });
        return;
      }

      // 成功：写库逻辑已经在 NovelAnalysisLocalAdapterWorker 内部完成
      // 这里只需要上报成功结果
      logStructured('info', {
        action: 'JOB_PROCESSING_SUCCESS',
        jobId: job.id,
        jobType: job.type,
        workerId,
        durationMs: duration,
        metrics: result.metrics,
      });

      // 注意：NovelAnalysisLocalAdapterWorker 返回的是 stats，不是完整的 analyzed 结构
      // 为了保持兼容，我们上报 output 本身（包含 stats）
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result.output, // output 包含 stats（seasonsCount, episodesCount, scenesCount, shotsCount）
        metrics: result.metrics,
      });
      return;
    }

    // 将来扩展 SHOT_RENDER_HTTP 时再按同样方式添加
    // else if (job.type === 'SHOT_RENDER_HTTP') { ... }

    // Stage 4: SHOT_RENDER Handler
    if (job.type === 'SHOT_RENDER' || job.type === 'SHOT_RENDER_HTTP') {
      const result = await processShotRenderJob(prisma, { ...job, projectId: job.projectId || '', shotId: job.shotId || undefined }, engineHubClient, apiClient);
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result
      });
      return;
    }

    // Stage 8: VIDEO_RENDER Handler
    if (job.type === 'VIDEO_RENDER') {
      const result = await processVideoRenderJobImpl(prisma, { ...job, projectId: job.projectId || '' }, apiClient);
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result
      });
      return;
    }



    // 其它 JobType 走现有逻辑（保持不变）
    throw new Error(`Unsupported job type: ${job.type}`);
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;

    // 记录 Job 处理失败日志
    logStructured('error', {
      action: 'JOB_PROCESSING_FAILED',
      jobId: job.id,
      jobType: job.type,
      workerId,
      error: error?.message || 'Unknown error',
      errorStack: error?.stack,
      durationMs: duration,
    });

    // TODO: Audit hook (non-HTTP): once worker DI is wired, call AuditService.log with job context

    try {
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'FAILED',
        errorMessage: error.message || 'Unknown error',
      });
    } catch (reportError: any) {
      logStructured('error', {
        action: 'JOB_REPORT_FAILED',
        jobId: job.id,
        error: reportError?.message || 'Unknown error',
      });
    }
  } finally {
    tasksRunning--;
  }
}

/**
 * 轮询并处理 Job
 */
async function pollAndProcessJobs(): Promise<void> {
  console.log('[Worker DEBUG] pollAndProcessJobs called');
  try {
    const job = await apiClient.getNextJob(env.workerId);

    if (job) {
      // 异步处理 Job，不阻塞轮询
      processJob(job).catch((error) => {
        console.error(`[Worker] ❌ processJob 异常:`, error);
      });
    }
  } catch (error: any) {
    console.error(`[Worker] ❌ 轮询 Job 失败:`, error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('Super Caterpillar Worker');
  console.log('========================================\n');

  // 检查环境变量
  if (!env.databaseUrl) {
    console.error('[Worker] ❌ DATABASE_URL 未配置');
    process.exit(1);
  }

  if (!env.workerApiKey || !env.workerApiSecret) {
    console.warn('[Worker] ⚠️  API Key/Secret 未配置，Worker 可能无法通过 HMAC 认证');
  }

  // 检查 jobWorkerEnabled
  if (!env.jobWorkerEnabled) {
    console.warn('[Worker] ⚠️  JOB_WORKER_ENABLED=false，Worker 将不会处理 Job');
  }

  try {
    // 连接数据库
    console.log('[Worker] 正在连接数据库...');
    await prisma.$connect();
    console.log('[Worker] ✅ 数据库连接成功');

    // 注册 Worker
    await registerWorker();

    isRunning = true;

    // 启动心跳循环（每 5 秒）
    setInterval(() => {
      if (isRunning) {
        sendHeartbeat();
      }
    }, 5000);

    // 启动 Job 轮询循环
    setInterval(() => {
      console.log(`[Probe] R=${isRunning} E=${env.jobWorkerEnabled}`);
      if (isRunning && env.jobWorkerEnabled) {
        pollAndProcessJobs();
      }
    }, env.workerPollInterval);

    // 立即发送一次心跳
    await sendHeartbeat();

    // 立即开始轮询（如果启用）
    if (env.jobWorkerEnabled) {
      await pollAndProcessJobs();
    }

    console.log('\n[Worker] ✅ Worker 启动成功');
    console.log(`[Worker] 心跳间隔: 5 秒`);
    console.log(`[Worker] Job 轮询间隔: ${env.workerPollInterval}ms`);
    console.log(`[Worker] Job Worker 启用状态: ${env.jobWorkerEnabled ? '已启用' : '已禁用'}\n`);

    // 优雅退出处理
    process.on('SIGINT', () => {
      console.log('\n[Worker] 收到 SIGINT，正在关闭...');
      shutdown();
    });

    process.on('SIGTERM', () => {
      console.log('\n[Worker] 收到 SIGTERM，正在关闭...');
      shutdown();
    });
  } catch (error: any) {
    console.error('[Worker] ❌ Worker 启动失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
async function shutdown() {
  isRunning = false;
  console.log('[Worker] 正在断开数据库连接...');
  await prisma.$disconnect();
  console.log('[Worker] ✅ Worker 已关闭');
  process.exit(0);
}

// 启动 Worker
main().catch((error) => {
  console.error('[Worker] ❌ 致命错误:', error);
  process.exit(1);
});

