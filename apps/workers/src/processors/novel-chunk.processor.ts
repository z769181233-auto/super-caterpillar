import { PrismaClient, JobType, JobStatus } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { ProcessorContext } from '../types/processor-context';
import { fileExists } from '../../../../packages/shared/fs_async';
import { basicTextSegmentation } from '../novel-analysis-processor';
import { hydrateShotWithDirectorControls } from '../v3/utils/shot_field_extractor';
import {
  ensureDefaultMetrics,
  stage4JobsTotal,
  stage4FailedJobs,
  stage4DurationSeconds,
  stage4PeakRssMb,
} from '../observability/stage4.metrics';

export async function processNovelChunk(context: ProcessorContext) {
  ensureDefaultMetrics();
  const t0 = Date.now();
  let peakRssMb = 0;

  function sampleRss() {
    const rss = process.memoryUsage().rss;
    const mb = Math.round(rss / 1024 / 1024);
    if (mb > peakRssMb) peakRssMb = mb;
  }

  const { prisma, job } = context;
  const { projectId, episodeId, startByte, endByte, isVerification } = job.payload;
  const fileKey = job.payload.fileKey || job.payload.filePath;
  // job.data was used in scan, here unified to payload

  try {
    stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
    sampleRss();

    console.log(
      `[NovelChunk] Parsing Project ${projectId}, Episode ${episodeId}, Bytes ${startByte}-${endByte}`
    );

    // 1. Path Resolution
    let filePath = fileKey;
    if (!path.isAbsolute(filePath)) {
      const storageRoot = (config as any).storageRoot;
      filePath = path.resolve(storageRoot, fileKey);
    }

    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelChunk] Source file not found: ${filePath}`);
    }

    // 2. Stream Slice (0-Memory-Bomb) using Bytes
    const chunkText = await readChunk(filePath, startByte, endByte);
    sampleRss();

    let analyzedScenes: any[] = [];

    // P6-2-2-4: Multi-Agent Collaboration (Phase 2: B1)
    const useDeepAnalysis =
      process.env.USE_MULTI_AGENT === 'true' || process.env.USE_MULTI_AGENT === '1';

    if (useDeepAnalysis) {
      console.log(`[NovelChunk] Using Deep Multi-Agent Analysis for Episode ${episodeId}...`);

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { stylePrompt: true, styleGuide: true },
      });

      const contextPrompt = {
        projectId,
        traceId: job.id,
        rawText: chunkText,
        chapterTitle: `Chapter ${episodeId}`, // Simplified fallback
        chapterIndex: parseInt(episodeId, 10),
        previousResults: {
          [(await import('../agents')).AgentRole.WRITER]: {
            projectStylePrompt: project?.stylePrompt,
            projectStyleGuide: project?.styleGuide,
          },
        } as any,
        organizationId: job.organizationId as string,
      };

      try {
        const result = await (await import('../agents')).runMultiAgentAnalysis(contextPrompt);
        analyzedScenes = result.scenes || [];
      } catch (err: any) {
        console.error(
          `[NovelChunk] Multi-Agent failed: ${err.message}. Falling back to basic segmentation.`
        );
        const structure = basicTextSegmentation(chunkText, projectId);
        analyzedScenes = structure.episodes.flatMap(ep => ep.scenes);
      }
    } else {
      // Legacy Logic: Basic Regex-based segmentation
      const structure = basicTextSegmentation(chunkText, projectId);
      analyzedScenes = structure.episodes.flatMap(ep => ep.scenes);
    }

    if (analyzedScenes.length === 0) {
      console.warn(`[NovelChunk] No scenes found in chunk.`);
      // Even if no scenes, it is technically a success (empty chunk)
      const durationSec = (Date.now() - t0) / 1000;
      stage4DurationSeconds.observe({ type: job.type }, durationSec);
      stage4PeakRssMb.set({ type: job.type }, peakRssMb);
      stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);
      return { status: 'SUCCEEDED', message: 'No scenes found' };
    }

    // 3. Write to DB (Transactional for this Episode only)
    const createdSceneIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Clear existing scenes for this episode (Idempotency)
      // NOT DELETE ALL, because "Chunk" usually maps 1:1 to Episode in our scan logic.
      // But if multiple chunks map to one Episode, we shouldn't delete.
      // Our Scan logic: 1 Episode = 1 Chunk. So SAFE to delete existing scenes.

      // Find existing scenes
      const oldScenes = await tx.scene.findMany({ where: { episodeId }, select: { id: true } });
      const oldSceneIds = oldScenes.map((s) => s.id);

      // Delete shots
      if (oldSceneIds.length > 0) {
        await tx.shot.deleteMany({ where: { sceneId: { in: oldSceneIds } } });
        await tx.scene.deleteMany({ where: { episodeId } });
      }

      // Insert new Scenes & Shots
      for (const [sIdx, scene] of analyzedScenes.entries()) {
        const dbScene = await tx.scene.create({
          data: {
            projectId,
            episodeId,
            sceneIndex: sIdx + 1,
            title: scene.title || `场景 ${sIdx + 1}`,
            summary: scene.description || scene.summary || '',
            enrichedText: scene.shots.map((s: any) => s.text).join('\n'),
          },
        });
        createdSceneIds.push(dbScene.id);

        if (scene.shots.length > 0) {
          await tx.shot.createMany({
            data: scene.shots.map((shot: any, shIdx: number) => {
              const shotParams = {
                sourceText: shot.text,
                ...(shot.visualParams || {}),
              };

              // B1 Map: Visual Agent params to DB Columns
              const visual = shot.visualParams || {};

              return hydrateShotWithDirectorControls(
                {
                  organizationId: job.organizationId as string,
                  sceneId: dbScene.id,
                  index: shIdx + 1,
                  title: shot.title || `Shot ${shIdx + 1}`,
                  description: shot.summary || shot.text.slice(0, 50),
                  type: 'novel_chunk',
                  params: shotParams,
                  // DB Field mapping
                  shotType: visual.shotType || 'MEDIUM_SHOT',
                  cameraMovement: visual.cameraMovement || 'STATIC',
                  lightingPreset: visual.lightingPreset || 'NATURAL',
                },
                shotParams
              );
            }),
          });
        }
      }

      // 4. Billing Ledger (Scale Mode: 10k chars = 1 credit) - Idempotent
      const credits = Math.ceil((endByte - startByte) / 10000);
      if (credits > 0) {
        await tx.billingLedger.upsert({
          where: {
            tenantId_traceId_itemType_itemId_chargeCode: {
              tenantId: job.organizationId as string,
              traceId: job.id,
              itemType: 'NOVEL_CHUNK',
              itemId: episodeId,
              chargeCode: 'PARSING_FEE',
            },
          },
          update: {},
          create: {
            tenantId: job.organizationId as string,
            traceId: job.id,
            itemType: 'NOVEL_CHUNK',
            itemId: episodeId,
            chargeCode: 'PARSING_FEE',
            amount: credits,
            status: 'POSTED',
            evidenceRef: `chars:${endByte - startByte}`,
          },
        });
      }
    }, { timeout: 60000 });

    console.log(
      `[NovelChunk] Success. Imported ${analyzedScenes.length} scenes. Transaction Committed.`
    );

    // Cascade Trigger: Stage 5 (Shot Planning)
    // Immediately trigger Shot Generator for created scenes to maximize parallelism (Shredder Mode)
    if (createdSceneIds.length > 0) {
      // P5-3: Explicit Engine Key Routing
      // If verification, stick to mock. If production, use real engine.
      const targetEngineKey = isVerification
        ? 'ce11_shot_generator_mock'
        : 'ce11_shot_generator_real';

      const cascadeJobs = createdSceneIds.map((sceneId, idx) => ({
        type: JobType.CE11_SHOT_GENERATOR,
        status: JobStatus.PENDING,
        projectId,
        organizationId: job.organizationId,
        workerId: null,
        taskId: job.taskId, // CRITICAL: Propagate Aggregate Task ID
        traceId: job.traceId || job.payload?.traceId,
        isVerification,
        // P6-2-2-1: Trigger Throttling - Lower priority than scan, add idx jitter
        priority: 5 + (idx % 5),
        payload: {
          novelSceneId: sceneId,
          projectId,
          traceId: job.traceId || job.payload?.traceId,
          engineKey: targetEngineKey,
          isVerification, // Redundant but safe
        },
      }));

      if (cascadeJobs.length > 0) {
        console.log(`[Cascade DEBUG] Example job priority: ${cascadeJobs[0].priority}`);
      }
      await prisma.shotJob.createMany({
        data: cascadeJobs as any,
      });

      console.log(
        `[Cascade] Triggered ${cascadeJobs.length} CE11_SHOT_GENERATOR jobs for taskId=${job.taskId}`
      );
    }

    // Metrics: Success
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

    const resultStats = {
      charCount: endByte - startByte,
      sceneCount: analyzedScenes.length,
    };

    // 5. Update NovelSource Progress (P6-2-2-2: Debounced Progress Update)
    // For 15M scale (4000+ chunks), DB IOPS is expensive.
    // Optimization: Only update DB every ~20 chunks OR if it's likely the end.
    const nsId = job.payload.novelSourceId;
    if (nsId) {
      // Deterministic batching: update if (episodeId % 20 === 0)
      // Note: episodeId is usually 1-indexed string or number
      const epIdx = parseInt(job.payload.episodeId || '0', 10);
      const isBatchMilestone = epIdx % 20 === 0;

      // We also check totalChapters to ensure the very last one triggers completion
      const nsMeta = await prisma.novelSource.findUnique({
        where: { id: nsId },
        select: { totalChapters: true, processedChunks: true },
      });

      const isLastChunk = nsMeta && nsMeta.processedChunks + 1 >= nsMeta.totalChapters;
      const shouldUpdateDB = isBatchMilestone || isLastChunk || isVerification;

      if (shouldUpdateDB) {
        const ns = await prisma.novelSource
          .findUnique({
            where: { id: nsId },
            select: { processedChunks: true, totalChapters: true },
          })
          .catch(() => null);

        if (ns) {
          await prisma.novelSource.update({
            where: { id: nsId },
            data: {
              processedChunks: { increment: 1 },
            },
          }).catch((e) => {
            console.error(`[NovelChunk] Failed to increment processedChunks for ${nsId}:`, e.message);
          });

          if (ns.processedChunks + 1 >= ns.totalChapters) {
            await Promise.all([
              prisma.novelSource.update({
                where: { id: nsId },
                data: { status: 'COMPLETED' as any },
              }).catch(() => null),
              prisma.novel.update({
                where: { projectId },
                data: { status: 'COMPLETED' },
              }).catch(() => null),
            ]).catch(() => { });
          }
        }
      } else {
        // Fire and forget update for background progress if not a milestone
        await prisma.novelSource
          .update({
            where: { id: nsId },
            data: { processedChunks: { increment: 1 } },
          })
          .catch(() => { });
      }
    }

    return {
      status: 'SUCCEEDED',
      message: `Imported ${analyzedScenes.length} scenes`,
      stats: resultStats,
    };
  } catch (e: any) {
    // 6. Fail-Safe NovelSource status update
    if (job.payload.novelSourceId) {
      // Only fail if it's a "fatal" chunk error?
      // For now, if ANY chunk fails, we mark the whole source as potentially compromised or just log error.
      // Given the Shredder scale, we might want to continue other chunks.
      // But we should at least record the last error.
      await prisma.novelSource
        .update({
          where: { id: job.payload.novelSourceId },
          data: {
            // status: 'FAILED', // Don't set to FAILED immediately to allow other chunks to proceed
            error: `Chunk ${job.payload.episodeId} failed: ${e.message || String(e)}`,
          },
        })
        .catch(() => { });
    }

    // Metrics: Failure
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'FAILED' }, 1);
    stage4FailedJobs.inc({ type: job.type, reason: e?.name || 'Error' }, 1);
    throw e;
  }
}
async function readChunk(filePath: string, start: number, end: number): Promise<string> {
  const chunks: Buffer[] = [];
  // end is exclusive in payload, but fs.createReadStream end is inclusive.
  // So we read up to end - 1.
  const readStream = fs.createReadStream(filePath, { start: start, end: end - 1 });

  for await (const chunk of readStream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
