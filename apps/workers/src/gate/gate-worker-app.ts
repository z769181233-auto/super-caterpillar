/**
 * Gate Worker App - 最小化 Worker 用于 P1-1 并发容量门禁验证
 * 完全不依赖 @scu/engines，只处理 stress_p1_1=true 的 SHOT_RENDER 任务
 */

import {
  shouldUseGateNoop,
  gateNoopShotRender,
} from '../processors/gate/noop-shot-render.processor';
import { processE2EVideoPipelineJob } from '../processors/e2e-video-pipeline.processor';
import { processCE06NovelParsingJob } from '../processors/ce06-novel-parsing.processor';
import { processCE03VisualDensityJob } from '../processors/ce03-visual-density.processor';
import { processCE04VisualEnrichmentJob } from '../processors/ce04-visual-enrichment.processor';
import { processCE02VisualDensityJob } from '../processors/ce02-visual-density.processor';
import { processCE11ShotGeneratorJob } from '../processors/ce11-shot-generator.processor';
import { processShotRenderJob } from '../ce-core-processor';
import { processVideoRenderJob } from '../processors/video-render.processor';
import { processMediaSecurityJob } from '../processors/media-security.processor';
import { processTimelineComposeJob } from '../processors/timeline-compose.processor';
import { processTimelineRenderJob } from '../processors/timeline-render.processor';
import { processStage1OrchestratorJob } from '../processors/stage1-orchestrator.processor';
import { processNovelScan } from '../processors/novel-scan.processor';
import { processNovelChunk } from '../processors/novel-chunk.processor';
import type { ProcessorContext } from '../types/processor-context';
import { processAudioJob } from '../processors/audio.processor';
import { ApiClient } from '../api-client';
import { PrismaClient } from 'database';
import { EngineHubClient } from '../engine-hub-client';
import { env } from '@scu/config';
import * as util from 'util';
import { BillingOutboxDispatcher } from '../billing/outbox-dispatcher.service';
import * as fs from 'fs';
import { engineExecDuration } from '@scu/observability';
import { performance } from 'perf_hooks';

// 生产模式门禁：强制从环境变量读取
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';

function assertNonProd() {
  if (process.env.NODE_ENV === 'production' && process.env.GATE_MODE !== '1') {
    throw new Error('GATE_WORKER_REFUSED_IN_PRODUCTION');
  }
}

