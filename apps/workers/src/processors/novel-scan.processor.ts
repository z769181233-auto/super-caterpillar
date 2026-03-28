import { PrismaClient, JobType, JobStatus } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { createHash } from 'crypto';
import { fileExists } from '../../../../packages/shared/fs_async';
import { ProcessorContext } from '../types/processor-context';
import { streamScanFile, ScanResult } from '../../../../packages/ingest/stream_scan';
import {
  ensureDefaultMetrics,
  stage4JobsTotal,
  stage4FailedJobs,
  stage4DurationSeconds,
  stage4PeakRssMb,
  stage4ThroughputBps,
} from '../observability/stage4.metrics';

async function sha256FileRange(
  filePath: string,
  startByte: number,
  endByteExclusive: number
): Promise<string> {
  if (endByteExclusive <= startByte) {
    return createHash('sha256').digest('hex');
  }

  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath, {
      start: startByte,
      end: endByteExclusive - 1,
    });

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Stage 4: NOVEL_SCAN_TOC Processor (Hardened)
 *
 * 职责：
 * 1. Stream Scan (0-Memory-Bomb).
 * 2. Fan-out Chunks (Payload < 16KB).
 */
export async function processNovelScan(context: ProcessorContext) {
  ensureDefaultMetrics();
  const workerConfig = config as typeof config & { storageRoot: string };
  const t0 = Date.now();
  let peakRssMb = 0;

  function sampleRss() {
    const rss = process.memoryUsage().rss;
    const mb = Math.round(rss / 1024 / 1024);
    if (mb > peakRssMb) peakRssMb = mb;
  }

  const { prisma, job, workerId } = context;
  const { projectId, options, isVerification } = job.payload;
  const fileKey = job.payload.fileKey || job.payload.filePath;
  const organizationId = job.organizationId;

  if (!projectId) {
    throw new Error('[NovelScan] Missing projectId');
  }
  if (!organizationId) {
    throw new Error('[NovelScan] Missing organizationId');
  }
  if (!fileKey) {
    throw new Error('[NovelScan] Missing fileKey/filePath');
  }

  try {
    stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
    sampleRss();

    const engine = await prisma.engine.findUnique({ where: { engineKey: 'ce06_novel_parsing' } });
    if (!engine) {
      throw new Error('[NovelScan] ce06_novel_parsing engine not found in DB.');
    }

    if (job.payload.novelSourceId) {
      await prisma.novelSource
        .update({
          where: { id: job.payload.novelSourceId },
          data: { status: 'SCANNING' },
        })
        .catch(() => {});
    }

    // 1. Path Resolution
    let filePath = fileKey;
    if (!path.isAbsolute(filePath)) {
      const storageRoot = workerConfig.storageRoot;
      filePath = path.resolve(storageRoot, fileKey);
    }

    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelScan] Source file not found: ${filePath}`);
    }

    // 2. Stream Scan
    const episodes = await streamScanFile(filePath);
    sampleRss();

    // 2.1 Create NovelIngestRun (Versioned SSOT)
    const ingestRun = await prisma.novelIngestRun.create({
      data: {
        projectId,
        organizationId,
        novelSourceId: job.payload.novelSourceId,
        status: 'PROCESSING',
        ...(typeof job.payload.manifestHash === 'string' && job.payload.manifestHash.length > 0
          ? { manifestHash: job.payload.manifestHash }
          : {}),
        ...(typeof job.payload.engineVersion === 'string' && job.payload.engineVersion.length > 0
          ? { engineVersion: job.payload.engineVersion }
          : {}),
      },
    });

    // 2.2 Update NovelSource Stats
    const nsId = job.payload.novelSourceId;
    if (nsId) {
      await prisma.novelSource
        .update({
          where: { id: nsId },
          data: {
            status: 'PARSING',
            totalChapters: episodes.length,
            processedChunks: 0,
          },
        })
        .catch(() => {});
    }

    // 4. Batch Create NovelChunks & Jobs
    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE);
      const batchWithHashes = await Promise.all(
        batch.map(async (ep) => ({
          ep,
          sha256: await sha256FileRange(filePath, ep.startByte, ep.endByte),
        }))
      );

      await prisma.$transaction(
        async (tx) => {
          for (const [idx, item] of batchWithHashes.entries()) {
            const globalIndex = i + idx + 1;
            const { ep, sha256 } = item;

            // A. Create NovelChunk Record
            const chunkBusinessKey = `${ingestRun.id}_${globalIndex}`;
            const dbChunk = await tx.novelChunk.upsert({
              where: { chunkId: chunkBusinessKey },
              update: {
                offsetStart: ep.startByte,
                offsetEnd: ep.endByte,
                sha256,
              },
              create: {
                ingestRunId: ingestRun.id,
                chunkId: chunkBusinessKey,
                chNo: globalIndex,
                volNo: 1,
                offsetStart: ep.startByte,
                offsetEnd: ep.endByte,
                sha256,
                status: 'PENDING',
              },
            });

            // B. Dispatch Job
            const jobPayload = {
              projectId,
              episodeId: job.payload.episodeId,
              fileKey,
              chunkId: dbChunk.id, // Primary key of NovelChunk
              ingestRunId: ingestRun.id,
              startByte: ep.startByte,
              endByte: ep.endByte,
              title: ep.title,
              novelSourceId: nsId,
              isVerification: !!isVerification,
            };

            const dedupeKey = `novel_chunk_${ingestRun.id}_${globalIndex}`;
            const newJob = await tx.shotJob.upsert({
              where: { dedupeKey },
              update: {},
              create: {
                dedupeKey,
                organizationId,
                projectId,
                episodeId: job.payload.episodeId,
                type: JobType.NOVEL_CHUNK_PARSE,
                status: 'PENDING',
                priority: 10,
                payload: jobPayload,
                taskId: job.taskId,
                traceId: job.traceId,
                isVerification: !!isVerification,
                engineBinding: {
                  create: {
                    engineId: engine.id,
                    engineKey: engine.engineKey,
                    status: 'BOUND',
                  },
                },
              },
            });

            await tx.jobEngineBinding.upsert({
              where: { jobId: newJob.id },
              update: {},
              create: {
                jobId: newJob.id,
                engineId: engine.id,
                engineKey: engine.engineKey,
                status: 'BOUND',
              },
            });
          }
        },
        { timeout: 15000 }
      );

      processedCount += batch.length;
      if (processedCount % 500 === 0) {
        sampleRss();
      }
    }

    // 5. Success Tracking
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

    return {
      status: 'SUCCEEDED',
      message: `Dispatched ${episodes.length} chunks for ingestRun ${ingestRun.id}`,
    };
  } catch (e: any) {
    // 6. Fail-Safe NovelSource status update
    if (job.payload.novelSourceId) {
      await prisma.novelSource
        .update({
          where: { id: job.payload.novelSourceId },
          data: {
            status: 'FAILED',
            error: e.message || String(e),
          },
        })
        .catch(() => {});
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
