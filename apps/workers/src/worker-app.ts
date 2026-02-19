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
import * as util from 'util';
import { PrismaClient, Prisma, JobType } from 'database';
import { env, config as appConfig } from '@scu/config';

// 生产模式门禁：强制从环境变量读取
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';

import * as os from 'os';
import { AdaptivePollStrategy } from './gate/adaptive-poll-strategy';
import { SystemLoadMonitor, LoadMetrics } from './gate/system-load-monitor';

interface RuntimeConfig {
  jobMaxInFlight: number;
  nodeMaxOldSpaceMb: number;
  jobWaveSize: number;
  throttled: boolean;
  reason: string;
  metrics?: LoadMetrics;
}

/**
 * 运行时 Profile 配置 (内联版 - 解决 P1-B Gate 跨包导入死结)
 * P6-2-1: 动态并发调优 - 基于系统负载动态调整并发上限
 */
export async function getRuntimeConfig(loadMonitor?: SystemLoadMonitor): Promise<RuntimeConfig> {
  const isSafeMode = process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true';
  const baseMaxInFlight = (env as any).jobMaxInFlight || 10;

  // 如果是安全模式，强制极低并发
  if (isSafeMode) {
    return {
      jobMaxInFlight: 2,
      nodeMaxOldSpaceMb: 4096,
      jobWaveSize: 1,
      throttled: true,
      reason: 'SAFE_MODE',
    };
  }

  // 计算系统负载 (Better metrics with loadMonitor)
  let metrics: Partial<LoadMetrics> = {};
  if (loadMonitor) {
    metrics = await loadMonitor.getMetrics();
  }

  const cpus = os.cpus().length;
  // If metrics.cpuUsagePercent is available, use it (percent / 100 * cpus) to approximate loadAvg metric scale,
  // OR just use os.loadavg() as fallback.
  // Note: cpuUsagePercent is 0-100 (overall). loadAvg is run queue length.
  // To keep existing logic `loadAvg > cpus * 0.8`, we should probably stick to os.loadavg() unless we change the condition.
  // But let's use the new metrics if available to be "Resource Aware".
  // Actually, cpuUsagePercent is more direct.
  // Let's fallback to os.loadavg() if metrics fails.
  const loadAvg =
    metrics.cpuUsagePercent !== undefined
      ? (metrics.cpuUsagePercent / 100) * cpus
      : os.loadavg()[0];

  const freeMem =
    metrics.memoryUsageMb !== undefined
      ? metrics.totalMemoryMb! - metrics.memoryUsageMb
      : os.freemem() / 1024 / 1024;

  let jobMaxInFlight = baseMaxInFlight;
  let jobWaveSize = (env as any).jobWaveSize || 5;
  let throttled = false;
  let reason = '';

  // 负载压力保护
  if (loadAvg > cpus * 0.8) {
    jobMaxInFlight = Math.max(1, Math.floor(baseMaxInFlight * 0.5));
    jobWaveSize = Math.max(1, Math.floor(jobWaveSize * 0.5));
    throttled = true;
    reason = `HIGH_LOAD(${loadAvg.toFixed(2)})`;
  }

  if (freeMem < 512) {
    jobMaxInFlight = 1;
    jobWaveSize = 1;
    throttled = true;
    reason = `LOW_MEM(${Math.round(freeMem)}MB)`;
  }

  return {
    jobMaxInFlight,
    nodeMaxOldSpaceMb: (env as any).nodeMaxOldSpaceMb || 2048,
    jobWaveSize,
    throttled,
    reason,
    metrics: { ...metrics, loadAvg, freeMem, cpus } as any,
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
import { processE2EVideoPipelineJob } from './processors/e2e-video-pipeline.processor';
import { processTimelineComposeJob } from './processors/timeline-compose.processor';
import { processTimelineRenderJob } from './processors/timeline-render.processor';
import { processTimelinePreviewJob } from './processors/timeline-preview.processor';
import { processMediaSecurityJob } from './processors/media-security.processor';
import { processStage1OrchestratorJob } from './processors/stage1-orchestrator.processor';
import { processNovelScan } from './processors/novel-scan.processor';
import { processNovelChunk } from './processors/novel-chunk.processor';
import { processIdentityLockJob } from './processors/ce02-identity-lock.processor';
import { processCE06NovelParsingJob } from './processors/ce06-novel-parsing.processor';
import { processCE02VisualDensityJob } from './processors/ce02-visual-density.processor';
import { processAudioJob } from './processors/audio.processor';
import { processEpisodeRenderJob } from './processors/episode-render.processor';
import { ProcessorContext } from './types/processor-context';

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

process.stdout.write(
  util.format(
    `[WorkerConfig] workerId=${workerId} (source=${workerIdFromCli ? 'cli' : workerIdFromEnv ? 'env(WORKER_ID/NAME)' : 'config/default'})`
  ) + '\n'
);

// Write PID file for HA gate / failover testing
import { writeWorkerPidFile } from './utils/pidfile';

const pidMeta = writeWorkerPidFile(workerId);
process.stdout.write(util.format(`[Worker] PID file written: ${pidMeta.file}`) + '\n');

const apiUrlFromCli = readArg('apiUrl');
const apiKeyFromCli = readArg('apiKey');
const apiSecretFromCli = readArg('apiSecret');

/**
 * Worker 使用的统一 API 基础地址
 * 优先 CLI -> env.apiUrl -> 兜底 http://localhost:3000
 */
const apiBaseUrl = apiUrlFromCli || env.apiUrl || 'http://127.0.0.1:3000';
const workerApiKey = apiKeyFromCli || env.workerApiKey;
const workerApiSecret =
  apiSecretFromCli ||
  process.env.HMAC_SECRET_KEY ||
  process.env.API_SECRET_KEY ||
  process.env.WORKER_API_SECRET ||
  'dev-secret';

process.stdout.write(
  util.format(
    `[WorkerConfig] apiBaseUrl=${apiBaseUrl} (source=${apiUrlFromCli ? 'cli' : 'config/env'})`
  ) + '\n'
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
let lastThrottledState: boolean | undefined = undefined; // P6-2-1: For state change detection

// 创建 EngineAdapterClient 实例（Worker 端使用，保留用于向后兼容）
const engineAdapterClient = new EngineAdapterClient(prisma);

// 创建 EngineHubClient 实例（Stage2: 使用新的统一接口）
// 创建 EngineHubClient 实例（Stage2: 使用新的统一接口）
const engineHubClient = new EngineHubClient(apiClient);

// B3-1: Adaptive Poll (Stage 2)
const adaptivePoll = new AdaptivePollStrategy({
  minInterval: 200,
  maxInterval: (env as any).workerPollInterval || 2000,
  backoffFactor: 1.5,
});

// B3-2: System Load Monitor (Stage 2)
const loadMonitor = new SystemLoadMonitor();

// [P6-0 Fix] Instantiate LocalStorageAdapter for Worker
import { LocalStorageAdapter } from '@scu/storage';
import * as path from 'path';
const storageRoot = (appConfig as any).storageRoot;
const localStorageAdapter = new LocalStorageAdapter(storageRoot);

/**
 * 注册 Worker 节点
 */
async function registerWorker(): Promise<void> {
  process.stdout.write(util.format('[Worker] 正在注册 Worker 节点...') + '\n');
  process.stdout.write(util.format(`[Worker] Worker ID: ${workerId}`) + '\n');
  process.stdout.write(util.format(`[Worker] Worker Name: ${env.workerName}`) + '\n');
  process.stdout.write(util.format(`[Worker] API URL: ${apiBaseUrl}`) + '\n');
  process.stdout.write(
    util.format(
      `[Worker] Database URL: ${env.databaseUrl ? env.databaseUrl.substring(0, 30) + '...' : '未配置'}`
    ) + '\n'
  );
  process.stdout.write(util.format(`[Worker] JOB_WORKER_ENABLED: ${env.jobWorkerEnabled}`) + '\n');
  if (!env.workerApiKey || !env.workerApiSecret) {
    process.stdout.write(
      util.format('[Worker] ⚠️  WARNING: WORKER_API_KEY or WORKER_API_SECRET not configured!') +
      '\n'
    );
    process.stdout.write(
      util.format('[Worker] ⚠️  Worker will not be able to authenticate with API server.') + '\n'
    );
    process.stdout.write(
      util.format(
        '[Worker] ⚠️  Please set WORKER_API_KEY and WORKER_API_SECRET environment variables.'
      ) + '\n'
    );
  } else {
    process.stdout.write(
      util.format(`[Worker] API Key: ${env.workerApiKey.substring(0, 10)}... (configured)`) + '\n'
    );
    process.stdout.write(
      util.format(`[Worker] API Secret: ${env.workerApiSecret ? 'SET' : 'NOT SET'}`) + '\n'
    );
    process.stdout.write(
      util.format(`[Worker] DB URL: ${process.env.DATABASE_URL?.replace(/:[^:]+@/, ':***@')}`) +
      '\n'
    );

    // Test DB Connection
    try {
      process.stdout.write(util.format('[Worker] Testing DB Connection...') + '\n');
      await prisma.$queryRaw`SELECT 1`;
      process.stdout.write(util.format('[Worker] DB Connection Verified') + '\n');
    } catch (error: any) {
      process.stderr.write(util.format(`[Worker] DB Connection Failed:`, error.message) + '\n');
      process.exit(1);
    }
  }

  try {
    // ✅ P1-2 HA: 添加supportedEngines配置
    const rawEngines = (process.env.WORKER_SUPPORTED_ENGINES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // 稳定兜底:至少要把本次P1-2验证用到的引擎带上
    let supportedEnginesFinal =
      rawEngines.length > 0
        ? rawEngines
        : [
          'default_novel_analysis',
          'ce06_novel_parsing',
          'ce03_visual_density',
          'ce04_visual_enrichment',
          'ce04_sdxl',
          'tts_standard',
          'video_render',
          'shot_render',
          'real_shot_render',
          'stage1_orchestrator',
          'timeline_render',
          'ce09_media_security',
          'ce_pipeline',
          'ce11_timeline_preview',
        ];

    // P1: Production Scrubbing - STRICT ENFORCEMENT
    if (PRODUCTION_MODE) {
      console.log(
        '[Worker] PRODUCTION_MODE=1: Scrubbing non-prod engines (default_*, mock*, gate_*)'
      );
      supportedEnginesFinal = supportedEnginesFinal.filter(
        (e) => !e.startsWith('default_') && !e.startsWith('mock') && !e.startsWith('gate_')
      );
      console.log(
        `[Worker] FINAL SUPPORTED ENGINES (PROD): ${JSON.stringify(supportedEnginesFinal)}`
      );
    }

    const supportedJobTypes = [
      JobType.NOVEL_ANALYSIS,
      JobType.VIDEO_RENDER,
      JobType.CE01_REFERENCE_SHEET,
      JobType.CE02_IDENTITY_LOCK,
      JobType.CE02_VISUAL_DENSITY,
      JobType.CE03_VISUAL_DENSITY,
      JobType.CE04_VISUAL_ENRICHMENT,
      JobType.CE05_DIRECTOR_CONTROL,
      JobType.CE06_NOVEL_PARSING,
      JobType.CE07_MEMORY_UPDATE,
      JobType.CE09_MEDIA_SECURITY,
      JobType.SHOT_RENDER,
      JobType.PIPELINE_E2E_VIDEO,
      JobType.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
      JobType.NOVEL_SCAN_TOC,
      JobType.NOVEL_CHUNK_PARSE,
      'PIPELINE_TIMELINE_COMPOSE',
      'TIMELINE_RENDER',
      'TIMELINE_PREVIEW',
      'EPISODE_RENDER',
      'CE11_SHOT_GENERATOR',
      'PIPELINE_PROD_VIDEO_V1', // Exec 1: New Prod Pipeline
      'AUDIO',
    ];

    // Registration Retry Loop
    let registered = false;
    while (!registered) {
      try {
        console.log(`[Worker] Attempting to register worker...`);
        // 通过 API 注册 Worker
        await apiClient.registerWorker({
          workerId: workerId,
          name: workerId, // 兜底使用 workerId，确保不为空
          capabilities: {
            supportedJobTypes,
            supportedModels: [],
            supportedEngines: [
              ...supportedEnginesFinal,
              'ce09_real_watermark', // Exec 3: CE09 Real
            ],
            maxBatchSize: 1,
          },
        });
        registered = true;
        console.log('[Worker] Worker registered successfully.');
      } catch (error: any) {
        console.error(`[Worker] Registration failed: ${error.message}. Retrying in 5 seconds...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    process.stdout.write(util.format('[Worker] ✅ Worker 注册成功') + '\n');
  } catch (error: any) {
    process.stderr.write(util.format('[Worker] ❌ Worker 注册失败:', error.message) + '\n');
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
    // P1-3: Heartbeat must include supportedEngines and supportedJobTypes otherwise API might clear it
    // P1-3: Heartbeat must include supportedEngines and supportedJobTypes otherwise API might clear it
    const rawEngines = (process.env.WORKER_SUPPORTED_ENGINES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let supportedEngines =
      rawEngines.length > 0
        ? rawEngines
        : [
          'default_novel_analysis',
          'ce06_novel_parsing',
          'ce03_visual_density',
          'ce04_visual_enrichment',
          'ce04_sdxl',
          'tts_standard',
          'video_render',
          'shot_render',
          'stage1_orchestrator',
          'timeline_render',
          'ce09_media_security',
          'ce_pipeline',
          'ce11_timeline_preview',
          'ce09_real_watermark',
        ];

    // P1: Production Scrubbing (Heartbeat Sync) - STRICT ENFORCEMENT
    if (PRODUCTION_MODE) {
      supportedEngines = supportedEngines.filter(
        (e) => !e.startsWith('default_') && !e.startsWith('mock') && !e.startsWith('gate_')
      );
    }

    const supportedJobTypes = [
      JobType.NOVEL_ANALYSIS,
      JobType.VIDEO_RENDER,
      JobType.CE01_REFERENCE_SHEET,
      JobType.CE02_IDENTITY_LOCK,
      JobType.CE02_VISUAL_DENSITY,
      JobType.CE03_VISUAL_DENSITY,
      JobType.CE04_VISUAL_ENRICHMENT,
      JobType.CE05_DIRECTOR_CONTROL,
      JobType.CE06_NOVEL_PARSING,
      JobType.CE07_MEMORY_UPDATE,
      JobType.SHOT_RENDER,
      JobType.PIPELINE_E2E_VIDEO,
      JobType.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
      JobType.NOVEL_SCAN_TOC,
      JobType.NOVEL_CHUNK_PARSE,
      'PIPELINE_TIMELINE_COMPOSE',
      'TIMELINE_RENDER',
      'TIMELINE_PREVIEW',
      'EPISODE_RENDER',
      'PIPELINE_PROD_VIDEO_V1',
    ];

    await apiClient.heartbeat({
      workerId: workerId,
      status,
      tasksRunning,
      // P1-1: 上报租约能力标识
      // @ts-expect-error - P1-1 extension
      capabilities: {
        concurrency_managed: true,
        lease_supported: true,
        supportedEngines,
        supportedJobTypes,
      },
    });
    if (tasksRunning === 0) {
      // 静默心跳，避免日志过多
    }
  } catch (error: any) {
    process.stderr.write(util.format('[Worker] ❌ 心跳发送失败:', error.message) + '\n');
  }
}

/**
 * 处理单个 Job
 */
// ... (omitted)

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
    process.stderr.write(util.format(logMessage) + '\n');
  } else if (level === 'warn') {
    process.stdout.write(util.format(logMessage) + '\n');
  } else {
    process.stdout.write(util.format(logMessage) + '\n');
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
  createdAt: string | Date; // P1-4: For queue time metric
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

    // P6-1-5: Billing Hook（只对 CE06_NOVEL_PARSING 计费）
    if (job.type === 'CE06_NOVEL_PARSING') {
      try {
        const charCount = job.payload?.charCount || job.payload?.totalTokens || 0;
        if (charCount > 0) {
          const amount = Math.ceil(charCount / 10000); // SCAN_CHAR 口径
          const tenantId = job.payload?.organizationId || 'default-org';

          // P6-1-5: 调用 BillingLedgerWriter（幂等）
          // Note: writeBillingLedger 暂通过直接 DB 写入（无需跨包导入）
          await prisma.billingLedger
            .create({
              data: {
                tenantId,
                traceId: job.id,
                itemType: 'JOB',
                itemId: job.id,
                chargeCode: 'SCAN_CHAR',
                amount,
                currency: 'CREDIT',
                status: 'POSTED',
                evidenceRef: `job:${job.id}`,
              },
            })
            .catch((err: any) => {
              if (err.code === 'P2002') {
                // Unique constraint - 幂等，已存在
                console.log(`[Billing] ℹ️  Ledger entry already exists (idempotent): ${job.id}`);
              } else {
                throw err;
              }
            });

          console.log(
            `[Billing] ✅ CE06 Job ${job.id}: charCount=${charCount}, amount=${amount} credits POSTED`
          );
        }
      } catch (err) {
        console.error(`[Billing] ❌ Failed to write ledger for Job ${job.id}:`, err);
        // 不阻断 Job 完成流程
      }
    }
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

async function processJobWithExecutor(job: JobFromApi): Promise<void> {
  console.log(`[S3-B Debug] Processing JOB ${job.id} TYPE: ${job.type}`);
  const engineKey = (job as any).engineKey || 'default';
  tasksRunning++;

  try {
    const result = await jobExecutor.execute(job.id, engineKey, job.createdAt, async () => {
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
      } else if (job.type === 'AUDIO') {
        return processAudioJob(prisma, { ...job, projectId: job.projectId || '' }, apiClient);
      } else if (job.type === 'PIPELINE_E2E_VIDEO') {
        return processE2EVideoPipelineJob({
          prisma,
          job: job as any,
          apiClient,
        });
      } else if (job.type === 'PIPELINE_STAGE1_NOVEL_TO_VIDEO') {
        return processStage1OrchestratorJob({
          prisma,
          job: job as any,
          apiClient,
        });
      } else if (job.type === 'PIPELINE_PROD_VIDEO_V1') {
        // EXECUTE: Production Slice V1 Logic
        // Reusing E2E processor for now, but injecting the V1 context
        return processE2EVideoPipelineJob({
          prisma,
          job: job as any,
          apiClient,
        });
      } else if (job.type === 'PIPELINE_TIMELINE_COMPOSE') {
        return processTimelineComposeJob({ prisma, job: job as any, apiClient });
      } else if (job.type === 'TIMELINE_RENDER') {
        return processTimelineRenderJob({ prisma, job: job as any, apiClient });
      } else if (job.type === 'TIMELINE_PREVIEW') {
        return processTimelinePreviewJob({ prisma, job: job as any, apiClient });
      } else if (job.type === 'EPISODE_RENDER') {
        return processEpisodeRenderJob({ prisma, job: job as any, apiClient });
      } else if (job.type === 'CE02_VISUAL_DENSITY') {
        const context: ProcessorContext = {
          prisma,
          job: { ...job, projectId: job.projectId || '' },
          apiClient,
          logger: console,
        };
        return processCE02VisualDensityJob(context);
      } else if (job.type === 'CE02_IDENTITY_LOCK') {
        return processIdentityLockJob({ prisma, job: job as any, apiClient, workerId });
      } else if (job.type === 'CE09_MEDIA_SECURITY') {
        return processMediaSecurityJob({ prisma, job: job as any, apiClient });
      } else if (job.type === 'NOVEL_SCAN_TOC') {
        return processNovelScan({ prisma, job: job as any, apiClient, workerId });
      } else if (job.type === 'NOVEL_CHUNK_PARSE') {
        // @ts-ignore
        return processNovelChunk({ prisma, job: job as any, apiClient, workerId });
      } else if (job.type === 'CE06_NOVEL_PARSING') {
        const context: ProcessorContext = {
          prisma,
          job: { ...job, projectId: job.projectId || '' },
          apiClient,
          logger: console,
          localStorage: localStorageAdapter, // P6-0 Fix: Inject Storage
        };
        return processCE06NovelParsingJob(context);
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
    if (result.success || (result as any).status === 'SPAWNED_CE06') {
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
 * @returns true if any job was found and processed, false otherwise
 */
async function pollAndProcessJobs(): Promise<boolean> {
  // P1-1: 尊重本地并发上限与波次限制
  const runtimeConfig = await getRuntimeConfig(loadMonitor);
  const { jobMaxInFlight } = runtimeConfig;
  const jobWaveSize = (appConfig as any).jobWaveSize;

  // P6-2-1: 审计与调优日志
  if (lastThrottledState !== runtimeConfig.throttled) {
    lastThrottledState = runtimeConfig.throttled;
    process.stdout.write(
      util.format(
        `[WorkerRuntime] Concurrency state changed. Throttled: ${runtimeConfig.throttled}, Reason: ${runtimeConfig.reason || 'NONE'}, JobMax: ${runtimeConfig.jobMaxInFlight}`
      ) + '\n'
    );
  }

  if (tasksRunning === 0) {
    // 静默状态下输出完整快照
    if ((env as any).isDevelopment) {
      // process.stdout.write(util.format(`[Worker] Idle poll... Tasks: 0/${jobMaxInFlight}`) + '\n');
    }
  }

  if (tasksRunning >= runtimeConfig.jobMaxInFlight) {
    if ((env as any).isDevelopment) {
    }
    return false;
  }

  // 计算本波次还能领多少（尊重 EngineLimiter 全局令牌）
  let remainingSlots = jobMaxInFlight - tasksRunning;

  if (runtimeConfig.throttled) {
    // 如果被节流，强制更严格的限制
    remainingSlots = Math.min(remainingSlots, 2);
  }

  if ((env as any).concurrencyLimiterEnabled) {
    const localAvailable = (engineLimiter as any).getStats().global.available;
    remainingSlots = Math.min(remainingSlots, localAvailable);
  }
  const currentWaveLimit = Math.min(jobWaveSize, remainingSlots);

  if (currentWaveLimit <= 0) return false;

  let anyJobFound = false;

  for (let i = 0; i < currentWaveLimit; i++) {
    try {
      // Quiet poll logs unless debugging
      // process.stdout.write(...)
      const job = await apiClient.getNextJob(workerId);

      if (job) {
        process.stdout.write(
          util.format(`[WORKER_LOOP] ✅ Leased job: ${job.id} (${job.type})`) + '\n'
        );
        anyJobFound = true;

        // S2-ORCH-BASE: Must ACK to transition to RUNNING
        try {
          await apiClient.ackJob(job.id, workerId);
        } catch (ackError) {
          process.stderr.write(util.format(`[Worker] ❌ ACK Job Failed:`, ackError) + '\n');
        }

        // 异步处理 Job，不阻塞轮询
        processJobWithExecutor(job).catch((error) => {
          process.stderr.write(
            util.format(`[Worker] ❌ processJobWithExecutor 异常:`, error) + '\n'
          );
        });
      } else {
        // 本波次没领到，提前终止
        break;
      }
    } catch (error: any) {
      process.stderr.write(util.format(`[Worker] ❌ 轮询 Job 失败:`, error.message) + '\n');
      break;
    }
  }
  return anyJobFound;
}

/**
 * 主函数 - 完整 Worker 启动逻辑
 */
export async function startWorkerApp() {
  process.stdout.write(util.format('========================================') + '\n');
  process.stdout.write(util.format('Super Caterpillar Worker') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  // 检查环境变量
  jobExecutor = new JobExecutor(apiClient);
  if (!env.databaseUrl) {
    process.stderr.write(util.format('[Worker] ❌ DATABASE_URL 未配置') + '\n');
    process.exit(1);
  }

  if (!env.workerApiKey || !env.workerApiSecret) {
    process.stdout.write(
      util.format('[Worker] ⚠️  API Key/Secret 未配置，Worker 可能无法通过 HMAC 认证') + '\n'
    );
  }

  // 检查 jobWorkerEnabled
  if (!env.jobWorkerEnabled) {
    process.stdout.write(
      util.format('[Worker] ⚠️  JOB_WORKER_ENABLED=false，Worker 将不会处理 Job') + '\n'
    );
  }

  try {
    // 连接数据库
    process.stdout.write(util.format('[Worker] 正在连接数据库...') + '\n');
    await prisma.$connect();
    process.stdout.write(util.format('[Worker] ✅ 数据库连接成功') + '\n');

    // 注册 Worker
    await registerWorker();

    isRunning = true;

    // 启动心跳循环（每 5 秒）
    setInterval(() => {
      if (isRunning) {
        sendHeartbeat();
      }
    }, 5000);

    // 启动 Job 轮询循环 (B3-1: Adaptive Polling)
    const runPollLoop = async () => {
      if (!isRunning) return;

      if (env.jobWorkerEnabled || true) {
        const foundJobs = await pollAndProcessJobs();
        const nextInterval = adaptivePoll.reportPollResult(foundJobs);

        // Dynamic logging for debugging B3
        // process.stdout.write(util.format(`[Adaptive] Next poll in ${nextInterval}ms`) + '\n');

        setTimeout(runPollLoop, nextInterval);
      } else {
        setTimeout(runPollLoop, env.workerPollInterval);
      }
    };

    // 立即开始轮询
    runPollLoop();

    process.stdout.write(util.format('\n[Worker] ✅ Worker 启动成功') + '\n');
    process.stdout.write(util.format(`[Worker] 心跳间隔: 5 秒`) + '\n');
    process.stdout.write(util.format(`[Worker] Job 轮询间隔: Adaptive (Min 200ms)`) + '\n');
    process.stdout.write(
      util.format(`[Worker] Job Worker 启用状态: ${env.jobWorkerEnabled ? '已启用' : '已禁用'}\n`) +
      '\n'
    );

    // 优雅退出处理
    process.on('SIGINT', () => {
      process.stdout.write(util.format('\n[Worker] 收到 SIGINT，正在关闭...') + '\n');
      shutdown();
    });

    process.on('SIGTERM', () => {
      process.stdout.write(util.format('\n[Worker] 收到 SIGTERM，正在关闭...') + '\n');
      shutdown();
    });
  } catch (error: any) {
    process.stderr.write(util.format('[Worker] ❌ Worker 启动失败:', error.message) + '\n');
    process.stderr.write(util.format(error.stack) + '\n');
    process.exit(1);
  }
}

// 启动程序
startWorkerApp().catch((err) => {
  console.error('Fatal error during worker startup:', err);
  process.exit(1);
});

/**
 * 优雅关闭
 */
async function shutdown() {
  isRunning = false;
  process.stdout.write(util.format('[Worker] 正在断开数据库连接...') + '\n');
  await prisma.$disconnect();
  process.stdout.write(util.format('[Worker] ✅ Worker 已关闭') + '\n');
  process.exit(0);
}