export async function startGateWorkerApp() {
  assertNonProd();
  if (process.env.GATE_MODE !== '1') {
    throw new Error('GATE_WORKER_REQUIRES_GATE_MODE=1');
  }

  process.stdout.write(util.format('========================================') + '\n');
  process.stdout.write(util.format('Gate Worker (Minimal P1-1)') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const workerId = process.env.WORKER_ID || process.env.WORKER_NAME || env.workerId;
  const apiBaseUrl = env.apiUrl || 'http://localhost:3001';
  const workerApiKey = env.workerApiKey;
  const workerApiSecret = env.workerApiSecret;

  process.stdout.write(util.format(`[GateWorker] Worker ID: ${workerId}`) + '\n');
  process.stdout.write(util.format(`[GateWorker] API URL: ${apiBaseUrl}`) + '\n');

  const apiClient = new ApiClient(
    apiBaseUrl.replace(/\/api\/?$/, ''),
    workerApiKey,
    workerApiSecret,
    workerId
  );

  const engineHubClient = new EngineHubClient(apiClient);

  const prisma = new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
    log: ['error'],
  });

  process.stdout.write(util.format('[GateWorker] 正在连接数据库...') + '\n');
  await prisma.$connect();
  process.stdout.write(util.format('[GateWorker] ✅ 数据库连接成功') + '\n');

  const billingDispatcher = new BillingOutboxDispatcher(prisma, apiClient);
  billingDispatcher.start(30000);

  // 注册 Worker
  const maxConcurrency = parseInt(process.env.WORKER_MAX_CONCURRENCY || '1', 10);
  process.stdout.write(util.format(`[GateWorker] 正在注册 Worker 节点 (maxConcurrency=${maxConcurrency})...`) + '\n');

  await apiClient.registerWorker({
    workerId: workerId,
    name: workerId,
    capabilities: {
      supportedJobTypes: [
        'SHOT_RENDER', 'PIPELINE_E2E_VIDEO', 'CE06_NOVEL_PARSING',
        'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT', 'CE02_VISUAL_DENSITY',
        'VIDEO_RENDER', 'CE09_MEDIA_SECURITY', 'PIPELINE_TIMELINE_COMPOSE',
        'TIMELINE_RENDER', 'PIPELINE_STAGE1_NOVEL_TO_VIDEO', 'NOVEL_SCAN_TOC',
        'NOVEL_CHUNK_PARSE', 'CE11_SHOT_GENERATOR', 'AUDIO',
      ],
      supportedModels: [],
      supportedEngines: [
        'gate_noop', 'pipeline_orchestrator', 'ce06_novel_parsing',
        'ce03_visual_density', 'ce04_visual_enrichment', 'ce02_visual_density',
        'stage1_orchestrator', 'video_merge', 'default_shot_render',
        'ce09_security_real', 'ce11_shot_generator_mock', 'timeline_render',
        'audio_engine',
      ],
      maxBatchSize: maxConcurrency,
    },
  });
  process.stdout.write(util.format('[GateWorker] ✅ Worker 注册成功') + '\n');

  const pollMs = Number(process.env.WORKER_POLL_INTERVAL ?? 1000);
  let isRunning = true;
  let tasksRunning = 0;

  const heartbeatInterval = setInterval(async () => {
    if (!isRunning) return;
    try {
      await apiClient.heartbeat({ workerId, status: 'online', tasksRunning });
    } catch (error: any) {
      process.stderr.write(util.format('[GateWorker] ❌ 心跳发送失败:', error.message) + '\n');
    }
  }, 10000);

  async function pollJobs() {
    if (!isRunning) return;
    if (tasksRunning >= maxConcurrency) return;

    try {
      const job = await apiClient.getNextJob(workerId);
      if (!job) return;

      tasksRunning++;
      process.stdout.write(util.format(`[GateWorker] 认领 job: ${job.id} type=${job.type}`) + '\n');

      try {
        await apiClient.ackJob(job.id, workerId);
        process.stdout.write(util.format(`[GateWorker] ACK job: ${job.id}`) + '\n');

        let result: any;
        const ctx: ProcessorContext = { prisma, job, apiClient };

        const start = performance.now();
        if (job.type === 'PIPELINE_E2E_VIDEO') result = await processE2EVideoPipelineJob(ctx);
        else if (job.type === 'CE06_NOVEL_PARSING') result = await processCE06NovelParsingJob(ctx);
        else if (job.type === 'CE03_VISUAL_DENSITY') result = await processCE03VisualDensityJob(ctx);
        else if (job.type === 'CE04_VISUAL_ENRICHMENT') result = await processCE04VisualEnrichmentJob(ctx);
        else if (job.type === 'CE02_VISUAL_DENSITY') result = await processCE02VisualDensityJob(ctx);
        else if (job.type === 'CE11_SHOT_GENERATOR') result = await processCE11ShotGeneratorJob(ctx);
        else if (job.type === 'VIDEO_RENDER') {
          if (job.payload?.pipelineRunId) result = await processVideoRenderJob(ctx);
          else result = await gateNoopShotRender(job);
        } else if (job.type === 'PIPELINE_TIMELINE_COMPOSE') result = await processTimelineComposeJob(ctx);
        else if (job.type === 'TIMELINE_RENDER') result = await processTimelineRenderJob(ctx);
        else if (job.type === 'CE09_MEDIA_SECURITY') result = await processMediaSecurityJob(ctx);
        else if (job.type === 'SHOT_RENDER') {
          if (job.payload?.pipelineRunId || job.payload?.traceId) {
            result = await processShotRenderJob(prisma, job, engineHubClient, apiClient);
          } else {
            result = await gateNoopShotRender(job);
          }
        } else if (job.type === 'PIPELINE_STAGE1_NOVEL_TO_VIDEO') result = await processStage1OrchestratorJob(ctx);
        else if (job.type === 'NOVEL_SCAN_TOC') result = await processNovelScan(ctx);
        else if (job.type === 'NOVEL_CHUNK_PARSE') result = await processNovelChunk(ctx);
        else if (job.type === 'AUDIO') result = await processAudioJob(prisma, job, apiClient);
        else {
          process.stdout.write(util.format(`[GateWorker] ⚠️ Unknown Job Type: ${job.type}`) + '\n');
          tasksRunning--;
          return;
        }
        const duration = (performance.now() - start) / 1000;

        // Record metrics (mapping job.type to engineKey for assertion)
        const engineKey = job.payload?.engineKey || job.type.toLowerCase();
        engineExecDuration.observe({ engine: engineKey, mode: 'gate' }, duration);

        const isSuccess = result.status === 'SUCCEEDED' || result.success === true;
        await apiClient.reportJobResult({ jobId: job.id, status: isSuccess ? 'SUCCEEDED' : 'FAILED', result });
        process.stdout.write(util.format(`[GateWorker] ✅ job ${job.id} 成功完成`) + '\n');
      } catch (err: any) {
        process.stderr.write(util.format(`[GateWorker] ❌ job ${job.id} 执行失败:`, err.message) + '\n');
        await apiClient.reportJobResult({ jobId: job.id, status: 'FAILED', error: { message: err.message } });
      } finally {
        tasksRunning--;
      }
    } catch (error: any) {
      if (!error.message?.includes('No jobs available')) {
        process.stderr.write(util.format(`[GateWorker] ❌ 轮询失败:`, error.message) + '\n');
      }
    }
  }

  const pollInterval = setInterval(() => pollJobs(), pollMs);
  await pollJobs();

  const shutdown = async (signal: string) => {
    process.stdout.write(util.format(`\n[GateWorker] 收到 ${signal}，正在关闭...`) + '\n');
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + '\n');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
