import { PrismaClient, ShotReviewStatus } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from './api-client';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { fileExists, ensureDir } from '../../../packages/shared/fs_async';
import { LocalStorageAdapter } from '@scu/storage';
import { ChildProcess } from 'child_process';
import * as util from 'util';
import { config } from '@scu/config';

const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
const activeProcesses = new Set<ChildProcess>();

export function cleanupVideoRenderProcesses() {
  process.stdout.write(
    util.format(`[VideoRender] Cleaning up ${activeProcesses.size} active processes...`) + '\n'
  );
  for (const cp of activeProcesses) {
    try {
      cp.kill('SIGKILL');
    } catch (e) {}
  }
  activeProcesses.clear();
}

function isImageKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.endsWith('.png') || k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.webp');
}

async function assertFrameFileOk(absPath: string): Promise<void> {
  const st = await fsp.stat(absPath);
  if (!st.isFile() || st.size <= 0) throw new Error(`Frame file missing/empty: ${absPath}`);
  if (st.size < 1_000) throw new Error(`Frame too small (corrupt?): ${absPath} size=${st.size}`);
}

export async function processVideoRenderJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = job.traceId || `trace-${jobId}`;
  const payload = job.payload as any;
  const pipelineRunId = payload.pipelineRunId;

  // 1. Root & Storage Resolver
  const storageRoot = (config as any).storageRoot;
  const storage = new LocalStorageAdapter(storageRoot);

  // 2. Shot Ownership & Approval Gate
  const shotId = payload?.shotId;
  if (!shotId && !pipelineRunId)
    throw new Error(`[VIDEO_RENDER] shotId or pipelineRunId is required.`);

  if (PRODUCTION_MODE && shotId) {
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      select: { reviewStatus: true },
    });
    if (
      !shot ||
      (shot.reviewStatus !== ShotReviewStatus.APPROVED &&
        shot.reviewStatus !== ShotReviewStatus.FINALIZED)
    ) {
      throw new Error(
        `PRODUCTION_MODE_FORBIDS_UNAPPROVED_VIDEO_RENDER: Shot ${shotId} is ${shot?.reviewStatus || 'MISSING'}`
      );
    }
  }

  // 3. Frame Aggregation logic
  let frameKeys = (payload.frameKeys as string[]) || [];
  if (pipelineRunId && frameKeys.length === 0) {
    console.log(`[Stage1] Aggregating frames for pipelineRunId: ${pipelineRunId}`);
    const renderJobs = await prisma.shotJob.findMany({
      where: {
        payload: { path: ['pipelineRunId'], equals: pipelineRunId },
        type: 'SHOT_RENDER',
        status: 'SUCCEEDED',
      },
      select: { result: true },
      orderBy: { createdAt: 'asc' },
    });
    frameKeys = renderJobs
      .map((j) => (j.result as any)?.storageKey || (j.result as any)?.imageKey)
      .filter(Boolean);
    if (frameKeys.length === 0)
      throw new Error(`No frames found for pipelineRunId: ${pipelineRunId}`);
  }

  if (frameKeys.length === 0) throw new Error('No frame keys provided');

  // 4. Workspace Preparation
  const workspaceDir = path.resolve(process.cwd(), 'workspace', jobId);
  if (!(await fileExists(workspaceDir))) await ensureDir(workspaceDir);

  let tempOutput = path.join(workspaceDir, 'output.mp4');

  try {
    // 5. Build FFmpeg Logic
    const fps = payload.fps || 24;
    const cmd = 'ffmpeg';
    let args: string[] = [];

    // Helper to resolve paths from multiple locations (Fix for mixed storage roots)
    const resolveAssetPath = async (key: string) => {
      console.log(`[ResolvePath] Resolving key: ${key}. CWD: ${process.cwd()}`);
      // 1. Try Storage Root
      const p1 = storage.getAbsolutePath(key);
      if (await fileExists(p1)) {
        console.log(`[ResolvePath] Found at Storage Root: ${p1}`);
        return p1;
      }

      // 2. Try Repo Root (for apps/workers/.runtime assets)
      const p2 = path.resolve(process.cwd(), '../../', key);
      if (await fileExists(p2)) {
        console.log(`[ResolvePath] Found at Repo Root: ${p2}`);
        return p2;
      }

      // 3. Try CWD relative
      const p3 = path.resolve(process.cwd(), key);
      if (await fileExists(p3)) {
        console.log(`[ResolvePath] Found at CWD: ${p3}`);
        return p3;
      }

      console.log(`[ResolvePath] FAILED to find file. Defaulting to: ${p1}`);
      return p1; // Default to storage path even if missing
    };

    if (frameKeys.length === 1 && isImageKey(frameKeys[0])) {
      // Single Image Loop Mode
      const inputAbs = await resolveAssetPath(frameKeys[0]);
      await assertFrameFileOk(inputAbs);
      args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-loop',
        '1',
        '-t',
        '1',
        '-i',
        inputAbs,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(fps),
        '-y',
        tempOutput,
      ];
    } else {
      // Concat Mode
      const listFilePath = path.join(workspaceDir, 'input.txt');
      const resolvedList = await Promise.all(frameKeys.map((k) => resolveAssetPath(k)));
      let listContent = resolvedList.map((abs) => `file '${abs}'\nduration 1.0`).join('\n');
      listContent += `\nfile '${resolvedList[resolvedList.length - 1]}'`;
      await fsp.writeFile(listFilePath, listContent);

      const useTestsrc = !PRODUCTION_MODE && process.env.VIDEO_RENDER_TESTSRC === '1';
      if (useTestsrc) {
        args = [
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=1:size=640x360:rate=24',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-y',
          tempOutput,
        ];
      } else {
        args = [
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listFilePath,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-r',
          String(fps),
          '-y',
          tempOutput,
        ];
      }
    }

    // PLAN-3: Audio Mixing Logic
    const audioTrack = payload.audioTrack;
    if (audioTrack) {
      console.log(`[VIDEO_RENDER] Found audio track: ${JSON.stringify(audioTrack)}`);
      // Resolve Audio Path (support storageKey or direct path)
      const audioKey = audioTrack.storageKey || audioTrack.mixed || audioTrack.path;
      if (audioKey) {
        const audioPath = await resolveAssetPath(audioKey);
        if (await fileExists(audioPath)) {
          // Add Audio Input
          // Note: Input 0 is Video (Loop or Concat List), Input 1 will be Audio
          args.push('-i', audioPath);

          // Map Streams: Video from 0, Audio from 1
          args.push('-map', '0:v');
          args.push('-map', '1:a');

          // Cut video/audio to shortest duration (e.g. if audio is longer than video frames)
          args.push('-shortest');

          // Ensure audio codec
          args.push('-c:a', 'aac');
        } else {
          console.warn(`[VIDEO_RENDER] Audio file not found at: ${audioPath}`);
        }
      }
    }

    // 6. Spawn FFmpeg
    console.log(`[VIDEO_RENDER] Executing: ${cmd} ${args.join(' ')}`);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(cmd, args);
      activeProcesses.add(proc);
      let stderr = '';
      proc.stderr?.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        activeProcesses.delete(proc);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-200)}`));
      });
    });

    // 7. Asset Registration & Upload
    const videoBuffer = await fsp.readFile(tempOutput);
    const sizeBytes = videoBuffer.length;
    const checksum = createHash('sha256').update(videoBuffer).digest('hex');

    // P4-FIX-1.1: Asset Idempotency (Prevent status regression)
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerType: 'SHOT',
          ownerId: shotId || pipelineRunId,
          type: 'VIDEO',
        },
      },
      create: {
        projectId: job.projectId || 'system',
        ownerType: 'SHOT',
        ownerId: shotId || pipelineRunId,
        type: 'VIDEO',
        status: 'GENERATED',
        storageKey: 'temp/pending',
        checksum: checksum,
        createdByJobId: jobId,
      },
      update: {
        // IMPORTANT: do not touch status here to prevent regression from PUBLISHED
        checksum,
        createdByJobId: jobId,
      },
    });

    const videoKey = `videos/${asset.id}.mp4`;

    // P4-FIX-0: Unified Storage Root (Single Source of Truth)
    const runtimeRoot = storageRoot;

    // Direct FS Write for MP4 (fs only)
    const finalVideoPath = path.join(runtimeRoot, videoKey);
    const finalVideoDir = path.dirname(finalVideoPath);
    if (!(await fileExists(finalVideoDir))) await ensureDir(finalVideoDir);

    await fsp.writeFile(finalVideoPath, videoBuffer);
    // REMOVED: await storage.put(videoKey, videoBuffer);

    // 7.5 HLS Generation (P4 Requirement)
    const hlsDir = path.join(workspaceDir, 'hls');
    if (!(await fileExists(hlsDir))) await ensureDir(hlsDir);
    const hlsOutput = path.join(hlsDir, 'master.m3u8');

    console.log(`[VIDEO_RENDER] Generating HLS...`);
    await new Promise<void>((resolve, reject) => {
      // Simple HLS: Split into 10s segments
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        tempOutput,
        '-start_number',
        '0',
        '-hls_time',
        '10',
        '-hls_list_size',
        '0',
        '-f',
        'hls',
        hlsOutput,
      ];
      const proc = spawn('ffmpeg', args);
      activeProcesses.add(proc);
      let stderr = '';
      proc.stderr?.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        activeProcesses.delete(proc);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg HLS failed (${code}): ${stderr}`));
      });
    });

    // Upload HLS (Direct FS Write only via Unified Root)
    const hlsStorageDir = `videos/${asset.id}/hls`;
    const finalHlsDir = path.join(runtimeRoot, hlsStorageDir);
    if (!(await fileExists(finalHlsDir))) await ensureDir(finalHlsDir);

    const hlsFiles = await fsp.readdir(hlsDir);
    for (const f of hlsFiles) {
      const buf = await fsp.readFile(path.join(hlsDir, f));
      await fsp.writeFile(path.join(finalHlsDir, f), buf);
      // REMOVED: await storage.put(...)
    }
    const hlsPlaylistUrl = `${hlsStorageDir}/master.m3u8`;

    await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey: videoKey, hlsPlaylistUrl: hlsPlaylistUrl },
    });

    // 8. Cost & Audit
    const latency = Date.now() - jobStartTime;
    await apiClient
      .postAuditLog({
        traceId,
        projectId: job.projectId || 'system',
        jobId,
        jobType: 'VIDEO_RENDER',
        engineKey: 'ffmpeg',
        status: 'SUCCESS',
        latencyMs: latency,
        auditTrail: { sizeBytes, checksum, frames: frameKeys.length, hls: hlsPlaylistUrl },
      })
      .catch(() => {});

    // 7.1 ffprobe evidence (fs only, Unified Root)
    const ffprobeKey = `${videoKey}.ffprobe.json`;
    try {
      const ffprobeAbs = path.join(runtimeRoot, ffprobeKey);

      const ffprobeArgs = [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        finalVideoPath,
      ];
      const ffprobeOut = await new Promise<string>((resolve, reject) => {
        const proc = spawn('ffprobe', ffprobeArgs);
        activeProcesses.add(proc);
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (d) => (stdout += d.toString()));
        proc.stderr?.on('data', (d) => (stderr += d.toString()));
        proc.on('close', (code) => {
          activeProcesses.delete(proc);
          if (code === 0) resolve(stdout);
          else reject(new Error(`ffprobe failed (${code}): ${stderr.slice(-200)}`));
        });
      });

      // Write ffprobe evidence
      await fsp.writeFile(ffprobeAbs, ffprobeOut, 'utf-8');
      console.log(`[VIDEO_RENDER] ffprobe evidence stored: ${ffprobeAbs}`);
    } catch (e: any) {
      // ✅ Real Baseline: ffprobe must exist, so fail hard.
      throw new Error(`[VIDEO_RENDER] ffprobe evidence generation failed: ${e.message}`);
    }

    // 7.2 Publish (Stage-1 Real Baseline)
    const shouldPublish = payload?.publish === true;
    if (shouldPublish) {
      const projectId = payload.projectId || job.projectId;
      const episodeId = payload.episodeId;
      if (!projectId || !episodeId) {
        throw new Error(`[VIDEO_RENDER] publish=true but missing projectId/episodeId`);
      }

      // P4-FIX-1.3: PublishedVideo Upsert (Idempotency) using SQL
      const dedupeKey = createHash('sha256')
        .update(`${projectId}:${episodeId}:${pipelineRunId}`)
        .digest('hex');

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO published_videos (id, "projectId", "episodeId", "assetId", "storageKey", checksum, status, metadata, "dedupe_key", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', $7::jsonb, $8, NOW(), NOW())
        ON CONFLICT (dedupe_key)
        DO UPDATE SET
          "assetId" = EXCLUDED."assetId",
          "storageKey" = EXCLUDED."storageKey",
          checksum = EXCLUDED.checksum,
          status = 'PUBLISHED',
          metadata = EXCLUDED.metadata,
          "updatedAt" = NOW()
        `,
        crypto.randomUUID(),
        projectId,
        episodeId,
        asset.id,
        videoKey,
        checksum,
        JSON.stringify({ pipelineRunId, ffprobeKey }),
        dedupeKey
      );

      // Force asset to PUBLISHED status (safe because we rely on PublishedVideo uniqueness now)
      await prisma.asset.update({
        where: { id: asset.id },
        data: { status: 'PUBLISHED' },
      });

      console.log(
        `[VIDEO_RENDER] PublishedVideo set to PUBLISHED: projectId=${projectId} episodeId=${episodeId} pipelineRunId=${pipelineRunId} dedupeKey=${dedupeKey}`
      );
    }

    // 9. Return Result
    return {
      assetId: asset.id,
      storageKey: videoKey,
      videoKey,
      sizeBytes,
      checksum,
      durationMs: latency,
      status: 'SUCCESS',
    };
  } finally {
    if (await fileExists(workspaceDir)) {
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    }
  }
}
