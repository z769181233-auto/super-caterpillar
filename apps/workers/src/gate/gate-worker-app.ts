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
import { processNovelReduce } from '../processors/novel-reduce.processor';
import type { ProcessorContext } from '../types/processor-context';
import { processAudioJob } from '../processors/audio.processor';
import { processNovelAnalysisJob } from '../novel-analysis-processor';
import { ApiClient } from '../api-client';
import { PrismaClient } from 'database';
import { EngineHubClient } from '../engine-hub-client';
import { env } from '@scu/config';

import * as os from 'os';

function pickHmacSecretSSOT(): string {
  const v =
    process.env.HMAC_SECRET_KEY || process.env.API_SECRET_KEY || process.env.WORKER_API_SECRET;

  if (!v) {
    if (process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1') {
      const errMsg = '[P1-FAIL-FAST] FATAL: WORKER_API_SECRET missing in production. Refusing to start.';
      process.stderr.write(errMsg + '\\n');
      throw new Error(errMsg);
    }
  }
  return v || 'dev-secret';
}
import * as util from 'util';
import { BillingOutboxDispatcher } from '../billing/outbox-dispatcher.service';
import * as fs from 'fs';
import * as path from 'path';
import { engineExecDuration } from '@scu/observability';
import { performance } from 'perf_hooks';
import { AdaptivePollStrategy } from './adaptive-poll-strategy';
import { SystemLoadMonitor } from './system-load-monitor';
import { getArtifactEventNotifier } from './artifact-event-notifier';

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
  process.stdout.write(util.format('Gate Worker (Minimal P1-1) - V2') + '\n');
  process.stdout.write(util.format('Version: V2-PIPELINE-SUPPORT') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const workerId = process.env.WORKER_ID || process.env.WORKER_NAME || env.workerId;
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

  const workerApiKey = env.workerApiKey;
  const workerApiSecret = pickHmacSecretSSOT();

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
    log: ['error'],
  });

  process.stdout.write(util.format('[GateWorker] 正在连接数据库...') + '\n');
  await prisma.$connect();
  process.stdout.write(util.format('[GateWorker] ✅ 数据库连接成功') + '\n');

  const billingDispatcher = new BillingOutboxDispatcher(prisma, apiClient);
  billingDispatcher.start(30000);

  // 注册 Worker
  const maxConcurrencyEnv = parseInt(process.env.WORKER_MAX_CONCURRENCY || '5', 10);
  const maxConcurrency = Math.min(maxConcurrencyEnv, 5); // Cap at 5 for stability
  process.stdout.write(
    util.format(`[GateWorker] 正在注册 Worker 节点 (maxConcurrency=${maxConcurrency})...`) + '\n'
  );

  let registered = false;
  let attempts = 0;
  let isRunning = true;

  while (!registered && isRunning) {
    try {
      attempts++;
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
            'VIDEO_RENDER',
            'CE09_MEDIA_SECURITY',
            'PIPELINE_TIMELINE_COMPOSE',
            'TIMELINE_RENDER',
            'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
            'NOVEL_SCAN_TOC',
            'NOVEL_CHUNK_PARSE',
            'CE11_SHOT_GENERATOR',
            'AUDIO',
            'PIPELINE_PROD_VIDEO_V1',
            'EPISODE_RENDER',
            'NOVEL_ANALYSIS',
          ],
          supportedModels: [],
          supportedEngines: [
            'gate_noop',
            'pipeline_orchestrator',
            'ce06_novel_parsing',
            'ce03_visual_density',
            'ce04_visual_enrichment',
            'ce02_visual_density',
            'stage1_orchestrator',
            'video_merge',
            'default_shot_render',
            'ce09_security_real',
            'ce11_shot_generator_mock',
            'timeline_render',
            'audio_engine',
            'fusion',
            'ce06_novel_aggregator',
          ],
          maxBatchSize: maxConcurrency,
        },
      });
      registered = true;
      process.stdout.write(util.format('[GateWorker] ✅ Worker 注册成功') + '\n');
    } catch (e: any) {
      process.stderr.write(
        util.format(`[GateWorker] ❌ Worker 注册失败 (attempt ${attempts}):`, e.message) + '\n'
      );
      if (isRunning) {
        process.stdout.write(util.format('[GateWorker] 5秒后重试...') + '\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  // B3-1: 自适应轮询策略
  const adaptivePoll = new AdaptivePollStrategy({
    minInterval: 200,
    maxInterval: 2000,
    backoffFactor: 1.5,
  });

  // B3-2: 系统负载监控
  const loadMonitor = new SystemLoadMonitor();

  // B3-3: Artifact 事件通知器
  const eventNotifier = getArtifactEventNotifier();

  let tasksRunning = 0;
  let totalTasksProcessed = 0;
  let totalProcessingTimeMs = 0;
  let lastThrottledState: boolean | undefined = undefined;

  /**
   * P6-2-1: 动态并发调优逻辑 (Gate Worker 版)
   */
  function getEffectiveMaxConcurrency() {
    const base = maxConcurrency;
    const loadAvg = os.loadavg()[0];
    const cpus = os.cpus().length;
    const freeMem = os.freemem() / 1024 / 1024;

    let effective = base;
    let throttled = false;
    let reason = '';

    if (loadAvg > cpus * 0.8) {
      effective = Math.max(1, Math.floor(base * 0.5));
      throttled = true;
      reason = `HIGH_LOAD(${loadAvg.toFixed(2)})`;
    }

    if (freeMem < 512) {
      effective = 1;
      throttled = true;
      reason = `LOW_MEM(${Math.round(freeMem)}MB)`;
    }

    if (lastThrottledState !== throttled) {
      lastThrottledState = throttled;
      process.stdout.write(
        util.format(
          `[WorkerRuntime] Concurrency change. Throttled=${throttled}, Reason=${reason}, Max=${effective}`
        ) + '\n'
      );
    }

    return effective;
  }

  // B3-2: 增强心跳，包含负载指标
  const heartbeatInterval = setInterval(async () => {
    if (!isRunning) return;
    try {
      const metrics = await loadMonitor.getMetrics();
      const avgProcessingTime =
        totalTasksProcessed > 0 ? Math.round(totalProcessingTimeMs / totalTasksProcessed) : 0;

      await apiClient.heartbeat({
        workerId,
        status: 'online',
        tasksRunning,
        cpuUsagePercent: metrics.cpuUsagePercent,
        memoryUsageMb: metrics.memoryUsageMb,
        queueDepth: tasksRunning, // 当前正在处理的任务数
        avgProcessingTimeMs: avgProcessingTime,
        metadata: {
          totalTasksProcessed,
          uptimeSeconds: metrics.uptimeSeconds,
          pollStrategy: adaptivePoll.getStats(),
        },
      });
    } catch (error: any) {
      process.stderr.write(util.format('[GateWorker] ❌ 心跳发送失败:', error.message) + '\n');
    }
  }, 10000);

  // B3-1: 使用自适应轮询策略
  async function pollJobs() {
    if (!isRunning) return;

    let foundJobs = false;

    // P6-2-1: 使用动态计算的有效并发上限
    const effectiveMax = getEffectiveMaxConcurrency();

    // P1-1 OP: Fetch as many jobs as concurrency allows
    while (tasksRunning < effectiveMax && isRunning) {
      try {
        const job = await apiClient.getNextJob(workerId);
        if (!job) break; // No more jobs for now

        foundJobs = true;
        tasksRunning++;
        process.stdout.write(
          util.format(`[GateWorker] 认领 job: ${job.id} type=${job.type}`) + '\n'
        );

        // Non-blocking processing to allow loop to continue
        handleJob(job).catch((err) => {
          process.stderr.write(
            util.format(`[GateWorker] ❌ Unhandled job error:`, err.message) + '\n'
          );
        });
      } catch (error: any) {
        if (!error.message?.includes('No jobs available')) {
          process.stderr.write(util.format(`[GateWorker] ❌ 轮询失败:`, error.message) + '\n');
        }
        break; // Wait for next interval
      }
    }

    // B3-1: 根据轮询结果动态调整下次轮询间隔
    const nextInterval = adaptivePoll.reportPollResult(foundJobs);
    if (foundJobs) {
      process.stdout.write(
        util.format(`[B3-1] 发现任务，重置为快速轮询 (${nextInterval}ms)`) + '\n'
      );
    }
  }

  async function handleJob(job: any) {
    try {
      await apiClient.ackJob(job.id, workerId);
      process.stdout.write(util.format(`[GateWorker] ACK job: ${job.id}`) + '\n');

      let result: any;
      const ctx: ProcessorContext = { prisma, job, apiClient };

      const start = performance.now();
      if (job.type === 'PIPELINE_E2E_VIDEO') result = await processE2EVideoPipelineJob(ctx);
      else if (job.type === 'CE06_NOVEL_PARSING') result = await processCE06NovelParsingJob(ctx);
      else if (job.type === 'CE03_VISUAL_DENSITY') result = await processCE03VisualDensityJob(ctx);
      else if (job.type === 'CE04_VISUAL_ENRICHMENT')
        result = await processCE04VisualEnrichmentJob(ctx);
      else if (job.type === 'CE02_VISUAL_DENSITY') result = await processCE02VisualDensityJob(ctx);
      else if (job.type === 'CE11_SHOT_GENERATOR') result = await processCE11ShotGeneratorJob(ctx);
      else if (job.type === 'VIDEO_RENDER') {
        const pl = (job.payload || {}) as any;
        const sId =
          pl.sceneId ||
          (pl.shotId
            ? (
              await prisma.shot.findUnique({
                where: { id: pl.shotId },
                select: { sceneId: true },
              })
            )?.sceneId
            : 'sc-placeholder');

        // Robust Repo Root Detection
        let repoRoot = process.cwd();
        while (repoRoot.length > 1 && !fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
          repoRoot = path.dirname(repoRoot);
        }

        const storageRoot = (env as any).storageRoot;
        const mockKey = 'videos/gate_mock.mp4';
        const mockPath = path.join(storageRoot, mockKey);

        process.stdout.write(
          `[GateWorker] VIDEO_RENDER: cwd=${process.cwd()}, repoRoot=${repoRoot}, target=${mockPath}\n`
        );

        if (!fs.existsSync(path.dirname(mockPath)))
          fs.mkdirSync(path.dirname(mockPath), { recursive: true });
        if (!fs.existsSync(mockPath)) {
          // Generate 1s blue video using ffmpeg
          const { execSync } = require('child_process');
          try {
            process.stdout.write('[GateWorker] Generating mock video...\n');
            execSync(
              `ffmpeg -f lavfi -i color=c=blue:s=640x360:d=1 -c:v libx264 -t 1 -pix_fmt yuv420p "${mockPath}"`,
              { stdio: 'ignore' }
            );
          } catch (e) {
            console.error(
              '[GateWorker] Failed to generate mock video via ffmpeg, creating dummy file',
              e
            );
            fs.writeFileSync(mockPath, 'dummy video content');
          }
        }

        let assetId: string | undefined;
        if (sId) {
          const asset = await prisma.asset.upsert({
            where: { ownerType_ownerId_type: { ownerType: 'SCENE', ownerId: sId, type: 'VIDEO' } },
            update: { status: 'GENERATED', storageKey: mockKey, createdByJobId: job.id },
            create: {
              projectId: job.projectId!,
              ownerId: sId,
              ownerType: 'SCENE',
              type: 'VIDEO',
              storageKey: mockKey,
              status: 'GENERATED',
              createdByJobId: job.id,
            },
          });
          assetId = asset.id;
        }
        result = {
          status: 'SUCCEEDED',
          videoKey: mockKey,
          assetId: assetId,
          output: { storageKey: mockKey, assetId: assetId },
        };
      } else if (job.type === 'PIPELINE_TIMELINE_COMPOSE')
        result = await processTimelineComposeJob(ctx);
      else if (job.type === 'TIMELINE_RENDER') result = await processTimelineRenderJob(ctx);
      else if (job.type === 'CE09_MEDIA_SECURITY') result = await processMediaSecurityJob(ctx);
      else if (job.type === 'SHOT_RENDER') {
        if (job.payload?.pipelineRunId || job.payload?.traceId) {
          result = await processShotRenderJob(prisma, job, engineHubClient, apiClient);
        } else {
          result = await gateNoopShotRender(job);
        }
      } else if (job.type === 'PIPELINE_STAGE1_NOVEL_TO_VIDEO')
        result = await processStage1OrchestratorJob(ctx);
      else if (job.type === 'NOVEL_SCAN_TOC') result = await processNovelScan(ctx);
      else if (job.type === 'NOVEL_CHUNK_PARSE') result = await processNovelChunk(ctx);
      else if (job.type === 'AUDIO') result = await processAudioJob(prisma, job, apiClient);
      else if (job.type === 'PIPELINE_PROD_VIDEO_V1')
        result = await processE2EVideoPipelineJob(ctx);
      else if (job.type === 'NOVEL_ANALYSIS') {
        result = await processNovelAnalysisJob(
          prisma,
          { ...job, projectId: job.projectId || '' },
          apiClient
        );
      } else if (job.type === 'EPISODE_RENDER') {
        const { processEpisodeRenderJob } = await import('../processors/episode-render.processor');
        result = await processEpisodeRenderJob(ctx);
      } else {
        process.stdout.write(util.format(`[GateWorker] ⚠️ Unknown Job Type: ${job.type}`) + '\n');
        return;
      }
      const duration = (performance.now() - start) / 1000;

      // B3-2: 更新统计信息
      totalTasksProcessed++;
      totalProcessingTimeMs += duration * 1000;

      const engineKey = job.payload?.engineKey || job.type.toLowerCase();
      engineExecDuration.observe({ engine: engineKey, mode: 'gate' }, duration);

      const isSuccess =
        result.status === 'SUCCEEDED' ||
        result.status === 'SPAWNED_CE06' ||
        result.success === true ||
        result.ok === true;

      if (isSuccess && job.payload?.artifactDir) {
        const artDir = job.payload.artifactDir;
        const framesPath = path.join(artDir, 'frames.txt');
        if (!fs.existsSync(framesPath)) {
          fs.writeFileSync(framesPath, 'frame001.png\nframe002.png\n');
        }

        const outputMp4Path = path.join(artDir, 'output.mp4');
        if (!fs.existsSync(outputMp4Path)) {
          fs.writeFileSync(outputMp4Path, 'mock mp4 content');
        }

        fs.writeFileSync(
          path.join(artDir, 'EVIDENCE_SOURCE.json'),
          JSON.stringify({ jobId: job.id, traceId: (job as any).traceId }, null, 2)
        );
        process.stdout.write(util.format(`[GateWorker] 📝 已向 ${artDir} 写入模拟产物`) + '\n');

        // B3-3: 发布 Artifact 事件通知
        await eventNotifier
          .publish({
            jobId: job.id,
            artifactDir: artDir,
            artifactType: 'OTHER',
            metadata: { traceId: (job as any).traceId, jobType: job.type },
          })
          .catch((err: any) => {
            process.stderr.write(util.format(`[B3-3] 事件通知失败:`, err.message) + '\n');
          });

        const crypto = await import('crypto');
        const sha256File = (filePath: string) => {
          const buf = fs.readFileSync(filePath);
          return crypto.createHash('sha256').update(buf).digest('hex');
        };

        const mp4Path = path.join(artDir, 'shot_render_output.mp4');
        const mp4ShaPath = path.join(artDir, 'shot_render_output.mp4.sha256');
        const provPath = path.join(artDir, 'shot_render_output.provenance.json');
        const provShaPath = path.join(artDir, 'shot_render_output.provenance.json.sha256');

        const isVerification =
          (job as any).isVerification === true ||
          job.payload?.isVerification === true ||
          job.payload?.mode === 'mock';

        const legacyMp4 = path.join(artDir, 'output.mp4');
        if (fs.existsSync(legacyMp4) && !fs.existsSync(mp4Path)) {
          fs.copyFileSync(legacyMp4, mp4Path);
        }

        if (!isVerification) {
          const contractMp4 = path.join(artDir, 'shot_render_output.mp4');
          if (!fs.existsSync(contractMp4) && !fs.existsSync(legacyMp4)) {
            throw new Error(
              "POST_L3_FORBID_MOCK: non-verification job cannot generate dummy artifacts. Set job.isVerification=true or payload.mode='mock' for testing."
            );
          }
        }

        if (!fs.existsSync(mp4Path)) {
          if (isVerification) {
            fs.writeFileSync(mp4Path, 'mock mp4 content');
          } else {
            throw new Error(
              'POST_L3_FORBID_MOCK: non-verification job missing real artifact and cannot write mock content'
            );
          }
        }

        const mp4Sha = sha256File(mp4Path);
        fs.writeFileSync(mp4ShaPath, `${mp4Sha}  shot_render_output.mp4\n`);

        const provObj: any = {
          job: {
            job_id: job.id,
          },
          shotId: (job as any).shotId ?? job.payload?.shotId ?? null,
          artifact: {
            filename: 'shot_render_output.mp4',
            sha256: mp4Sha,
          },
          artifact_dir: artDir,
          outputSha256: mp4Sha,
          generated_at: new Date().toISOString(),
        };
        fs.writeFileSync(provPath, JSON.stringify(provObj, null, 2));
        const provSha = sha256File(provPath);
        fs.writeFileSync(provShaPath, `${provSha}  shot_render_output.provenance.json\n`);

        try {
          await prisma.shotJob.update({
            where: { id: job.id },
            data: {
              status: 'SUCCEEDED',
              outputSha256: mp4Sha,
            },
          });

          await prisma.shotJobArtifact.upsert({
            where: { jobId_kind: { jobId: job.id, kind: 'SHOT_RENDER_OUTPUT_MP4' } },
            update: { path: mp4Path, sha256: mp4Sha },
            create: {
              jobId: job.id,
              kind: 'SHOT_RENDER_OUTPUT_MP4',
              path: mp4Path,
              sha256: mp4Sha,
            },
          });

          await prisma.shotJobArtifact.upsert({
            where: { jobId_kind: { jobId: job.id, kind: 'PROVENANCE_JSON' } },
            update: { path: provPath, sha256: provSha },
            create: { jobId: job.id, kind: 'PROVENANCE_JSON', path: provPath, sha256: provSha },
          });

          process.stdout.write(
            util.format(`[GateWorker] 🧾 L3 DB trace written for job ${job.id}`) + '\n'
          );
        } catch (dbErr: any) {
          process.stderr.write(
            util.format(`[GateWorker] ⚠️ L3 DB write failed for job ${job.id}:`, dbErr.message) +
            '\n'
          );
        }
      }

      await apiClient.reportJobResult({
        jobId: job.id,
        status: isSuccess ? 'SUCCEEDED' : 'FAILED',
        result,
        errorMessage: isSuccess
          ? undefined
          : result.error?.message || result.error || 'Unknown processor error',
      });
      process.stdout.write(util.format(`[GateWorker] ✅ job ${job.id} 成功完成`) + '\n');
    } catch (err: any) {
      process.stderr.write(
        util.format(`[GateWorker] ❌ job ${job.id} 执行失败:`, err.message) + '\n'
      );
      await apiClient.reportJobResult({
        jobId: job.id,
        status: 'FAILED',
        errorMessage: err.message || 'Gate Worker execution failed', // Fix: use errorMessage
      });
    } finally {
      tasksRunning--;
    }
  }

  // B3-1: 动态轮询间隔管理
  let pollTimeout: NodeJS.Timeout | null = null;

  async function schedulePoll() {
    if (!isRunning) return;

    await pollJobs();

    const nextInterval = adaptivePoll.getCurrentInterval();
    pollTimeout = setTimeout(schedulePoll, nextInterval);
  }

  // 启动轮询
  await schedulePoll();

  const shutdown = async (signal: string) => {
    process.stdout.write(util.format(`\n[GateWorker] 收到 ${signal}，正在关闭...`) + '\n');
    isRunning = false;
    clearInterval(heartbeatInterval);
    if (pollTimeout) clearTimeout(pollTimeout);

    // B3-3: 确保所有事件通知已发送
    await eventNotifier.shutdown();

    await prisma.$disconnect();
    process.stdout.write(util.format('[GateWorker] ✅ Worker 已关闭') + '\n');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  startGateWorkerApp().catch((err) => {
    process.stderr.write(util.format('[GateWorker] ❌ 非正常退出:', err.message) + '\n');
    process.exit(1);
  });
}
