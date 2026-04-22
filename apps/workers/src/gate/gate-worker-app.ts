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
import { processFilmIRPlanJob } from '../processors/film-ir-plan.processor';
import { processContinuityAuditJob } from '../processors/script-structure.processor';
import { processContentJudgeJob } from '../processors/content-judge.processor';
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
    throw new Error(
      '[P1-FAIL-FAST] FATAL: WORKER_API_SECRET missing. Refusing to start with insecure default.'
    );
  }
  return v;
}
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

  const workerId = (() => {
    const id = (process.env.WORKER_ID || process.env.WORKER_NAME || '').trim();
    if (!id) {
      throw new Error('[Strict] WORKER_ID / WORKER_NAME environment variable is required.');
    }
    return id;
  })();
  const workerName = (() => {
    const name = (process.env.WORKER_NAME || process.env.WORKER_ID || '').trim();
    if (!name) throw new Error('[Strict] WORKER_NAME / WORKER_ID environment variable is required.');
    return name;
  })();
  const isProd = process.env.NODE_ENV === 'production';

  const rawApiBaseUrl = process.env.API_BASE_URL;
  const rawApiUrl = process.env.API_URL;
  const baseUrl = rawApiBaseUrl || rawApiUrl;

  if (rawApiBaseUrl?.includes('API_BASE_URL=')) throw new Error('Railway var misconfigured: value contains key prefix');
  if (!baseUrl) {
    throw new Error('API_BASE_URL or API_URL is required in production');
  }
  let apiBaseUrl = baseUrl.replace(/\/api\/?$/, '');

  const workerApiKey = env.workerApiKey;
  const workerApiSecret = pickHmacSecretSSOT();

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

  await prisma.$connect();

  const billingDispatcher = new BillingOutboxDispatcher(prisma, apiClient);
  billingDispatcher.start(30000);

  // 注册 Worker
  const maxConcurrencyEnv = parseInt(process.env.WORKER_MAX_CONCURRENCY || '5', 10);
  const maxConcurrency = Math.min(maxConcurrencyEnv, 5); // Cap at 5 for stability
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
            'CE_CONSISTENCY_CHECK',
            'VIDEO_RENDER',
            'CE09_MEDIA_SECURITY',
            'PIPELINE_TIMELINE_COMPOSE',
            'TIMELINE_RENDER',
            'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
            'NOVEL_SCAN_TOC',
            'NOVEL_CHUNK_PARSE',
            'CE11_SHOT_GENERATOR',
            'CE_SHOT_PLAN',
            'CE_CONTENT_JUDGE',
            'AUDIO',
            'PIPELINE_PROD_VIDEO_V1',
            'EPISODE_RENDER',
            'NOVEL_ANALYSIS',
            'CE_FILM_IR_PLAN',
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
            'ce11_shot_generator_real',
            'timeline_render',
            'audio_engine',
            'fusion',
            'ce06_novel_aggregator',
          ],
          maxBatchSize: maxConcurrency,
        },
      });
      registered = true;
    } catch (e: any) {
      if (isRunning) {
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

        // Non-blocking processing to allow loop to continue
        handleJob(job).catch((err) => {
        });
      } catch (error: any) {
        break; // Wait for next interval
      }
    }

    // B3-1: 根据轮询结果动态调整下次轮询间隔
    const nextInterval = adaptivePoll.reportPollResult(foundJobs);
  }

  async function handleJob(job: any) {
    try {
      await apiClient.ackJob(job.id, workerId);

      let result: any;
      const ctx: ProcessorContext = { prisma, job, apiClient };

      const start = performance.now();
      if (job.type === 'PIPELINE_E2E_VIDEO') result = await processE2EVideoPipelineJob(ctx);
      else if (job.type === 'CE06_NOVEL_PARSING') result = await processCE06NovelParsingJob(ctx);
      else if (job.type === 'CE03_VISUAL_DENSITY') result = await processCE03VisualDensityJob(ctx);
      else if (job.type === 'CE04_VISUAL_ENRICHMENT')
        result = await processCE04VisualEnrichmentJob(ctx);
      else if (job.type === 'CE02_VISUAL_DENSITY') result = await processCE02VisualDensityJob(ctx);
      else if (job.type === 'CE_CONSISTENCY_CHECK') result = await processContinuityAuditJob(ctx);
      else if (job.type === 'CE11_SHOT_GENERATOR') result = await processCE11ShotGeneratorJob(ctx);
      else if (job.type === 'CE_SHOT_PLAN') result = await processCE11ShotGeneratorJob(ctx);
      else if (job.type === 'CE_FILM_IR_PLAN') result = await processFilmIRPlanJob(ctx);
      else if (job.type === 'CE_CONTENT_JUDGE') result = await processContentJudgeJob(ctx);
      else if (job.type === 'VIDEO_RENDER') {
        const pl = (job.payload || {}) as {
          sceneId?: string;
          shotId?: string;
          traceId?: string;
          artifactDir?: string;
          isVerification?: boolean;
        };
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

        // P1-HARD: Mock video generation logic REMOVED.
        // Truth-based rendering required. If real renderer (ShotRenderRouter) fails, it remains failed.
        throw new Error('VIDEO_RENDER_NON_TRUTH_FALLBACK: Absolute truth required. GateWorker must not fallback to non-truth configuration.');
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
        // P6-TRUTH: Dummy output writes REMOVED.
        // Truth-based delivery required.

        fs.writeFileSync(
          path.join(artDir, 'EVIDENCE_SOURCE.json'),
          JSON.stringify({ jobId: job.id, traceId: job.traceId ?? job.payload?.traceId ?? job.id }, null, 2)
        );

        // B3-3: 发布 Artifact 事件通知
          await eventNotifier
          .publish({
            jobId: job.id,
            artifactDir: artDir,
            artifactType: 'OTHER',
            metadata: { traceId: job.traceId ?? job.payload?.traceId ?? job.id, jobType: job.type },
          })
          .catch(() => {});

        const crypto = await import('crypto');
        const sha256File = (filePath: string) => {
          const buf = fs.readFileSync(filePath);
          return crypto.createHash('sha256').update(buf).digest('hex');
        };

        const mp4Path = path.join(artDir, 'shot_render_output.mp4');
        const mp4ShaPath = path.join(artDir, 'shot_render_output.mp4.sha256');
        const provPath = path.join(artDir, 'shot_render_output.provenance.json');
        const provShaPath = path.join(artDir, 'shot_render_output.provenance.json.sha256');

        const isVerification = job.isVerification === true || job.payload?.isVerification === true;

        const fallbackOutputMp4 = path.join(artDir, 'output.mp4');
        if (fs.existsSync(fallbackOutputMp4) && !fs.existsSync(mp4Path)) {
          fs.copyFileSync(fallbackOutputMp4, mp4Path);
        }

        if (!isVerification) {
          const contractMp4 = path.join(artDir, 'shot_render_output.mp4');
          if (!fs.existsSync(contractMp4) && !fs.existsSync(fallbackOutputMp4)) {
            throw new Error(
              "ARTIFACT_DELIVERY_FAILED: Truth-based delivery required. Non-verification job missing real artifacts."
            );
          }
        }

        if (!fs.existsSync(mp4Path)) {
          throw new Error(
            'ARTIFACT_NOT_FOUND: Absolute truth required. No real artifact found in local storage.'
          );
        }

        const mp4Sha = sha256File(mp4Path);
        fs.writeFileSync(mp4ShaPath, `${mp4Sha}  shot_render_output.mp4\n`);

        const provObj: any = {
          job: {
            job_id: job.id,
          },
          shotId: job.shotId ?? job.payload?.shotId ?? null,
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

        } catch (dbErr: any) {
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
    } catch (err: any) {
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
    isRunning = false;
    clearInterval(heartbeatInterval);
    if (pollTimeout) clearTimeout(pollTimeout);

    // B3-3: 确保所有事件通知已发送
    await eventNotifier.shutdown();

    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  startGateWorkerApp().catch((err) => {
    process.exit(1);
  });
}
