import { PrismaClient, ShotReviewStatus } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from './api-client';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'path';
import { LocalStorageAdapter } from '@scu/storage';
import { ChildProcess } from 'child_process';
import * as util from 'util';

const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
const activeProcesses = new Set<ChildProcess>();

export function cleanupVideoRenderProcesses() {
  process.stdout.write(util.format(`[VideoRender] Cleaning up ${activeProcesses.size} active processes...`) + '\n');
  for (const cp of activeProcesses) {
    try { cp.kill('SIGKILL'); } catch (e) { }
  }
  activeProcesses.clear();
}

function isImageKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.endsWith('.png') || k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.webp');
}

async function assertFrameFileOk(absPath: string): Promise<void> {
  const st = await fsPromises.stat(absPath);
  if (!st.isFile() || st.size <= 0) throw new Error(`Frame file missing/empty: ${absPath}`);
  if (st.size < 10_000) throw new Error(`Frame too small (corrupt?): ${absPath} size=${st.size}`);
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
  let storageRoot: string;
  if (process.env.REPO_ROOT) {
    storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
  } else if (process.env.STORAGE_ROOT) {
    storageRoot = process.env.STORAGE_ROOT;
  } else {
    storageRoot = path.join(path.resolve(process.cwd(), '../../'), '.data/storage');
  }
  const storage = new LocalStorageAdapter(storageRoot);

  // 2. Shot Ownership & Approval Gate
  const shotId = payload?.shotId;
  if (!shotId && !pipelineRunId) throw new Error(`[VIDEO_RENDER] shotId or pipelineRunId is required.`);

  if (PRODUCTION_MODE && shotId) {
    const shot = await prisma.shot.findUnique({ where: { id: shotId }, select: { reviewStatus: true } });
    if (!shot || (shot.reviewStatus !== ShotReviewStatus.APPROVED && shot.reviewStatus !== ShotReviewStatus.FINALIZED)) {
      throw new Error(`PRODUCTION_MODE_FORBIDS_UNAPPROVED_VIDEO_RENDER: Shot ${shotId} is ${shot?.reviewStatus || 'MISSING'}`);
    }
  }

  // 3. Frame Aggregation logic
  let frameKeys = payload.frameKeys as string[] || [];
  if (pipelineRunId && frameKeys.length === 0) {
    console.log(`[Stage1] Aggregating frames for pipelineRunId: ${pipelineRunId}`);
    const renderJobs = await prisma.shotJob.findMany({
      where: {
        payload: { path: ['pipelineRunId'], equals: pipelineRunId },
        type: 'SHOT_RENDER',
        status: 'SUCCEEDED'
      },
      select: { result: true },
      orderBy: { createdAt: 'asc' }
    });
    frameKeys = renderJobs.map(j => (j.result as any)?.storageKey || (j.result as any)?.imageKey).filter(Boolean);
    if (frameKeys.length === 0) throw new Error(`No frames found for pipelineRunId: ${pipelineRunId}`);
  }

  if (frameKeys.length === 0) throw new Error('No frame keys provided');

  // 4. Workspace Preparation
  const workspaceDir = path.resolve(process.cwd(), 'workspace', jobId);
  if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

  let tempOutput = path.join(workspaceDir, 'output.mp4');

  try {
    // 5. Build FFmpeg Logic
    const fps = payload.fps || 24;
    const cmd = 'ffmpeg';
    let args: string[] = [];

    if (frameKeys.length === 1 && isImageKey(frameKeys[0])) {
      // Single Image Loop Mode
      const inputAbs = storage.getAbsolutePath(frameKeys[0]);
      await assertFrameFileOk(inputAbs);
      args = ['-hide_banner', '-loglevel', 'error', '-loop', '1', '-t', '1', '-i', inputAbs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), '-y', tempOutput];
    } else {
      // Concat Mode
      const listFilePath = path.join(workspaceDir, 'input.txt');
      let listContent = frameKeys.map(k => `file '${storage.getAbsolutePath(k)}'\nduration 1.0`).join('\n');
      listContent += `\nfile '${storage.getAbsolutePath(frameKeys[frameKeys.length - 1])}'`;
      fs.writeFileSync(listFilePath, listContent);

      const useTestsrc = !PRODUCTION_MODE && process.env.VIDEO_RENDER_TESTSRC === '1';
      if (useTestsrc) {
        args = ['-f', 'lavfi', '-i', 'testsrc=duration=1:size=640x360:rate=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', tempOutput];
      } else {
        args = ['-f', 'concat', '-safe', '0', '-i', listFilePath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps), '-y', tempOutput];
      }
    }

    // 6. Spawn FFmpeg
    console.log(`[VIDEO_RENDER] Executing: ${cmd} ${args.join(' ')}`);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(cmd, args);
      activeProcesses.add(proc);
      let stderr = '';
      proc.stderr?.on('data', d => stderr += d.toString());
      proc.on('close', code => {
        activeProcesses.delete(proc);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-200)}`));
      });
    });

    // 7. Asset Registration & Upload
    const videoBuffer = fs.readFileSync(tempOutput);
    const sizeBytes = videoBuffer.length;
    const checksum = createHash('sha256').update(videoBuffer).digest('hex');

    const asset = await prisma.asset.upsert({
      where: { ownerType_ownerId_type: { ownerType: 'SHOT', ownerId: shotId || pipelineRunId, type: 'VIDEO' } },
      create: {
        projectId: job.projectId || 'system',
        ownerType: 'SHOT',
        ownerId: shotId || pipelineRunId,
        type: 'VIDEO',
        status: 'GENERATED',
        storageKey: 'temp/pending',
        checksum: checksum,
        createdByJobId: jobId
      },
      update: { status: 'GENERATED', checksum: checksum, createdByJobId: jobId }
    });

    const videoKey = `videos/${asset.id}.mp4`;
    await storage.put(videoKey, videoBuffer);
    await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: videoKey } });

    // 8. Cost & Audit
    const latency = Date.now() - jobStartTime;
    await apiClient.postAuditLog({
      traceId, projectId: job.projectId || 'system', jobId, jobType: 'VIDEO_RENDER',
      engineKey: 'ffmpeg', status: 'SUCCESS', latencyMs: latency,
      auditTrail: { sizeBytes, checksum, frames: frameKeys.length }
    }).catch(() => { });

    // 7.1 ffprobe evidence (required by Real Baseline)
    const ffprobeKey = `${videoKey}.ffprobe.json`;
    try {
      const ffprobeArgs = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', storage.getAbsolutePath(videoKey)];
      const ffprobeOut = await new Promise<string>((resolve, reject) => {
        const proc = spawn('ffprobe', ffprobeArgs);
        activeProcesses.add(proc);
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', d => stdout += d.toString());
        proc.stderr?.on('data', d => stderr += d.toString());
        proc.on('close', code => {
          activeProcesses.delete(proc);
          if (code === 0) resolve(stdout);
          else reject(new Error(`ffprobe failed (${code}): ${stderr.slice(-200)}`));
        });
      });
      await storage.put(ffprobeKey, Buffer.from(ffprobeOut, 'utf-8'));
      console.log(`[VIDEO_RENDER] ffprobe evidence stored: ${ffprobeKey}`);
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

      // publishedVideo schema 可能没有 upsert 唯一键：用 findFirst + update/create 保守实现
      const existed = await prisma.publishedVideo.findFirst({
        where: {
          projectId,
          episodeId,
          metadata: { path: ['pipelineRunId'], equals: pipelineRunId },
        },
        select: { id: true },
      });

      if (existed) {
        await prisma.publishedVideo.update({
          where: { id: existed.id },
          data: {
            assetId: asset.id,
            storageKey: videoKey,
            checksum: checksum,
            status: 'PUBLISHED',
            metadata: { pipelineRunId, ffprobeKey },
          },
        });
      } else {
        await prisma.publishedVideo.create({
          data: {
            projectId,
            episodeId,
            assetId: asset.id,
            storageKey: videoKey,
            checksum,
            status: 'PUBLISHED',
            metadata: { pipelineRunId, ffprobeKey },
          },
        });
      }

      console.log(`[VIDEO_RENDER] PublishedVideo set to PUBLISHED: projectId=${projectId} episodeId=${episodeId} pipelineRunId=${pipelineRunId}`);
    }

    // 9. Return Result
    return { assetId: asset.id, storageKey: videoKey, videoKey, sizeBytes, checksum, durationMs: latency, status: 'SUCCESS' };

  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}
