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
import { LocalStorageAdapter } from '@scu/storage';
import { ProcessorContext } from './types/processor-context';

const prisma = new PrismaClient({
  log: env.isDevelopment ? ['error', 'warn'] : ['error'],
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
const workerSecret = process.env.HMAC_SECRET_KEY || process.env.API_SECRET_KEY || process.env.WORKER_API_SECRET || env.workerApiSecret;

if (!workerSecret && isProd) {
  const errMsg = '[P1-FAIL-FAST] FATAL: WORKER_API_SECRET missing in production. Refusing to start.';
  console.error(errMsg);
  throw new Error(errMsg);
}
const workerApiSecret = workerSecret || 'dev-secret';

const apiClient = new ApiClient(apiBaseUrl, workerApiKey, workerApiSecret, workerId);

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
        throw new Error(`Unsupported job type: ${job.type}`);
      }
    );

    await apiClient.reportJobResult({
      jobId: job.id,
      status: result.success ? 'SUCCEEDED' : 'FAILED',
      result: result.output,
      error: result.error,
    });
  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} execution failed:`, error.message);
  } finally {
    tasksRunning--;
  }
}

export async function startWorkerApp() {
  await prisma.$connect();
  jobExecutor = new JobExecutor(apiClient);

  const supportedJobTypes = [
    'CE06_NOVEL_PARSING',
    'CE06_SCRIPT_OUTLINE',
    'CE11_SCENE_SPLIT',
    'CE12_SHOT_SPLIT',
    'CE99_CONTINUITY_AUDIT',
    'CE13_CHARACTER_CARDS',
    'CE14_ASSET_LIST',
  ];

  console.log('[WORKER_BOOT] entry=apps/workers/src/worker-app.ts');
  console.log('[WORKER_BOOT] supportedJobTypes=', supportedJobTypes);
  console.log('[WORKER_BOOT] hasCE06=', supportedJobTypes.includes('CE06_NOVEL_PARSING'));

  console.log(`[Worker] Registering worker: ${workerId}`);
  try {
    const net = require('net');
    await new Promise((resolve) => {
      const sock = net.createConnection(3000, '127.0.0.1');
      sock.on('connect', () => {
        console.log('[WORKER_NET] connect_ok 127.0.0.1:3000');
        sock.destroy();
        resolve(true);
      });
      sock.on('error', (err: any) => {
        console.log(`[WORKER_NET] connect_error code=${err.code} errno=${err.errno} syscall=${err.syscall} address=${err.address} port=${err.port}`);
        resolve(false);
      });
    });

    try {
      const res = await fetch('http://127.0.0.1:3000/health');
      const text = await res.text();
      console.log(`[WORKER_FETCH_HEALTH] status=${res.status} body=${text.substring(0, 50).replace(/\\n/g, ' ')}`);
    } catch (err: any) {
      console.log(`[WORKER_FETCH_HEALTH] error name=${err.name} code=${err.code} cause=${err.cause?.code || err.cause?.name}`);
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
