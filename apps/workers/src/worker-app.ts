/**
 * Worker 主入口文件
 */

/// <reference path="./types/config.d.ts" />
import * as util from 'util';
import { PrismaClient, JobStatus } from 'database';
import { env, config as appConfig } from '@scu/config';

// 生产模式门禁：强制从环境变量读取
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';

import * as os from 'os';
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
 * 运行时 Profile 配置
 */
export async function getRuntimeConfig(loadMonitor?: SystemLoadMonitor): Promise<RuntimeConfig> {
  const isSafeMode = process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true';
  const baseMaxInFlight = (env as any).jobMaxInFlight || 10;

  if (isSafeMode) {
    return {
      jobMaxInFlight: 2,
      nodeMaxOldSpaceMb: 4096,
      jobWaveSize: 1,
      throttled: true,
      reason: 'SAFE_MODE',
    };
  }

  let metrics: Partial<LoadMetrics> = {};
  if (loadMonitor) {
    metrics = await loadMonitor.getMetrics();
  }

  const cpus = os.cpus().length;
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

import { JobExecutor } from './executor/executor';
let jobExecutor: JobExecutor;
import { ApiClient } from './api-client';
import {
  processScriptOutlineJob,
  processSceneSplitJob,
  processShotSplitJob,
  processContinuityAuditJob,
} from './processors/script-structure.processor';
import {
  processCharacterCardsJob,
  processAssetListJob,
} from './processors/asset-extraction.processor';
import { processCE06NovelParsingJob } from './processors/ce06-novel-parsing.processor';
import { processShotRenderJob } from './processors/shot-render.processor';
import { processVideoRenderJob } from './processors/video-render.processor';
import { LocalStorageAdapter } from '@scu/storage';
import { ProcessorContext } from './types/processor-context';

const prisma = new PrismaClient({
  log: env.isDevelopment ? ['error', 'warn'] : ['error'],
});
const prismaConnectTimeoutMs = Number(process.env.PRISMA_CONNECT_TIMEOUT_MS || '5000');
const prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

prisma.$use(async (params, next) => {
  return await Promise.race([
    next(params),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `WORKER_PRISMA_QUERY_TIMEOUT: ${params.model || '$raw'}.${params.action} exceeded ${prismaQueryTimeoutMs}ms`
            )
          ),
        prismaQueryTimeoutMs
      )
    ),
  ]);
});

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

const workerId = readArg('workerId') || process.env.WORKER_ID || env.workerId;

const isProd = process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1';

const rawApiBaseUrl = process.env.API_BASE_URL;
const rawApiUrl = process.env.API_URL;
const baseUrl = rawApiBaseUrl || rawApiUrl;

console.log(`[BOOT_ENV] API_BASE_URL_RAW=${rawApiBaseUrl}`);
console.log(`[BOOT_ENV] API_URL_RAW=${rawApiUrl}`);
console.log(`[BOOT_ENV] API_BASE_URL_RESOLVED=${baseUrl}`);

if (rawApiBaseUrl?.includes('API_BASE_URL=')) throw new Error('Railway var misconfigured: value contains key prefix');
if (!baseUrl) {
  throw new Error('API_BASE_URL or API_URL is required in production');
}
let apiBaseUrl = baseUrl.replace(/\/api\/?$/, '');

const workerApiKey = readArg('apiKey') || env.workerApiKey;
const workerSecret =
  readArg('apiSecret') ||
  process.env.WORKER_API_SECRET ||
  env.workerApiSecret ||
  process.env.HMAC_SECRET_KEY ||
  process.env.API_SECRET_KEY;

if (!workerSecret) {
  const errMsg = '[P1-FATAL] WORKER_API_SECRET is missing. Fail-fast triggered.';
  throw new Error(errMsg);
}
const workerApiSecret = workerSecret;

const apiClient = new ApiClient(apiBaseUrl, workerApiKey, workerApiSecret, workerId);
const apiBase = new URL(apiBaseUrl);
const apiProbeHost = apiBase.hostname;
const apiProbePort = Number(apiBase.port || (apiBase.protocol === 'https:' ? '443' : '80'));
const apiHealthUrl = new URL('/health', apiBaseUrl).toString();

let isRunning = false;
let tasksRunning = 0;
const localStorageAdapter = new LocalStorageAdapter((appConfig as any).storageRoot);

