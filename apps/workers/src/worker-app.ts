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
import { env, config as appConfig } from '@scu/config';

/**
 * 运行时 Profile 配置 (内联版 - 解决 P1-B Gate 跨包导入死结)
 */
export function getRuntimeConfig() {
  const isSafeMode = process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true';
  return {
    jobMaxInFlight: isSafeMode ? 2 : (env as any).jobMaxInFlight || 10,
    nodeMaxOldSpaceMb: isSafeMode ? 4096 : (env as any).nodeMaxOldSpaceMb || 2048,
    jobWaveSize: isSafeMode ? 1 : (env as any).jobWaveSize || 5,
  };
}

import { engineLimiter } from './concurrency/engine-limiter';
import { JobExecutor } from './executor/executor';

let jobExecutor: JobExecutor;
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
  processGenericCEJob,
} from './ce-core-processor';
import {
  mapCE06OutputToProjectStructure,
  applyAnalyzedStructureToDatabase,
  processNovelAnalysisJob,
} from './novel-analysis-processor';
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
 * Worker CLI参数解析(支持 --workerId=xxx 和 --workerId xxx)
 */
function readArg(name: string): string | undefined {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const eqPrefix = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith(eqPrefix)) return a.slice(eqPrefix.length).trim() || undefined;
    if (a === `--${name}`) return argv[i + 1]?.trim() || undefined;
  }
  return undefined;
}

const workerIdFromCli = readArg('workerId');
const workerIdFromEnv = process.env.WORKER_ID || process.env.WORKER_NAME;
const workerId = workerIdFromCli || workerIdFromEnv || env.workerId;

console.log(
  `[WorkerConfig] workerId=${workerId} (source=${workerIdFromCli ? 'cli' : workerIdFromEnv ? 'env(WORKER_ID/NAME)' : 'config/default'})`
);

// Write PID file for HA gate / failover testing
import { writeWorkerPidFile } from './utils/pidfile';
const pidMeta = writeWorkerPidFile(workerId);
console.log(`[Worker] PID file written: ${pidMeta.file}`);

const apiUrlFromCli = readArg('apiUrl');
const apiKeyFromCli = readArg('apiKey');
const apiSecretFromCli = readArg('apiSecret');

/**
 * Worker 使用的统一 API 基础地址
 * 优先 CLI -> env.apiUrl -> 兜底 http://localhost:3000
 */
const apiBaseUrl = apiUrlFromCli || env.apiUrl || 'http://localhost:3000';
const workerApiKey = apiKeyFromCli || env.workerApiKey;
const workerApiSecret = apiSecretFromCli || env.workerApiSecret;

console.log(
  `[WorkerConfig] apiBaseUrl=${apiBaseUrl} (source=${apiUrlFromCli ? 'cli' : 'config/env'})`
);

if (!apiBaseUrl) {
  throw new Error('[Worker] 启动失败：apiBaseUrl 为空，请检查 --apiUrl / env.apiUrl');
}

