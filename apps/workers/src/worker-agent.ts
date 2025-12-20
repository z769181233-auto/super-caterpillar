/**
 * Worker Agent
 * 最小可用版的 Worker，负责注册、心跳、拉取 Job、执行、回传结果
 */

import 'dotenv/config';
import { PrismaClient } from 'database';
import { ApiClient } from './api-client.js';
import { processNovelAnalysisJob } from './novel-analysis-processor.js';
import { processVideoRenderJob, cleanupVideoRenderProcesses } from './video-render.processor.js';
import { env } from '@scu/config';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.databaseUrl,
    },
  },
});

const API_BASE_URL = env.apiUrl;
const WORKER_ID = env.workerId;
const WORKER_NAME = env.workerName || 'Worker Agent v1';
const API_KEY = env.workerApiKey; // HMAC 认证：API Key
const API_SECRET = env.workerApiSecret; // HMAC 认证：Secret
const HEARTBEAT_INTERVAL_MS = 10000; // 10 秒心跳
const JOB_POLL_INTERVAL_MS = 5000; // 5 秒轮询 Job

const apiClient = new ApiClient(API_BASE_URL.replace(/\/api\/?$/, ''), API_KEY, API_SECRET);

let isRunning = false;
let tasksRunning = 0;

/**
 * 注册 Worker
 */
async function registerWorker() {
  console.log(`[Worker] Registering worker: ${WORKER_ID}...`);

  try {
    const result = await apiClient.registerWorker({
      workerId: WORKER_ID,
      name: WORKER_NAME,
      capabilities: {
        supportedJobTypes: ['NOVEL_ANALYSIS', 'NOVEL_ANALYZE_CHAPTER', 'VIDEO_RENDER'],
        supportedModels: [],
        maxBatchSize: 1,
      },
    });

    console.log(`[Worker] Registered successfully:`, result);
    return result;
  } catch (error: any) {
    console.error(`[Worker] Failed to register:`, error.message);
    throw error;
  }
}

/**
 * 发送心跳
 */
async function sendHeartbeat() {
  try {
    await apiClient.heartbeat({
      workerId: WORKER_ID,
      status: tasksRunning > 0 ? 'busy' : 'idle',
      tasksRunning,
    });
  } catch (error: any) {
    console.error(`[Worker] Failed to send heartbeat:`, error.message);
  }
}

/**
 * 处理单个 Job
 */
async function processJob(job: {
  id: string;
  type: string;
  payload: any;
  taskId: string;
  shotId?: string;
  projectId?: string;
}) {
  console.log(`[Worker] Processing job: ${job.id} (type: ${job.type})`);

  tasksRunning++;
  let result: { success: boolean; result?: any; error?: string };

  try {
    // 根据 job.type 调用对应的处理器
    if (job.type === 'NOVEL_ANALYSIS' || job.type === 'NOVEL_ANALYZE_CHAPTER') {
      // API Client now types projectId (optional)
      const projectId = job.payload?.projectId || job.projectId;

      if (!projectId) {
        throw new Error(`Missing projectId for ${job.type} job`);
      }

      result = await processNovelAnalysisJob(prisma, {
        ...job,
        projectId,
        traceId: job.taskId
      });
    } else if (job.type === 'VIDEO_RENDER') {
      result = await processVideoRenderJob(prisma, {
        id: job.id,
        traceId: job.taskId, // Assuming taskId is traceId for now, or fetch job
        projectId: job.payload?.projectId || job.projectId || 'unknown',
        payload: job.payload,
        type: 'VIDEO_RENDER'
      } as any, apiClient);
    } else {
      result = {
        success: false,
        error: `Unsupported job type: ${job.type}`,
      };
    }

    // 回传结果
    await apiClient.reportJobResult({
      jobId: job.id,
      status: result.success ? 'SUCCEEDED' : 'FAILED',
      result: result.result,
      errorMessage: result.error,
    });

    if (result.success) {
      console.log(`[Worker] Job ${job.id} completed successfully`);
    } else {
      console.error(`[Worker] Job ${job.id} failed:`, result.error);
    }
  } catch (error: unknown) {
    const jobError = error as Error & { blockingReason?: string; nextAction?: string };
    console.error(`[Worker] Error processing job ${job.id}:`, jobError.message);

    // 报告失败
    try {
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'FAILED',
        errorMessage: jobError.message || 'Unknown error',
        error: {
          message: jobError.message || 'Unknown error',
          code: jobError.blockingReason || 'INTERNAL_ERROR',
          details: {
            blockingReason: jobError.blockingReason,
            nextAction: jobError.nextAction,
          }
        }
      });
    } catch (reportError: any) {
      console.error(`[Worker] Failed to report job failure:`, reportError.message);
    }
  } finally {
    tasksRunning--;
  }
}

/**
 * 拉取并处理 Job
 */
async function pollAndProcessJobs() {
  try {
    const job = await apiClient.getNextJob(WORKER_ID);

    if (job) {
      // 立即处理 Job（不等待）
      processJob(job).catch((error) => {
        console.error(`[Worker] Error in processJob:`, error);
      });
    }
  } catch (error: any) {
    console.error(`[Worker] Error polling jobs:`, error.message);
  }
}

/**
 * 主循环
 */
async function main() {
  console.log(`[Worker] Starting Worker Agent...`);
  console.log(`[Worker] Worker ID: ${WORKER_ID}`);
  console.log(`[Worker] API Base URL: ${API_BASE_URL}`);
  console.log(`[Worker] API Key: ${API_KEY ? API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`[Worker] API Secret: ${API_SECRET ? 'SET' : 'NOT SET'}`);

  // 注册 Worker
  try {
    await registerWorker();
  } catch (error: any) {
    console.error(`[Worker] Failed to register, exiting...`);
    process.exit(1);
  }

  isRunning = true;

  // 启动心跳循环
  setInterval(() => {
    if (isRunning) {
      sendHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // 启动 Job 轮询循环
  setInterval(() => {
    if (isRunning) {
      pollAndProcessJobs();
    }
  }, JOB_POLL_INTERVAL_MS);

  // 立即发送一次心跳
  sendHeartbeat();

  // 立即开始轮询
  pollAndProcessJobs();

  console.log(`[Worker] Worker Agent started successfully`);
  console.log(`[Worker] Heartbeat interval: ${HEARTBEAT_INTERVAL_MS}ms`);
  console.log(`[Worker] Job poll interval: ${JOB_POLL_INTERVAL_MS}ms`);

  // 优雅退出处理
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
    isRunning = false; // 停止领新任务

    // 等待现有任务完成
    let waitCount = 0;
    const maxWait = 30; // 最多等待 30 秒
    while (tasksRunning > 0 && waitCount < maxWait) {
      console.log(`[Worker] Waiting for ${tasksRunning} tasks to complete... (${waitCount}/${maxWait}s)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      waitCount++;
    }

    if (tasksRunning > 0) {
      console.warn(`[Worker] Shutdown timed out, ${tasksRunning} tasks still running. Forcing exit.`);
    }

    // P1 修复：由于即将退出，强制清理所有子进程防止泄露
    cleanupVideoRenderProcesses();

    console.log(`[Worker] Exiting.`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// 启动
main().catch((error) => {
  console.error(`[Worker] Fatal error:`, error);
  process.exit(1);
});
