/**
 * Gate Worker App - 最小化 Worker 用于 P1-1 并发容量门禁验证
 * 完全不依赖 @scu/engines，只处理 stress_p1_1=true 的 SHOT_RENDER 任务
 */

import {
  shouldUseGateNoop,
  gateNoopShotRender,
} from '../processors/gate/noop-shot-render.processor';
import { ApiClient } from '../api-client';
import { PrismaClient } from 'database';
import { env } from '@scu/config';
import * as util from "util";

function assertNonProd() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GATE_WORKER_REFUSED_IN_PRODUCTION');
  }
}

export async function startGateWorkerApp() {
  assertNonProd();
  if (process.env.GATE_MODE !== '1') {
    throw new Error('GATE_WORKER_REQUIRES_GATE_MODE=1');
  }

  process.stdout.write(util.format('========================================') + "\n");
  process.stdout.write(util.format('Gate Worker (Minimal P1-1)') + "\n");
  process.stdout.write(util.format('========================================\n') + "\n");

  const workerId = process.env.WORKER_ID || process.env.WORKER_NAME || env.workerId;
  const apiBaseUrl = env.apiUrl || 'http://localhost:3001';
  const workerApiKey = env.workerApiKey;
  const workerApiSecret = env.workerApiSecret;

  process.stdout.write(util.format(`[GateWorker] Worker ID: ${workerId}`) + "\n");
  process.stdout.write(util.format(`[GateWorker] API URL: ${apiBaseUrl}`) + "\n");

  const apiClient = new ApiClient(
    apiBaseUrl.replace(/\/api\/?$/, ''),
    workerApiKey,
    workerApiSecret,
    workerId
  );

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: ['error'],
  });

  // 连接数据库
  process.stdout.write(util.format('[GateWorker] 正在连接数据库...') + "\n");
  await prisma.$connect();
  process.stdout.write(util.format('[GateWorker] ✅ 数据库连接成功') + "\n");

  // 注册 Worker
  process.stdout.write(util.format('[GateWorker] 正在注册 Worker 节点...') + "\n");
  await apiClient.registerWorker({
    workerId: workerId,
    name: workerId,
    capabilities: {
      supportedJobTypes: ['SHOT_RENDER'],
      supportedModels: [],
      supportedEngines: ['gate_noop'],
      maxBatchSize: 1,
    },
  });
  process.stdout.write(util.format('[GateWorker] ✅ Worker 注册成功') + "\n");

  const pollMs = Number(process.env.WORKER_POLL_INTERVAL ?? 1000);
  let isRunning = true;
  let tasksRunning = 0;

  // 心跳循环
  const heartbeatInterval = setInterval(async () => {
    if (!isRunning) return;
    try {
      await apiClient.heartbeat({
        workerId,
        status: tasksRunning > 0 ? 'busy' : 'idle',
        tasksRunning,
        // @ts-expect-error - P1-1 extension
        capabilities: {
          concurrency_managed: true,
          lease_supported: true,
          supportedEngines: ['gate_noop'],
        },
      });
    } catch (error: any) {
      process.stderr.write(util.format('[GateWorker] ❌ 心跳发送失败:', error.message) + "\n");
    }
  }, 5000);

  // 立即发送一次心跳
  await apiClient.heartbeat({
    workerId,
    status: 'idle',
    tasksRunning: 0,
    // @ts-expect-error - P1-1 extension
    capabilities: {
      concurrency_managed: true,
      lease_supported: true,
      supportedEngines: ['gate_noop'],
    },
  });

  process.stdout.write(util.format('[GateWorker] ✅ Worker 启动成功，开始轮询...\n') + "\n");

  // 最小轮询逻辑
  async function pollJobs() {
    if (!isRunning) return;

    try {
      const job = await apiClient.getNextJob(workerId);
      if (!job) {
        return;
      }

      // Gate 只处理 stress job
      if (!shouldUseGateNoop(job)) {
        // 跳过非 Gate job（理论上不应出现，但保险起见）
        process.stdout.write(util.format(`[GateWorker] 跳过非 Gate job: ${job.id}`) + "\n");
        return;
      }

      tasksRunning++;
      process.stdout.write(util.format(`[GateWorker] 认领 job: ${job.id}`) + "\n");

      try {
        // ✅ Noop执行
        const result = await gateNoopShotRender(job);

        // ✅ 回写成功
        await apiClient.reportJobResult({
          jobId: job.id,
          status: 'SUCCEEDED',
          result,
        });

        process.stdout.write(util.format(`[GateWorker] ✅ job ${job.id} 成功完成 (耗时: ${result.sleptMs}ms)`) + "\n");
      } catch (error: any) {
        process.stderr.write(util.format(`[GateWorker] ❌ job ${job.id} 执行失败:`, error.message) + "\n");
        await apiClient.reportJobResult({
          jobId: job.id,
          status: 'FAILED',
          error: { message: error.message },
        });
      } finally {
        tasksRunning--;
      }
    } catch (error: any) {
      // 轮询错误不崩溃
      if (error.message?.includes('No jobs available')) {
        // 正常情况，静默处理
      } else {
        process.stderr.write(util.format(`[GateWorker] ❌ 轮询失败:`, error.message) + "\n");
      }
    }
  }

  // 启动轮询
  const pollInterval = setInterval(() => {
    if (isRunning) {
      pollJobs();
    }
  }, pollMs);

  // 立即轮询一次
  await pollJobs();

  // 优雅退出
  process.on('SIGINT', async () => {
    process.stdout.write(util.format('\n[GateWorker] 收到 SIGINT，正在关闭...') + "\n");
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + "\n");
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    process.stdout.write(util.format('\n[GateWorker] 收到 SIGTERM，正在关闭...') + "\n");
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + "\n");
    process.exit(0);
  });
}
