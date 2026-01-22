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
import { JobType } from 'database';
import { ApiClient } from '../api-client';
import { PrismaClient } from 'database';
import { EngineHubClient } from '../engine-hub-client';
import { env } from '@scu/config';
import * as util from 'util';
import { BillingOutboxDispatcher } from '../billing/outbox-dispatcher.service';

// 生产模式门禁：强制从环境变量读取
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
import * as fs from 'fs';

function assertNonProd() {
  // Allow Gate Worker in Production ONLY if explicit GATE_MODE is set (for verification)
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
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: ['error'],
  });

  // 连接数据库
  process.stdout.write(util.format('[GateWorker] 正在连接数据库...') + '\n');
  await prisma.$connect();
  process.stdout.write(util.format('[GateWorker] ✅ 数据库连接成功') + '\n');

  // 启动计费 Outbox 调度器 (PLAN-2)
  const billingDispatcher = new BillingOutboxDispatcher(prisma, apiClient);
  billingDispatcher.start(30000); // 30秒扫描一次

  // 注册 Worker
  process.stdout.write(util.format('[GateWorker] 正在注册 Worker 节点...') + '\n');
  const supportedEnginesList = ['gate_noop', 'pipeline_orchestrator'];
  const filteredEngines = PRODUCTION_MODE
    ? supportedEnginesList.filter((e) => e !== 'gate_noop')
    : supportedEnginesList;

  await apiClient.registerWorker({
    workerId: workerId,
    name: workerId,
    capabilities: {
      supportedJobTypes: [
        'SHOT_RENDER',
        'PIPELINE_E2E_VIDEO',
        'CE06_NOVEL_PARSING',
        'CE03_VISUAL_DENSITY',
        'CE04_VISUAL_ENRICHMENT',
        'CE02_VISUAL_DENSITY',
        'VIDEO_RENDER', // S4-4
        'CE09_MEDIA_SECURITY', // S4-5
        'PIPELINE_TIMELINE_COMPOSE', // S4-7
        'TIMELINE_RENDER', // S4-7
        'PIPELINE_TIMELINE_COMPOSE', // S4-7
        'TIMELINE_RENDER', // S4-7
        'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
        'NOVEL_SCAN_TOC', // Stage 4 Scale
        'NOVEL_CHUNK_PARSE', // Stage 4 Scale
        'CE11_SHOT_GENERATOR',
      ],
      supportedModels: [],
      supportedEngines: [
        'gate_noop',
        'pipeline_orchestrator',
        'stage1_orchestrator',
        'video_merge',
        'default_shot_render',
        'ce09_security_real',
        'ce11_shot_generator_mock',
      ],
      maxBatchSize: 1,
    },
  });
  process.stdout.write(util.format('[GateWorker] ✅ Worker 注册成功') + '\n');

  const pollMs = Number(process.env.WORKER_POLL_INTERVAL ?? 1000);
  let isRunning = true;
  let tasksRunning = 0;

  // 心跳循环
  const heartbeatInterval = setInterval(async () => {
    if (!isRunning) return;
    try {
      await apiClient.heartbeat({
        workerId,
        status: 'online',
        tasksRunning,
      });
    } catch (error: any) {
      process.stderr.write(util.format('[GateWorker] ❌ 心跳发送失败:', error.message) + '\n');
    }
  }, 10000);

  // 最小轮询逻辑
  async function pollJobs() {
    if (!isRunning) return;

    try {
      const job = await apiClient.getNextJob(workerId);
      if (!job) {
        return;
      }

      tasksRunning++;
      process.stdout.write(util.format(`[GateWorker] 认领 job: ${job.id} type=${job.type}`) + '\n');

      // S2-ORCH-BASE: Must ACK to transition to RUNNING
      try {
        await apiClient.ackJob(job.id, workerId);
        process.stdout.write(util.format(`[GateWorker] ACK job: ${job.id}`) + '\n');
      } catch (ackError: any) {
        process.stderr.write(
          util.format(`[GateWorker] ❌ ACK Job Failed: ${ackError.message}`) + '\n'
        );
        // If Ack fails, we probably shouldn't process it, or we should retry?
        // For Gate, we continue but warn.
      }

      try {
        let result: any;

        if (job.type === 'PIPELINE_E2E_VIDEO') {
          // Real Processor for E2E Pipeline
          process.stdout.write(util.format(`[GateWorker] 执行 E2E Pipeline Job...`) + '\n');
          const e2eCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processE2EVideoPipelineJob(e2eCtx);
        } else if (job.type === 'CE06_NOVEL_PARSING') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE06 Novel Parsing...`) + '\n');
          const ce06Ctx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processCE06NovelParsingJob(ce06Ctx);
        } else if (job.type === 'CE03_VISUAL_DENSITY') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE03 Visual Density...`) + '\n');
          const ce03Ctx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processCE03VisualDensityJob(ce03Ctx);
        } else if (job.type === 'CE04_VISUAL_ENRICHMENT') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE04 Visual Enrichment...`) + '\n');
          const ce04Ctx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processCE04VisualEnrichmentJob(ce04Ctx);
        } else if (job.type === 'CE02_VISUAL_DENSITY') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE02 Visual Density...`) + '\n');
          const ce02Ctx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processCE02VisualDensityJob(ce02Ctx);
        } else if (job.type === 'CE11_SHOT_GENERATOR') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE11 Shot Generator...`) + '\n');
          const ce11Ctx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processCE11ShotGeneratorJob(ce11Ctx);
        } else if (job.type === 'VIDEO_RENDER') {
          // S4-4: Conditional Routing (P4 Fix: Remove RENDER_ENGINE dependency)
          const debugMsg = `[Debug] VIDEO_RENDER Job: Payload=${JSON.stringify(job.payload)}\n`;
          process.stdout.write(debugMsg);
          fs.appendFileSync('worker-debug.log', debugMsg);

          if (job.payload?.pipelineRunId) {
            // P4 Fix: Any VIDEO_RENDER with pipelineRunId should use real processor
            process.stdout.write(
              util.format(
                `[GateWorker] 执行 Real Video Render (pipelineRunId=${job.payload.pipelineRunId})...\n`
              )
            );
            const videoRenderCtx: ProcessorContext = {
              prisma,
              job: job,
              apiClient,
            };
            result = await processVideoRenderJob(videoRenderCtx);
          } else {
            // Fallback to Gate Noop only for non-pipeline jobs
            if (!shouldUseGateNoop(job)) {
              process.stdout.write(util.format(`[GateWorker] 跳过非 Gate job: ${job.id}`) + '\n');
              return;
            }
            result = await gateNoopShotRender(job);
          }
        } else if (job.type === 'PIPELINE_TIMELINE_COMPOSE') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE10 Timeline Compose...`) + '\n');
          const timelineComposeCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processTimelineComposeJob(timelineComposeCtx);
        } else if (job.type === 'TIMELINE_RENDER') {
          process.stdout.write(
            util.format(`[GateWorker] 执行 Timeline Render (Two-Stage)...`) + '\n'
          );
          const timelineRenderCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processTimelineRenderJob(timelineRenderCtx);
        } else if (job.type === 'CE09_MEDIA_SECURITY') {
          process.stdout.write(util.format(`[GateWorker] 执行 CE09 Media Security...`) + '\n');
          const mediaSecurityCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processMediaSecurityJob(mediaSecurityCtx);
        } else if (job.type === 'SHOT_RENDER') {
          // S4-3: Conditional Routing
          // P0 Fix: Pipeline jobs should always produce mock frames to trigger real FFmpeg video render
          if (job.payload?.pipelineRunId) {
            process.stdout.write(
              util.format(`[GateWorker] 执行 S4-3 Real Engine Hub Shot Render...`) + '\n'
            );
            // Core Processor uses (prisma, job, engineHub, apiClient) signature
            result = await processShotRenderJob(prisma, job, engineHubClient, apiClient);
          } else {
            // Gate Default (Noop)
            if (!shouldUseGateNoop(job)) {
              process.stdout.write(util.format(`[GateWorker] 跳过非 Gate job: ${job.id}`) + '\n');
              return;
            }
            result = await gateNoopShotRender(job);
          }
        } else if (job.type === 'PIPELINE_STAGE1_NOVEL_TO_VIDEO') {
          process.stdout.write(util.format(`[GateWorker] 执行 Stage 1 Orchestrator...`) + '\n');
          const orchestratorCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processStage1OrchestratorJob(orchestratorCtx);
        } else if (job.type === 'NOVEL_SCAN_TOC') {
          process.stdout.write(util.format(`[GateWorker] 执行 Stage 4 Novel Scan...`) + '\n');
          const scanCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processNovelScan(scanCtx);
        } else if (job.type === 'NOVEL_CHUNK_PARSE') {
          process.stdout.write(util.format(`[GateWorker] 执行 Stage 4 Chunk Parse...`) + '\n');
          const chunkCtx: ProcessorContext = {
            prisma,
            job: job,
            apiClient,
          };
          result = await processNovelChunk(chunkCtx);
        } else {
          // Fallback for other types if any
          process.stdout.write(
            util.format(`[GateWorker] ⚠️ Unknown Job Type: ${job.type} - Skipping`) + '\n'
          );
          return;
        }

        // ✅ 回写结果
        const isSuccess = result.status === 'SUCCEEDED' || result.success === true;
        await apiClient.reportJobResult({
          jobId: job.id,
          status: isSuccess ? 'SUCCEEDED' : 'FAILED',
          result,
        });

        process.stdout.write(util.format(`[GateWorker] ✅ job ${job.id} 成功完成`) + '\n');
      } catch (error: any) {
        process.stderr.write(
          util.format(`[GateWorker] ❌ job ${job.id} 执行失败:`, error.message) + '\n'
        );
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
        process.stderr.write(util.format(`[GateWorker] ❌ 轮询失败:`, error.message) + '\n');
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
    process.stdout.write(util.format('\n[GateWorker] 收到 SIGINT，正在关闭...') + '\n');
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + '\n');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    process.stdout.write(util.format('\n[GateWorker] 收到 SIGTERM，正在关闭...') + '\n');
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + '\n');
    process.exit(0);
  });
}
