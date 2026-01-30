import { PrismaClient, JobType, JobStatus } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { fileExists } from '../../../../packages/shared/fs_async';
import { ProcessorContext } from '../types/processor-context';
import { streamScanFile, ScanResult } from '../../../../packages/ingest/stream_scan';

/**
 * Stage 4: NOVEL_SCAN_TOC Processor (Hardened)
 *
 * 职责：
 * 1. Stream Scan (0-Memory-Bomb).
 * 2. Fan-out Chunks (Payload < 16KB).
 */
export async function processNovelScan(context: ProcessorContext) {
  const { prisma, job, workerId } = context;
  const { projectId, fileKey, options } = job.payload;

  console.log(`[NovelScan] Starting Scan for Project ${projectId}, File: ${fileKey}`);

  // 1. Path Resolution
  let filePath = fileKey;
  if (!(await fileExists(filePath))) {
    filePath = path.resolve(process.cwd(), fileKey);
  }

  if (!(await fileExists(filePath))) {
    throw new Error(`[NovelScan] Source file not found: ${filePath}`);
  }

  // 2. Stream Scan
  // Logic extracted to packages/ingest/stream_scan.ts
  const episodes = await streamScanFile(filePath);

  console.log(`[NovelScan] Scanned ${episodes.length} episodes via Stream.`);

  // 3. Transaction Write & Fan-out
  await prisma.$transaction(async (tx) => {
    // Create Season
    const season = await tx.season.create({
      data: {
        projectId,
        index: 1,
        title: '第一季',
        description: 'Auto-scanned from upload',
      },
    });

    // Batch Create Episodes & Jobs
    // Batch size 50 to keep transaction time low
    const BATCH_SIZE = 50;
    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (ep: ScanResult, idx: number) => {
          const globalIndex = i + idx + 1;

          // A. DB Insert
          const dbEp = await tx.episode.create({
            data: {
              seasonId: season.id,
              projectId,
              index: globalIndex,
              name: ep.title,
              summary: `Lines ${ep.startLine}-${ep.endLine}`,
            },
          });

          // B. Construct Job Payload
          const jobPayload = {
            projectId,
            fileKey, // Reference ONLY. No body text.
            startLine: ep.startLine,
            endLine: ep.endLine,
            episodeId: dbEp.id,
          };

          // [HARDENING] Payload Size Assert (P3'-2 Requirement)
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
              episodeId: dbEp.id,
              sceneId: null,
              shotId: null,
              type: JobType.NOVEL_CHUNK_PARSE,
              status: JobStatus.PENDING,
              priority: 50,
              payload: jobPayload,
            },
          });
        })
      );
    }
  });

  console.log(`[NovelScan] Fan-out complete. Dispatched ${episodes.length} parse jobs.`);
}
