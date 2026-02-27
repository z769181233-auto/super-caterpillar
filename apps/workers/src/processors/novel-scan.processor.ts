import { PrismaClient, JobType, JobStatus } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
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

/**
 * Stage 4: NOVEL_SCAN_TOC Processor (Hardened)
 *
 * 职责：
 * 1. Stream Scan (0-Memory-Bomb).
 * 2. Fan-out Chunks (Payload < 16KB).
 */
export async function processNovelScan(context: ProcessorContext) {
  ensureDefaultMetrics();
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

  try {
    stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
    sampleRss();

    const engine = await prisma.engine.findFirst({ where: { engineKey: 'ce06_novel_parsing' } });
    if (!engine) {
      throw new Error('[NovelScan] ce06_novel_parsing engine not found in DB.');
    }

    console.log(`[NovelScan] Starting Scan for Project ${projectId}, File: ${fileKey}`);

    if (job.payload.novelSourceId) {
      await prisma.novelSource
        .update({
          where: { id: job.payload.novelSourceId },
          data: { status: 'SCANNING' },
        })
        .catch(() => { });
    }

    // 1. Path Resolution
    let filePath = fileKey;
    if (!path.isAbsolute(filePath)) {
      const storageRoot = (config as any).storageRoot;
      filePath = path.resolve(storageRoot, fileKey);
    }

    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelScan] Source file not found: ${filePath}`);
    }

    // 2. Stream Scan
    const episodes = await streamScanFile(filePath);
    sampleRss();

    console.log(`[NovelScan] Scanned ${episodes.length} episodes via Stream.`);

    // 2.1 Create NovelIngestRun (Versioned SSOT)
    const ingestRun = await prisma.novelIngestRun.create({
      data: {
        projectId,
        organizationId: job.organizationId as string,
        novelSourceId: job.payload.novelSourceId,
        manifestHash: job.payload.manifestHash || 'v1',
        engineVersion: job.payload.engineVersion || 'ce06-v3',
        status: 'PROCESSING',
      },
    });

    // 2.2 Update NovelSource Stats
    const nsId = job.payload.novelSourceId;
    if (nsId) {
      await prisma.novelSource.update({
        where: { id: nsId },
        data: {
          status: 'PARSING' as any,
          totalChapters: episodes.length,
          processedChunks: 0,
        },
      }).catch(() => { });
    }

    // 4. Batch Create NovelChunks & Jobs
    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        async (tx) => {
          for (const [idx, ep] of batch.entries()) {
            const globalIndex = i + idx + 1;

            // A. Create NovelChunk Record
            const dbChunk = await tx.novelChunk.create({
              data: {
                ingestRunId: ingestRun.id,
                chunkId: `${ingestRun.id}_${globalIndex}`, // Idempotent key
                chNo: globalIndex,
                volNo: 1, // Default volume
                offsetStart: ep.startByte,
                offsetEnd: ep.endByte,
                sha256: '', // Optional: placeholder for content hash
                status: 'PENDING',
              },
            });

            // B. Dispatch Job
            const jobPayload = {
              projectId,
              fileKey,
              chunkId: dbChunk.id, // Primary key of NovelChunk
              ingestRunId: ingestRun.id,
              startByte: ep.startByte,
              endByte: ep.endByte,
              title: ep.title,
              novelSourceId: nsId,
              isVerification: !!isVerification,
            };

            const newJob = await tx.shotJob.create({
              data: {
                organizationId: job.organizationId as string,
                projectId,
                type: JobType.NOVEL_CHUNK_PARSE,
                status: 'PENDING',
                priority: 10,
                payload: jobPayload,
                taskId: job.taskId,
                isVerification: !!isVerification,
              },
            });

            await tx.jobEngineBinding.create({
              data: {
                jobId: newJob.id,
                engineId: engine.id,
                engineKey: engine.engineKey,
                status: 'BOUND',
              }
            });
          }
        },
        { timeout: 15000 }
      );

      processedCount += batch.length;
      if (processedCount % 500 === 0) {
        console.log(`[NovelScan] Progress: ${processedCount}/${episodes.length} chunks created.`);
        sampleRss();
      }
    }

    console.log(`[NovelScan] Fan-out complete. Dispatched ${episodes.length} chunks.`);

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
