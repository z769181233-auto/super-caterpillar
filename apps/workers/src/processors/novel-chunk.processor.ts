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
  const { projectId, chunkId: dbChunkId, startByte, endByte, isVerification, ingestRunId } = job.payload;
  const fileKey = job.payload.fileKey || job.payload.filePath;

  try {
    stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
    sampleRss();

    // 1. Update Chunk Status to PROCESSING
    await prisma.novelChunk.update({
      where: { id: dbChunkId },
      data: { status: 'PROCESSING' }
    });

    console.log(
      `[NovelChunk] Parsing Project ${projectId}, Chunk ${dbChunkId}, Bytes ${startByte}-${endByte}`
    );

    // 2. Path Resolution
    let filePath = fileKey;
    if (!path.isAbsolute(filePath)) {
      const storageRoot = (config as any).storageRoot || '/tmp/storage';
      filePath = path.resolve(storageRoot, fileKey);
    }

    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelChunk] Source file not found: ${filePath}`);
    }

    // 3. Stream Slice
    const chunkText = await readChunk(filePath, startByte, endByte);
    sampleRss();

    let analyzedScenes: any[] = [];

    // P6-2-2-4: Multi-Agent Collaboration
    const useDeepAnalysis =
      process.env.USE_MULTI_AGENT === 'true' || process.env.USE_MULTI_AGENT === '1';

    if (useDeepAnalysis) {
      console.log(`[NovelChunk] Using Deep Multi-Agent Analysis for chunk ${dbChunkId}...`);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { stylePrompt: true, styleGuide: true },
      });

      const contextPrompt = {
        projectId,
        traceId: job.id,
        rawText: chunkText,
        chapterTitle: job.payload.title || `Chunk ${dbChunkId}`,
        chapterIndex: 0, // Not strictly needed for MAP
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
        console.error(`[NovelChunk] Multi-Agent failed: ${err.message}. Falling back.`);
        const structure = basicTextSegmentation(chunkText, projectId);
        analyzedScenes = structure.episodes.flatMap(ep => ep.scenes);
      }
    } else {
      const structure = basicTextSegmentation(chunkText, projectId);
      analyzedScenes = structure.episodes.flatMap(ep => ep.scenes);
    }

    // 4. Save Artifact (MAP Product)
    const storageRoot = (config as any).storageRoot || '/tmp/storage';
    const artifactDir = path.join(storageRoot, 'artifacts', 'chunks', ingestRunId);
    if (!fs.existsSync(artifactDir)) {
      await fsp.mkdir(artifactDir, { recursive: true });
    }
    const artifactPath = path.join(artifactDir, `${dbChunkId}.json`);
    await fsp.writeFile(artifactPath, JSON.stringify({
      chunkId: dbChunkId,
      projectId,
      startByte,
      endByte,
      scenes: analyzedScenes,
    }, null, 2));

    const relativeArtifactUrl = path.relative(storageRoot, artifactPath);

    // 5. Update Chunk Status to COMPLETED
    await prisma.novelChunk.update({
      where: { id: dbChunkId },
      data: {
        status: 'COMPLETED',
        artifactUrl: relativeArtifactUrl,
      }
    });

    // 6. Progress and Aggregator Trigger
    const nsId = job.payload.novelSourceId;
    if (nsId) {
      // Atomic increment and check
      const ns = await prisma.novelSource.update({
        where: { id: nsId },
        data: { processedChunks: { increment: 1 } },
        select: { processedChunks: true, totalChapters: true }
      });

      console.log(`[NovelChunk] Progress: ${ns.processedChunks}/${ns.totalChapters} for source ${nsId}`);

      if (ns.processedChunks >= ns.totalChapters) {
        console.log(`[NovelChunk] 🏁 All chunks completed for run ${ingestRunId}. Triggering REDUCE phase.`);

        await prisma.novelIngestRun.update({
          where: { id: ingestRunId },
          data: { status: 'COMPLETED' } // Or 'AGGREGATING'
        });

        // Trigger NOVEL_REDUCE_AGGREGATE
        await prisma.shotJob.create({
          data: {
            organizationId: job.organizationId as string,
            projectId,
            type: 'NOVEL_REDUCE_AGGREGATE' as any,
            status: 'PENDING',
            payload: {
              projectId,
              ingestRunId,
              novelSourceId: nsId,
              isVerification,
            },
            taskId: job.taskId,
            traceId: job.traceId,
            engineBinding: {
              create: {
                engineKey: 'ce06_novel_aggregator',
                engine: { connect: { engineKey: 'ce06_novel_aggregator' } },
                status: 'BOUND',
              }
            }
          }
        });
      }
    }

    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

    return {
      status: 'SUCCEEDED',
      message: `MAP completed for chunk ${dbChunkId}. Artifact saved.`,
      artifactUrl: relativeArtifactUrl
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
