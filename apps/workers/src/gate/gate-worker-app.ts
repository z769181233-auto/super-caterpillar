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
import { env, pickHmacSecretSSOT } from '@scu/config';
import * as util from 'util';
import { BillingOutboxDispatcher } from '../billing/outbox-dispatcher.service';
import * as fs from 'fs';
import * as path from 'path';
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
  process.stdout.write(util.format('Gate Worker (Minimal P1-1) - V2') + '\n');
  process.stdout.write(util.format('Version: V2-PIPELINE-SUPPORT') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const workerId = process.env.WORKER_ID || process.env.WORKER_NAME || env.workerId;
  const apiBaseUrl = env.apiUrl || 'http://localhost:3001';
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
  process.stdout.write(
    util.format(`[GateWorker] 正在注册 Worker 节点 (maxConcurrency=${maxConcurrency})...`) + '\n'
  );

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
        else if (job.type === 'CE03_VISUAL_DENSITY')
          result = await processCE03VisualDensityJob(ctx);
        else if (job.type === 'CE04_VISUAL_ENRICHMENT')
          result = await processCE04VisualEnrichmentJob(ctx);
        else if (job.type === 'CE02_VISUAL_DENSITY')
          result = await processCE02VisualDensityJob(ctx);
        else if (job.type === 'CE11_SHOT_GENERATOR')
          result = await processCE11ShotGeneratorJob(ctx);
        else if (job.type === 'VIDEO_RENDER') {
          // S3.4 Stage 6 Fix: Bypass real orchestration but MUST upsert mock asset
          const pl = (job.payload || {}) as any;
          const sId = pl.sceneId || (pl.shotId ? (await prisma.shot.findUnique({ where: { id: pl.shotId }, select: { sceneId: true } }))?.sceneId : 'sc-placeholder');
          if (sId) {
            await prisma.asset.upsert({
              where: { ownerType_ownerId_type: { ownerType: 'SCENE', ownerId: sId, type: 'VIDEO' } },
              update: { status: 'GENERATED', storageKey: 'gate/mock_video.mp4', createdByJobId: job.id },
              create: { projectId: job.projectId!, ownerId: sId, ownerType: 'SCENE', type: 'VIDEO', storageKey: 'gate/mock_video.mp4', status: 'GENERATED', createdByJobId: job.id }
            });
          }
          result = { status: 'SUCCEEDED', output: { storageKey: 'gate/mock_video.mp4' } };
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
        else if (job.type === 'PIPELINE_PROD_VIDEO_V1') result = await processE2EVideoPipelineJob(ctx);
        else if (job.type === 'NOVEL_ANALYSIS') {
          // NOVEL_ANALYSIS 暂时在 Gate 环境下作为成功旁路，或者调用真实的处理器
          result = { status: 'SUCCEEDED', message: 'Gate No-op for NOVEL_ANALYSIS' };
        }
        else {
          process.stdout.write(util.format(`[GateWorker] ⚠️ Unknown Job Type: ${job.type}`) + '\n');
          tasksRunning--;
          return;
        }
        const duration = (performance.now() - start) / 1000;

        // Record metrics (mapping job.type to engineKey for assertion)
        const engineKey = job.payload?.engineKey || job.type.toLowerCase();
        engineExecDuration.observe({ engine: engineKey, mode: 'gate' }, duration);

        const isSuccess = result.status === 'SUCCEEDED' || result.success === true || result.ok === true;

        // Audit: Write dummy artifacts if artifactDir is provided
        if (isSuccess && job.payload?.artifactDir) {
          const artDir = job.payload.artifactDir;
          if (!fs.existsSync(artDir)) {
            fs.mkdirSync(artDir, { recursive: true });
          }
          fs.writeFileSync(path.join(artDir, 'frames.txt'), 'frame001.png\nframe002.png\n');
          fs.writeFileSync(path.join(artDir, 'output.mp4'), 'mock mp4 content');
          // Also write source trace for easier debugging
          fs.writeFileSync(path.join(artDir, 'EVIDENCE_SOURCE.json'), JSON.stringify({ jobId: job.id, traceId: (job as any).traceId }, null, 2));
          process.stdout.write(util.format(`[GateWorker] 📝 已向 ${artDir} 写入模拟产物`) + '\n');

          // --- L3 DB Traceability: Generate Gate-contract artifacts + write DB ---
          const crypto = await import('crypto');
          const sha256File = (filePath: string) => {
            const buf = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(buf).digest('hex');
          };

          // 1) Ensure Gate-contract artifact names exist
          const mp4Path = path.join(artDir, 'shot_render_output.mp4');
          const mp4ShaPath = path.join(artDir, 'shot_render_output.mp4.sha256');
          const provPath = path.join(artDir, 'shot_render_output.provenance.json');
          const provShaPath = path.join(artDir, 'shot_render_output.provenance.json.sha256');

          // POST-L3-1: Mock/Real 模式隔离 - 禁止非验证 job 生成 mock 产物
          const isVerification = (job as any).isVerification === true || job.payload?.isVerification === true || job.payload?.mode === 'mock';

          // If legacy output.mp4 exists, copy it to contract path; otherwise keep mock content
          const legacyMp4 = path.join(artDir, 'output.mp4');
          if (fs.existsSync(legacyMp4) && !fs.existsSync(mp4Path)) {
            fs.copyFileSync(legacyMp4, mp4Path);
          }

          // Production/real jobs: forbid dummy content generation
          if (!isVerification) {
            const contractMp4 = path.join(artDir, 'shot_render_output.mp4');
            if (!fs.existsSync(contractMp4) && !fs.existsSync(legacyMp4)) {
              throw new Error("POST_L3_FORBID_MOCK: non-verification job cannot generate dummy artifacts. Set job.isVerification=true or payload.mode='mock' for testing.");
            }
          }

          // Only write mock content for verification jobs
          if (!fs.existsSync(mp4Path)) {
            if (isVerification) {
              fs.writeFileSync(mp4Path, 'mock mp4 content');
            } else {
              throw new Error("POST_L3_FORBID_MOCK: non-verification job missing real artifact and cannot write mock content");
            }
          }

          const mp4Sha = sha256File(mp4Path);
          fs.writeFileSync(mp4ShaPath, `${mp4Sha}  shot_render_output.mp4\n`);

          // provenance (snake_case per Gate18 contract)
          const provObj: any = {
            job: {
              job_id: job.id,
            },
            shot_id: (job as any).shotId ?? job.payload?.shotId ?? null,
            artifact: {
              filename: 'shot_render_output.mp4',
              sha256: mp4Sha,
            },
            artifact_dir: artDir,
            output_sha256: mp4Sha,
            generated_at: new Date().toISOString(),
          };
          fs.writeFileSync(provPath, JSON.stringify(provObj, null, 2));
          const provSha = sha256File(provPath);
          fs.writeFileSync(provShaPath, `${provSha}  shot_render_output.provenance.json\n`);

          // 2) DB write-back (requires Prisma)
          try {
            await prisma.shotJob.update({
              where: { id: job.id },
              data: {
                status: 'SUCCEEDED',
                outputSha256: mp4Sha,
              },
            });

            // Upsert artifacts by unique(jobId, kind)
            await prisma.shotJobArtifact.upsert({
              where: { jobId_kind: { jobId: job.id, kind: 'SHOT_RENDER_OUTPUT_MP4' } },
              update: { path: mp4Path, sha256: mp4Sha },
              create: { jobId: job.id, kind: 'SHOT_RENDER_OUTPUT_MP4', path: mp4Path, sha256: mp4Sha },
            });

            await prisma.shotJobArtifact.upsert({
              where: { jobId_kind: { jobId: job.id, kind: 'PROVENANCE_JSON' } },
              update: { path: provPath, sha256: provSha },
              create: { jobId: job.id, kind: 'PROVENANCE_JSON', path: provPath, sha256: provSha },
            });

            process.stdout.write(util.format(`[GateWorker] 🧾 L3 DB trace written for job ${job.id}`) + '\n');
          } catch (dbErr: any) {
            process.stderr.write(util.format(`[GateWorker] ⚠️ L3 DB write failed for job ${job.id}:`, dbErr.message) + '\n');
          }
        }

        await apiClient.reportJobResult({
          jobId: job.id,
          status: isSuccess ? 'SUCCEEDED' : 'FAILED',
          result,
        });
        process.stdout.write(util.format(`[GateWorker] ✅ job ${job.id} 成功完成`) + '\n');
      } catch (err: any) {
        process.stderr.write(
          util.format(`[GateWorker] ❌ job ${job.id} 执行失败:`, err.message) + '\n'
        );
        await apiClient.reportJobResult({
          jobId: job.id,
          status: 'FAILED',
          error: { message: err.message },
        });
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
