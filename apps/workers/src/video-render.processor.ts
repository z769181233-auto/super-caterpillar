import { AssetOwnerType, AssetRole, AssetType, JobType, PrismaClient, ShotReviewStatus } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from './api-client';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { fileExists, ensureDir } from '../../../packages/shared/fs_async';
import { LocalStorageAdapter } from '@scu/storage';
import { ChildProcess } from 'child_process';
import { config } from '@scu/config';
import sharp from 'sharp';

const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
const activeProcesses = new Set<ChildProcess>();
const workerConfig = config as typeof config & { storageRoot: string };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function getStringArrayField(source: JsonRecord, key: string): string[] {
  const value = source[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getRecordField(source: JsonRecord, key: string): JsonRecord | undefined {
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

function parsePositiveNumber(
  rawValue: unknown,
  field: string,
  { integerOnly = false }: { integerOnly?: boolean } = {}
): number {
  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim().length > 0
        ? Number(rawValue)
        : NaN;

  if (!Number.isFinite(value) || value <= 0 || (integerOnly && !Number.isInteger(value))) {
    throw new Error(
      `[VIDEO_RENDER] Invalid ${field}: explicit positive ${integerOnly ? 'integer ' : ''}value required`
    );
  }

  return value;
}

function requireNonEmptyString(value: unknown, contextTag: string, field: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`[${contextTag}] Missing ${field}`);
}

export function cleanupVideoRenderProcesses() {
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
  const payload = isRecord(job.payload) ? job.payload : {};
  const traceId = requireNonEmptyString(job.traceId ?? getStringField(payload, 'traceId'), 'VIDEO_RENDER', 'traceId');
  const pipelineRunId = getStringField(payload, 'pipelineRunId');
  const projectId = getStringField(payload, 'projectId') ?? job.projectId;

  // 1. Root & Storage Resolver
  const storageRoot = workerConfig.storageRoot;
  const storage = new LocalStorageAdapter(storageRoot);

  // 2. Shot Ownership & Approval Gate
  const shotId = getStringField(payload, 'shotId');
  if (!shotId && !pipelineRunId)
    throw new Error(`[VIDEO_RENDER] shotId or pipelineRunId is required.`);
  if (!projectId) {
    throw new Error('[VIDEO_RENDER] projectId is required');
  }

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
  let frameKeys = getStringArrayField(payload, 'frameKeys');
  if (pipelineRunId && frameKeys.length === 0) {
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
      .map((j) => {
        const result = isRecord(j.result) ? j.result : undefined;
        return result
          ? getStringField(result, 'storageKey') || getStringField(result, 'imageKey')
          : undefined;
      })
      .filter((key): key is string => typeof key === 'string');
    if (frameKeys.length === 0)
      throw new Error(`No frames found for pipelineRunId: ${pipelineRunId}`);
  }

  if (frameKeys.length === 0) throw new Error('No frame keys provided');

  const ownerId = shotId || pipelineRunId;
  if (!ownerId) {
    throw new Error('[VIDEO_RENDER] ownerId is required');
  }

  // 4. Workspace Preparation
  const workspaceDir = path.resolve(process.cwd(), 'workspace', jobId);
  if (!(await fileExists(workspaceDir))) await ensureDir(workspaceDir);

  let tempOutput = path.join(workspaceDir, 'output.mp4');

  try {
    // 5. Build FFmpeg Logic
    const cmd = 'ffmpeg';
    let args: string[] = [];

    // Helper to resolve paths from multiple locations (Fix for mixed storage roots)
    const resolveAssetPath = async (key: string) => {
      // 1. Try Storage Root
      const p1 = storage.getAbsolutePath(key);
      if (await fileExists(p1)) {
        return p1;
      }

      // 2. Try Repo Root (for apps/workers/.runtime assets)
      const p2 = path.resolve(process.cwd(), '../../', key);
      if (await fileExists(p2)) {
        return p2;
      }

      // 3. Try CWD relative
      const p3 = path.resolve(process.cwd(), key);
      if (await fileExists(p3)) {
        return p3;
      }

      return p1; // Default to storage path even if missing
    };

    const resolveFrameDimensions = async (
      absPath: string
    ): Promise<{ width: number; height: number }> => {
      const metadata = await sharp(absPath).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error(`[VIDEO_RENDER] Unable to detect frame dimensions from ${absPath}`);
      }
      return { width: metadata.width, height: metadata.height };
    };

    const resolvedList = await Promise.all(frameKeys.map((k) => resolveAssetPath(k)));
    const fps = parsePositiveNumber(
      payload.fps ?? process.env.VIDEO_RENDER_DEFAULT_FPS,
      'fps'
    );
    const requestedWidth =
      payload.width == null ? null : parsePositiveNumber(payload.width, 'width', { integerOnly: true });
    const requestedHeight =
      payload.height == null ? null : parsePositiveNumber(payload.height, 'height', { integerOnly: true });
    const inferredDimensions =
      requestedWidth && requestedHeight ? null : await resolveFrameDimensions(resolvedList[0]);
    const width = requestedWidth ?? inferredDimensions?.width;
    const height = requestedHeight ?? inferredDimensions?.height;
    if (!width || !height) {
      throw new Error('[VIDEO_RENDER] Missing width/height and unable to infer from first frame');
    }

    if (frameKeys.length === 1 && isImageKey(frameKeys[0])) {
      // Single Image Loop Mode
      const inputAbs = resolvedList[0];
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
        '-s',
        `${width}x${height}`,
        '-y',
        tempOutput,
      ];
    } else {
      // Concat Mode
      const listFilePath = path.join(workspaceDir, 'input.txt');
      let listContent = resolvedList.map((abs: string) => `file '${abs}'\nduration 1.0`).join('\n');
      listContent += `\nfile '${resolvedList[resolvedList.length - 1]}'`;
      await fsp.writeFile(listFilePath, listContent);

      const useTestsrc = !PRODUCTION_MODE && process.env.VIDEO_RENDER_TESTSRC === '1';
      if (useTestsrc) {
        args = [
          '-f',
          'lavfi',
          '-i',
          `testsrc=duration=1:size=${width}x${height}:rate=${fps}`,
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
          '-s',
          `${width}x${height}`,
          '-y',
          tempOutput,
        ];
      }
    }

    // PLAN-3: Audio Mixing Logic
    const audioTrack = getRecordField(payload, 'audioTrack');
    if (audioTrack) {
      // Resolve Audio Path (support storageKey or direct path)
      const audioKey =
        getStringField(audioTrack, 'storageKey') ||
        getStringField(audioTrack, 'mixed') ||
        getStringField(audioTrack, 'path');
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
        }
      }
    }

    // 6. Spawn FFmpeg
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
        ownerType_ownerId_type_role: {
          role: AssetRole.SHOT_SOURCE,
          ownerType: AssetOwnerType.SHOT,
          ownerId,
          type: AssetType.VIDEO,
        },
      },
      create: {
        projectId,
        ownerType: AssetOwnerType.SHOT,
        ownerId,
        role: AssetRole.SHOT_SOURCE,
        type: AssetType.VIDEO,
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
        projectId,
        jobId,
        jobType: JobType.VIDEO_RENDER,
        engineKey: 'ffmpeg',
        status: 'SUCCESS',
        latencyMs: latency,
        auditTrail: { sizeBytes, checksum, frames: frameKeys.length, hls: hlsPlaylistUrl },
      })
      .catch(() => { });

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
    } catch (e: unknown) {
      // ✅ Real Baseline: ffprobe must exist, so fail hard.
      throw new Error(
        `[VIDEO_RENDER] ffprobe evidence generation failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    // 7.2 Legacy publish flag is deprecated.
    // Authoritative publish now happens after CE09 reconciliation on the API side.
    const shouldPublish = payload?.publish === true;
    if (shouldPublish) {
      process.stderr.write(
        `[VIDEO_RENDER] Legacy publish=true ignored for job ${jobId}; publish is deferred to CE09.\n`
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
      publishDeferredToCe09: shouldPublish,
      status: 'SUCCESS',
    };
  } finally {
    if (await fileExists(workspaceDir)) {
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    }
  }
}