const apiClient = new ApiClient(
  apiBaseUrl.replace(/\/api\/?$/, ''),
  workerApiKey,
  workerApiSecret,
  workerId
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
  console.log(`[Worker] Worker ID: ${workerId}`);
  console.log(`[Worker] Worker Name: ${env.workerName}`);
  console.log(`[Worker] API URL: ${apiBaseUrl}`);
  console.log(
    `[Worker] Database URL: ${env.databaseUrl ? env.databaseUrl.substring(0, 30) + '...' : '未配置'}`
  );
  console.log(`[Worker] JOB_WORKER_ENABLED: ${env.jobWorkerEnabled}`);
  if (!env.workerApiKey || !env.workerApiSecret) {
    console.warn('[Worker] ⚠️  WARNING: WORKER_API_KEY or WORKER_API_SECRET not configured!');
    console.warn('[Worker] ⚠️  Worker will not be able to authenticate with API server.');
    console.warn(
      '[Worker] ⚠️  Please set WORKER_API_KEY and WORKER_API_SECRET environment variables.'
    );
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
    // ✅ P1-2 HA: 添加supportedEngines配置
    const supportedEngines = (process.env.WORKER_SUPPORTED_ENGINES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // 稳定兜底:至少要把本次P1-2验证用到的引擎带上
    const supportedEnginesFinal =
      supportedEngines.length > 0 ? supportedEngines : ['default_novel_analysis'];

    console.log(`[Worker] supportedEngines=${JSON.stringify(supportedEnginesFinal)}`);

    // 通过 API 注册 Worker
    await apiClient.registerWorker({
      workerId: workerId,
      name: workerId, // 兜底使用 workerId，确保不为空
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
        supportedEngines: supportedEnginesFinal,
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
      workerId: workerId,
      status,
      tasksRunning,
      // P1-1: 上报租约能力标识
      // @ts-expect-error - P1-1 extension
      capabilities: {
        concurrency_managed: true,
        lease_supported: true,
        // P1-3: Heartbeat must include supportedEngines otherwise API might clear it
        supportedEngines:
          (process.env.WORKER_SUPPORTED_ENGINES || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean).length > 0
            ? (process.env.WORKER_SUPPORTED_ENGINES || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : ['default_novel_analysis'],
      },
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
  engineResult: EngineInvokeResult
): Promise<void> {
  if (engineResult.status === ('SUCCESS' as EngineInvokeStatus)) {
    await apiClient.reportJobResult({
      jobId: job.id,
      status: 'SUCCEEDED',
      result: engineResult.output ?? null,
      metrics: engineResult.metrics ?? undefined,
    });
  } else if (engineResult.status === ('RETRYABLE' as EngineInvokeStatus)) {
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

/**
 * 使用 JobExecutor 执行任务
 */
async function processJobWithExecutor(job: JobFromApi): Promise<void> {
  const engineKey = (job as any).engineKey || 'default';
  tasksRunning++;

  try {
    const result = await jobExecutor.execute(job.id, engineKey, async () => {
      // 内部逻辑：根据 job.type 调用不同的处理器
      if (job.type === 'CE04_VISUAL_ENRICHMENT') {
        return processCE04Job(
          prisma,
          { ...job, projectId: job.projectId || '' },
          engineHubClient,
          apiClient
        );
      } else if (job.type === 'CE03_VISUAL_DENSITY') {
        return processCE03Job(
          prisma,
          { ...job, projectId: job.projectId || '' },
          engineHubClient,
          apiClient
        );
      } else if (job.type === 'CE06_NOVEL_PARSING') {
        return processCE06Job(
          prisma,
          { ...job, projectId: job.projectId || '' },
          engineHubClient,
          apiClient
        );
      } else if (job.type === 'SHOT_RENDER' || job.type === 'SHOT_RENDER_HTTP') {
        return processShotRenderJob(
          prisma,
          { ...job, projectId: job.projectId || '', shotId: job.shotId || undefined },
          engineHubClient,
          apiClient
        );
      } else if (job.type === 'VIDEO_RENDER') {
        return processVideoRenderJobImpl(
          prisma,
          { ...job, projectId: job.projectId || '' },
          apiClient
        );
      } else if (job.type.startsWith('CE')) {
        return processGenericCEJob(prisma, job as any, engineHubClient, apiClient);
      } else if (
        job.type === 'NOVEL_ANALYSIS' ||
        job.type === 'NOVEL_ANALYSIS_HTTP' ||
        (job.type as any) === 'NOVEL_ANALYZE_CHAPTER'
      ) {
        return processNovelAnalysisJob(
          prisma,
          { ...job, projectId: job.projectId || '' },
          apiClient
        );
        const payload = job.payload || {};
        const engineReq: EngineInvocationRequest<NovelAnalysisEngineInput> = {
          engineKey: payload.engineKey || 'novel_analysis',
          engineVersion: payload.engineVersion || 'default',
          payload: {
            novelSourceId: payload.novelSourceId,
            projectId: job.projectId || payload.projectId || '',
            options: { segmentationMode: payload.segmentationMode || 'auto' },
          },
          metadata: {
            jobId: job.id,
            taskId: job.taskId,
            projectId: job.projectId || payload.projectId || '',
            traceId: payload.traceId,
          },
        };
        const res = await engineHubClient.invoke<
          NovelAnalysisEngineInput,
          NovelAnalysisEngineOutput
        >(engineReq);
        if (!res.success) throw res.error || new Error('Engine execution failed');
        return res.output;
      }
      throw new Error(`Unsupported job type: ${job.type}`);
    });

    // 处理回执
    if (result.success) {
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'SUCCEEDED',
        result: result.output,
      });
    } else {
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'FAILED',
        error: result.error || { message: 'Execution failed' },
      });
    }
  } catch (error: any) {
    logStructured('error', {
      action: 'JOB_EXECUTOR_UNCAUGHT_ERROR',
      jobId: job.id,
      error: error.message,
    });
  } finally {
    tasksRunning--;
  }
}

/**
 * 轮询并处理 Job
 */
async function pollAndProcessJobs(): Promise<void> {
  // P1-1: 尊重本地并发上限与波次限制
  const runtimeConfig = getRuntimeConfig();
  const { jobMaxInFlight } = runtimeConfig as any;
  const jobWaveSize = (appConfig as any).jobWaveSize;

  // P1-B 审计留痕：输出运行时 Profile
  if (isRunning) {
    // 仅在轮询激活时输出一次
    // console.log(`[WorkerRuntime] ${JSON.stringify(runtimeConfig)}`);
  }
  // 强制输出一次用于 Gate 捕获
  if (tasksRunning === 0) {
    console.log(`[WorkerRuntime] ${JSON.stringify(runtimeConfig)}`);
  }

  if (tasksRunning >= (runtimeConfig as any).jobMaxInFlight) {
    if ((env as any).isDevelopment) {
      // console.log(`[Worker] Max in-flight reached (${tasksRunning}/${jobMaxInFlight}). Waiting...`);
    }
    return;
  }

  // 计算本波次还能领多少（尊重 EngineLimiter 全局令牌）
  let remainingSlots = ((runtimeConfig as any).jobMaxInFlight || 10) - tasksRunning;
  if ((env as any).concurrencyLimiterEnabled) {
    const localAvailable = (engineLimiter as any).getStats().global.available;
    remainingSlots = Math.min(remainingSlots, localAvailable);
  }
  const currentWaveLimit = Math.min(jobWaveSize, remainingSlots);

  if (currentWaveLimit <= 0) return;

  for (let i = 0; i < currentWaveLimit; i++) {
    try {
      const job = await apiClient.getNextJob(workerId);

      if (job) {
        // 异步处理 Job，不阻塞轮询 (Stage P1-1: 切换到 Executor)
        processJobWithExecutor(job).catch((error) => {
          console.error(`[Worker] ❌ processJobWithExecutor 异常:`, error);
        });
      } else {
        // 本波次没领到，提前终止
        break;
      }
    } catch (error: any) {
      console.error(`[Worker] ❌ 轮询 Job 失败:`, error.message);
      break;
    }
  }
}

/**
 * 主函数 - 完整 Worker 启动逻辑
 */
export async function startWorkerApp() {
  console.log('========================================');
  console.log('Super Caterpillar Worker');
  console.log('========================================\n');

  // 检查环境变量
  jobExecutor = new JobExecutor(apiClient);
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
