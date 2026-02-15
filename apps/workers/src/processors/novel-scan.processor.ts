import { PrismaClient, JobType, JobStatus } from 'database';
import { config } from 'config';
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
      const storageRoot = config.storageRoot;
      filePath = path.resolve(storageRoot, fileKey);
    }

    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelScan] Source file not found: ${filePath}`);
    }

    // 2. Stream Scan
    // Logic extracted to packages/ingest/stream_scan.ts
    const episodes = await streamScanFile(filePath);
    sampleRss();

    console.log(`[NovelScan] Scanned ${episodes.length} episodes via Stream.`);

    // 2.1 Update NovelSource & Novel (Stats)
    const nsId = job.payload.novelSourceId;
    if (nsId) {
      await Promise.all([
        prisma.novelSource.update({
          where: { id: nsId },
          data: {
            status: 'PARSING' as any,
            totalChapters: episodes.length,
            processedChunks: 0,
          },
        }),
        // SSSOT Sync: Update Novel (API/Frontend Model)
        prisma.novel.update({
          where: { projectId },
          data: {
            status: 'PARSING',
            chapterCount: episodes.length,
          },
        }).catch(() => null), // Novel might not exist for some legacy projects
      ]).catch((e) => console.error(`[NovelScan] Failed to sync Novel/Source ${nsId}`, e));
    }

    // 3. Create Season (Single Transaction) - Idempotent
    const season = await prisma.season.upsert({
      where: {
        projectId_index: {
          projectId,
          index: 1,
        },
      },
      update: {},
      create: {
        projectId,
        index: 1,
        title: '第一季',
        description: 'Auto-scanned from upload',
      },
    });

    // 4. Batch Create Episodes & Jobs (Small Transactions)
    // Batch size 50 to keep transaction time low and prevent lock contention
    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        async (tx) => {
          // Use efficient createMany if possible?
          // Prisma createMany doesn't return IDs easily for dependent records (Jobs).
          // So we have to loop or use query raw?
          // For 50 items, loop await is acceptable if inside tx.

          for (const [idx, ep] of batch.entries()) {
            const globalIndex = i + idx + 1;

            // A. DB Insert Episode
            const dbEp = await tx.episode.create({
              data: {
                seasonId: season.id,
                projectId,
                index: globalIndex,
                name: ep.title,
                summary: `Bytes ${ep.startByte}-${ep.endByte}`,
              },
            });

            // B. Construct Job Payload with Byte Ranges
            const jobPayload = {
              projectId,
              fileKey: fileKey,
              startByte: ep.startByte,
              endByte: ep.endByte,
              episodeId: dbEp.id,
              title: ep.title,
              novelSourceId: nsId, // Pass the parent ID
              isVerification: !!isVerification,
            };

            // [HARDENING] Payload Size Assert
            const payloadSize = Buffer.byteLength(JSON.stringify(jobPayload));
            if (payloadSize > 16 * 1024) {
              throw new Error(
                `[NovelScan] Payload Size Violation: ${payloadSize} bytes > 16KB limit.`
              );
            }

            // C. Create Job
            await tx.shotJob.create({
              data: {
                organizationId: job.organizationId as string,
                projectId,
                type: JobType.NOVEL_CHUNK_PARSE,
                status: 'PENDING',
                priority: 10,
                payload: jobPayload,
                taskId: job.taskId,
                episodeId: dbEp.id,
                isVerification: !!isVerification,
              },
            });
          }
        },
        { timeout: 10000 }
      ); // 10s timeout for batch of 50

      processedCount += batch.length;
      if (processedCount % 500 === 0) {
        console.log(
          `[NovelScan] Progress: ${processedCount}/${episodes.length} episodes processed.`
        );
        sampleRss();
      }
    }

    console.log(`[NovelScan] Fan-out complete. Dispatched ${episodes.length} chunk jobs.`);

    // Metrics: Success
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

    // Best-effort throughput (Total bytes / duration)
    try {
      const stats = await fsp.stat(filePath);
      if (durationSec > 0) {
        stage4ThroughputBps.set({ type: job.type }, stats.size / durationSec);
      }
    } catch { }

    return { status: 'SUCCEEDED', message: `Dispatched ${episodes.length} chunk jobs.` };
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