async function processJobWithExecutor(job: any): Promise<void> {
  tasksRunning++;
  try {
    const result = await jobExecutor.execute(
      job.id,
      job.engineKey || 'real',
      job.createdAt,
      async () => {
        const ctx: ProcessorContext = { prisma, job, apiClient, localStorage: localStorageAdapter };
        if (job.type === 'CE06_NOVEL_PARSING') return processCE06NovelParsingJob(ctx);
        if (job.type === 'CE06_SCRIPT_OUTLINE') return processScriptOutlineJob(ctx);
        if (job.type === 'CE11_SCENE_SPLIT') return processSceneSplitJob(ctx);
        if (job.type === 'CE12_SHOT_SPLIT') return processShotSplitJob(ctx);
        if (job.type === 'CE99_CONTINUITY_AUDIT') return processContinuityAuditJob(ctx);
        if (job.type === 'CE13_CHARACTER_CARDS') return processCharacterCardsJob(ctx);
        if (job.type === 'CE14_ASSET_LIST') return processAssetListJob(ctx);
        if (job.type === 'SHOT_RENDER') return processShotRenderJob(ctx);
        if (job.type === 'VIDEO_RENDER') return processVideoRenderJob(ctx);
        throw new Error(`Unsupported job type: ${job.type}`);
      }
    );

    const normalizedStatus =
      result.success && result.output?.status !== 'FAILED' ? 'SUCCEEDED' : 'FAILED';
    const normalizedError =
      normalizedStatus === 'FAILED'
        ? result.error || result.output?.error || 'WORKER_PROCESSOR_FAILED'
        : undefined;

    await apiClient.reportJobResult({
      jobId: job.id,
      status: normalizedStatus,
      result: result.output,
      error: normalizedError,
    });
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} execution failed:`, error.message);
  } finally {
    tasksRunning--;
  }
}

export async function startWorkerApp() {
  try {
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `WORKER_PRISMA_CONNECT_TIMEOUT: startup connect exceeded ${prismaConnectTimeoutMs}ms`
              )
            ),
          prismaConnectTimeoutMs
        )
      ),
    ]);
  } catch (error: any) {
    console.warn(
      `[Worker] Prisma startup connect skipped: ${error?.message || 'unknown error'}. Continuing with API-first bootstrap.`
    );
  }
  jobExecutor = new JobExecutor(apiClient);

  const supportedJobTypes = [
    'CE06_NOVEL_PARSING',
    'CE06_SCRIPT_OUTLINE',
    'CE11_SCENE_SPLIT',
    'CE12_SHOT_SPLIT',
    'CE99_CONTINUITY_AUDIT',
    'CE13_CHARACTER_CARDS',
    'CE14_ASSET_LIST',
    'SHOT_RENDER',
    'VIDEO_RENDER',
  ];

  console.log('[WORKER_BOOT] entry=apps/workers/src/worker-app.ts');
  console.log('[WORKER_BOOT] supportedJobTypes=', supportedJobTypes);
  console.log('[WORKER_BOOT] hasCE06=', supportedJobTypes.includes('CE06_NOVEL_PARSING'));

  console.log(`[Worker] Registering worker: ${workerId}`);
  try {
    const net = require('net');
    await new Promise((resolve) => {
      const sock = net.createConnection(apiProbePort, apiProbeHost);
      sock.on('connect', () => {
        console.log(`[WORKER_NET] connect_ok ${apiProbeHost}:${apiProbePort}`);
        sock.destroy();
        resolve(true);
      });
      sock.on('error', (err: any) => {
        console.log(
          `[WORKER_NET] connect_error host=${apiProbeHost} port=${apiProbePort} code=${err.code} errno=${err.errno} syscall=${err.syscall} address=${err.address} port=${err.port}`
        );
        resolve(false);
      });
    });

    try {
      const res = await fetch(apiHealthUrl);
      const text = await res.text();
      console.log(
        `[WORKER_FETCH_HEALTH] url=${apiHealthUrl} status=${res.status} body=${text
          .substring(0, 50)
          .replace(/\\n/g, ' ')}`
      );
    } catch (err: any) {
      console.log(
        `[WORKER_FETCH_HEALTH] url=${apiHealthUrl} error name=${err.name} code=${err.code} cause=${err.cause?.code || err.cause?.name}`
      );
    }

    await apiClient.registerWorker({
      workerId,
      name: `Worker-${workerId}`,
      capabilities: {
        supportedJobTypes,
        supportedEngines: ['real'],
      },
    });
  } catch (e: any) {
    console.warn(`[Worker] Registration failed: ${e.message}`);
  }

  isRunning = true;
  console.log(`[Worker] Started. ID: ${workerId}`);

  // Heartbeat loop
  setInterval(async () => {
    try {
      await apiClient.heartbeat({ workerId, tasksRunning });
    } catch (e) { }
  }, 10000);

  while (isRunning) {
    const job = await apiClient.getNextJob(workerId);
    if (job) {
      console.log(`[Worker] Leased job: ${job.id} (${job.type})`);
      await apiClient.ackJob(job.id, workerId);
      processJobWithExecutor(job).catch(console.error);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
