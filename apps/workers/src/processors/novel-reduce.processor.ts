import { JobType, JobStatus } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { ProcessorContext } from '../types/processor-context';
import { fileExists } from '../../../../packages/shared/fs_async';
import { hydrateShotWithDirectorControls } from '../v3/utils/shot_field_extractor';
import {
  ensureDefaultMetrics,
  stage4JobsTotal,
  stage4DurationSeconds,
  stage4PeakRssMb,
} from '../observability/stage4.metrics';

export async function processNovelReduce(context: ProcessorContext) {
  ensureDefaultMetrics();
  const workerConfig = config as typeof config & { storageRoot: string };
  const t0 = Date.now();
  let peakRssMb = 0;

  function sampleRss() {
    const rss = process.memoryUsage().rss;
    const mb = Math.round(rss / 1024 / 1024);
    if (mb > peakRssMb) peakRssMb = mb;
  }

  const { prisma, job } = context;
  const { projectId, ingestRunId, isVerification, novelSourceId, episodeId } = job.payload;
  const organizationId = job.organizationId;

  if (!projectId) {
    throw new Error('[NovelReduce] Missing projectId on job');
  }
  if (!ingestRunId) {
    throw new Error('[NovelReduce] Missing ingestRunId on job');
  }
  if (!organizationId) {
    throw new Error('[NovelReduce] Missing organizationId on job');
  }
  if (!episodeId || typeof episodeId !== 'string') {
    throw new Error('[NovelReduce] Missing episodeId on job');
  }

  try {
    stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
    sampleRss();

    // 1. Fetch only completed chunks for this run
    const chunks = await prisma.novelChunk.findMany({
      where: { ingestRunId, status: 'COMPLETED' },
      orderBy: { chNo: 'asc' },
    });
    if (chunks.length === 0) {
      throw new Error(`[NovelReduce] No completed chunks found for ingestRunId=${ingestRunId}`);
    }

    // 2. Aggregate Artifacts
    const allScenes: any[] = [];
    const storageRoot = workerConfig.storageRoot || '/tmp/storage';

    for (const chunk of chunks) {
      if (!chunk.artifactUrl) {
        throw new Error(`[NovelReduce] Completed chunk ${chunk.id} is missing artifactUrl`);
      }

      const artifactPath = path.resolve(storageRoot, chunk.artifactUrl);
      if (!(await fileExists(artifactPath))) {
        throw new Error(`[NovelReduce] Chunk artifact missing on disk: ${artifactPath}`);
      }

      try {
        const content = await fsp.readFile(artifactPath, 'utf8');
        const data = JSON.parse(content);
        // Adjust scene indices/IDs to be globally unique or sequential
        allScenes.push(...(data.scenes || []));
      } catch (err: any) {
        throw new Error(
          `[NovelReduce] Failed to parse chunk artifact ${artifactPath}: ${err?.message || String(err)}`
        );
      }
    }

    if (allScenes.length === 0) {
      throw new Error(`[NovelReduce] No scenes found in any chunk artifacts.`);
    }

    // 3. Final Persistence (Heavy Transaction)
    // The ingest run already resolved its episode upstream; reduce must persist strictly into that episode.

    const createdSceneIds: string[] = [];

    await prisma.$transaction(
      async (tx) => {
        const episode = await tx.episode.findUnique({
          where: { id: episodeId },
          select: { id: true, projectId: true },
        });
        if (!episode) {
          throw new Error(`[NovelReduce] Episode ${episodeId} not found`);
        }
        if (episode.projectId !== projectId) {
          throw new Error(
            `[NovelReduce] Episode ownership mismatch: episode=${episode.projectId} job=${projectId}`
          );
        }

        // Clean up old matches
        const oldScenes = await tx.scene.findMany({ where: { episodeId }, select: { id: true } });
        const oldSceneIds = oldScenes.map((s) => s.id);
        if (oldSceneIds.length > 0) {
          await tx.shot.deleteMany({ where: { sceneId: { in: oldSceneIds } } });
          await tx.scene.deleteMany({ where: { episodeId } });
        }

        // Batch Insert Scenes & Shots
        for (const [sIdx, scene] of allScenes.entries()) {
          const dbScene = await tx.scene.create({
            data: {
              projectId,
              episodeId,
              sceneIndex: sIdx + 1,
              title: scene.title || `场景 ${sIdx + 1}`,
              summary: scene.description || scene.summary || '',
              enrichedText: scene.shots?.map((s: any) => s.text).join('\n') || '',
            },
          });
          createdSceneIds.push(dbScene.id);

          if (scene.shots && scene.shots.length > 0) {
            await tx.shot.createMany({
              data: scene.shots.map((shot: any, shIdx: number) => {
                const shotParams = {
                  sourceText: shot.text,
                  ...(shot.visualParams || {}),
                };
                const visual = shot.visualParams || {};

                return hydrateShotWithDirectorControls(
                  {
                    organizationId,
                    sceneId: dbScene.id,
                    index: shIdx + 1,
                    title: shot.title || `Shot ${shIdx + 1}`,
                    description: shot.summary || shot.text.slice(0, 50),
                    type: 'novel_reduce',
                    params: shotParams,
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
      },
      { timeout: 120000 }
    ); // Large novel = large transaction

    // 4. Update Final Status
    if (novelSourceId) {
      await prisma.novelSource.update({
        where: { id: novelSourceId },
        data: { status: 'COMPLETED' },
      });
    }

    await prisma.novelIngestRun.update({
      where: { id: ingestRunId },
      data: { status: 'COMPLETED' },
    });

    // 5. Cascade Trigger (Shot Planning)
    if (createdSceneIds.length > 0) {
      // P1-HARD: No longer allows fallback to Mock even in verification mode.
      const targetEngineKey = 'ce11_shot_generator_real';

      const cascadeJobs = createdSceneIds.map((sceneId, idx) => ({
        type: JobType.CE11_SHOT_GENERATOR,
        status: JobStatus.PENDING,
        projectId,
        organizationId,
        episodeId,
        sceneId,
        taskId: job.taskId,
        traceId: job.traceId,
        isVerification,
        priority: 5 + (idx % 10),
        dedupeKey: `novel_reduce_ce11_${sceneId}`,
        payload: {
          novelSceneId: sceneId,
          projectId,
          traceId: job.traceId,
          engineKey: targetEngineKey,
          isVerification,
        },
      }));

      // Create with bindings to satisfy PRODUCTION_MODE requirements
      const BATCH = 20;
      for (let i = 0; i < cascadeJobs.length; i += BATCH) {
        const batchJobs = cascadeJobs.slice(i, i + BATCH);
        await Promise.all(
          batchJobs.map((jobData) =>
            prisma.shotJob.upsert({
              where: { dedupeKey: jobData.dedupeKey },
              update: {},
              create: {
                ...jobData,
                engineBinding: {
                  create: {
                    engineKey: targetEngineKey,
                    engine: { connect: { engineKey: targetEngineKey } },
                    status: 'BOUND',
                  },
                },
              } satisfies Parameters<typeof prisma.shotJob.create>[0]['data'],
            })
          )
        );
      }
    }

    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

    return {
      status: 'SUCCEEDED',
      message: `Aggregated ${allScenes.length} scenes and triggered shot planning.`,
    };
  } catch (error: any) {
    stage4JobsTotal.inc({ type: job.type, status: 'FAILED' }, 1);
    throw error;
  }
}
