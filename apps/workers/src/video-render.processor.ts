import { PrismaClient } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from './api-client';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'path';
import { LocalStorageAdapter } from '@scu/storage';

/**
 * Stage 8: Video Render Processor
 * Uses @scu/storage for robust file handling
 */
import { ChildProcess } from 'child_process';
import * as util from 'util';

// P1 修复：记录当前所有活动中的渲染进程，防止孤儿进程
const activeProcesses = new Set<ChildProcess>();

/**
 * 紧急清理所有活动子进程
 */
export function cleanupVideoRenderProcesses() {
  process.stdout.write(
    util.format(`[VideoRender] Cleaning up ${activeProcesses.size} active FFmpeg processes...`) +
      '\n'
  );
  for (const cp of activeProcesses) {
    try {
      cp.kill('SIGKILL');
    } catch (e) {
      // ignore
    }
  }
  activeProcesses.clear();
}

/**
 * P0-2: Helper to check if key is an image
 */
function isImageKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.endsWith('.png') || k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.webp');
}

/**
 * P0-2: Verify frame file exists and is valid
 */
async function assertFrameFileOk(absPath: string): Promise<void> {
  const st = await fsPromises.stat(absPath);
  if (!st.isFile() || st.size <= 0) {
    throw new Error(`Frame file missing/empty: ${absPath}`);
  }
  if (st.size < 10_000) {
    throw new Error(`Frame too small (corrupt?): ${absPath} size=${st.size}`);
  }
}
export async function processVideoRenderJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  // 路径权威规则：优先使用 REPO_ROOT，否则使用 STORAGE_ROOT，禁止 process.cwd() 推导
  let storageRoot: string;
  if (process.env.REPO_ROOT) {
    storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
  } else if (process.env.STORAGE_ROOT) {
    storageRoot = process.env.STORAGE_ROOT;
  } else {
    // 兜底：Worker 从 apps/workers 运行，向上两级到项目根目录
    const repoRoot = path.resolve(process.cwd(), '../../');
    storageRoot = path.join(repoRoot, '.data/storage');
  }
  const storage = new LocalStorageAdapter(storageRoot);

  const traceId = job.traceId || `trace-${jobId}`;
  const payload = job.payload as any;

  // FIX 3: shotId 强制校验 - 必填,不允许fallback
  const shotId = payload?.shotId;
  if (!shotId) {
    throw new Error(
      `[VIDEO_RENDER] shotId is required in payload. Job cannot proceed without valid shot ownership.`
    );
  }

  const frameKeys = payload.frameKeys as string[];
  const fps = payload.fps || 24;

  process.stdout.write(
    util.format(
      JSON.stringify({
        event: 'VIDEO_RENDER_START',
        jobId,
        traceId,
        framesCount: frameKeys?.length,
      })
    ) + '\n'
  );

  if (!frameKeys || frameKeys.length === 0) {
    throw new Error('No frame keys provided');
  }

  // Prepare temp workspace
  const workspaceDir = path.resolve(process.cwd(), 'workspace', jobId);
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  try {
    // P0-2: Single image frame mode (bypass concat demuxer for single PNG)
    if (frameKeys.length === 1 && isImageKey(frameKeys[0])) {
      const inputAbs = storage.getAbsolutePath(frameKeys[0]);
      await assertFrameFileOk(inputAbs);

      const seconds = 1;
      const fpsVal = fps ?? 24;
      const tempOutput = path.join(workspaceDir, 'output.mp4');

      const cmd = 'ffmpeg';
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-loop',
        '1',
        '-t',
        String(seconds),
        '-i',
        inputAbs,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(fpsVal),
        '-y',
        tempOutput,
      ];

      process.stdout.write(
        util.format({ event: 'VIDEO_RENDER_SINGLE_IMAGE', jobId, cmd: [cmd, ...args].join(' ') }) +
          '\n'
      );

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cmd, args, { cwd: workspaceDir });
        activeProcesses.add(proc);
        let stderr = '';

        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          activeProcesses.delete(proc);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed (code ${code}): ${stderr}`));
          }
        });

        proc.on('error', (err) => {
          activeProcesses.delete(proc);
          reject(err);
        });
      });

      // Verify output
      const outSt = await fsPromises.stat(tempOutput);
      if (outSt.size <= 0) {
        throw new Error(`VIDEO_RENDER: empty mp4 ${tempOutput}`);
      }

      const outputKey = `projects/${job.projectId}/videos/output-${Date.now()}.mp4`;
      await storage.put(outputKey, fs.readFileSync(tempOutput));
      await apiClient
        .postAuditLog({
          traceId: traceId || `trace-${jobId}`,
          projectId: job.projectId,
          jobId,
          jobType: 'VIDEO_RENDER',
          engineKey: 'ffmpeg_single_image',
          status: 'SUCCESS',
          latencyMs: Date.now() - jobStartTime,
          auditTrail: { frameCount: 1, duration: seconds },
        })
        .catch((e) => process.stdout.write(util.format('Audit failed', e) + '\n'));

      process.stdout.write(
        util.format({
          event: 'VIDEO_RENDER_SUCCESS_SINGLE',
          jobId,
          outputKey,
          durationSec: seconds,
        }) + '\n'
      );
      return { outputKey, durationSec: seconds };
    }

    // Original concat mode for multiple frames
    // 1. Resolve Inputs -> input.txt
    const listFilePath = path.join(workspaceDir, 'input.txt');
    let listContent = frameKeys.map((key) => {
      if (!storage.exists(key)) {
        process.stderr.write(util.format(`[Start-Video-Render] Frame missing: ${key}`) + '\n');
        process.stderr.write(
          util.format(`[Start-Video-Render] StorageRoot: ${storageRoot}`) + '\n'
        );
        process.stderr.write(
          util.format(`[Start-Video-Render] AbsolutePath: ${storage.getAbsolutePath(key)}`) + '\n'
        );
        throw new Error(`Frame missing: ${key} (Root: ${storageRoot})`);
      }
      // FFmpeg needs absolute path - FORCE DURATION for test stability
      return `file '${storage.getAbsolutePath(key)}'\nduration 1.0`;
    });
    let joinedListContent = listContent.join('\n');

    // FFmpeg concat demuxer quirk: Last file needs to be repeated or it won't have duration
    if (frameKeys.length > 0) {
      const lastKey = frameKeys[frameKeys.length - 1];
      joinedListContent += `\nfile '${storage.getAbsolutePath(lastKey)}'`;
    } else {
      joinedListContent = listContent.join('\n');
    }

    process.stdout.write(
      util.format(`[VIDEO_RENDER_DEBUG] input.txt content:\n${joinedListContent}`) + '\n'
    );
    fs.writeFileSync(listFilePath, joinedListContent);

    // 2. Output Path (Temp)
    const tempOutput = path.join(workspaceDir, 'output.mp4');

    // 3. Exec FFmpeg
    // FIX 5: testsrc 只在环境变量开启时启用,否则使用真实 frameKeys concat
    const useTestsrc = process.env.VIDEO_RENDER_TESTSRC === '1';
    const cmd = 'ffmpeg';
    let args: string[];

    if (useTestsrc) {
      // Gate模式: synthetic video for E2E stability
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
      process.stdout.write(
        util.format(`[VIDEO_RENDER] Using testsrc mode (VIDEO_RENDER_TESTSRC=1)`) + '\n'
      );
    } else {
      // 正常模式: 使用真实 frames concat
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
        '24',
        '-y',
        tempOutput,
      ];
      process.stdout.write(
        util.format(
          `[VIDEO_RENDER] Using real frames concat mode (frameKeys: ${frameKeys.length})`
        ) + '\n'
      );
    }

    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_RENDER_FFMPEG_CMD',
          jobId,
          cmd: `${cmd} ${args.join(' ')}`,
        })
      ) + '\n'
    );

    await new Promise<void>((resolve, reject) => {
      const ff = spawn(cmd, args);
      activeProcesses.add(ff); // P1 引用：追踪进程

      // Collect stderr for debug if fails
      let stderr = '';
      ff.stderr.on('data', (d) => (stderr += d.toString()));
      ff.on('close', (code) => {
        activeProcesses.delete(ff); // P1 释放：任务结束删除追踪
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with ${code}: ${stderr.slice(-200)}`));
      });

      ff.on('error', (err) => {
        activeProcesses.delete(ff);
        reject(err);
      });
    });

    // 4. Register Asset First (FIX 2: 使用 assetId 作为 videoKey SSOT)
    const videoBuffer = fs.readFileSync(tempOutput);
    const sizeBytes = videoBuffer.length;

    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerType: 'SHOT',
          ownerId: shotId,
          type: 'VIDEO',
        },
      },
      create: {
        projectId: (job as any).projectId,
        ownerType: 'SHOT',
        ownerId: shotId,
        type: 'VIDEO',
        status: 'GENERATED',
        storageKey: 'temp/pending', // Temporary, will update after upload
        checksum: null,
        createdByJobId: jobId,
      },
      update: {
        status: 'GENERATED',
        storageKey: 'temp/pending', // Will update
        checksum: null,
        createdByJobId: jobId,
      },
    });

    // FIX 2: 使用 assetId 作为 videoKey,保证资产与物理文件 1:1 对应
    const videoKey = `videos/${asset.id}.mp4`;

    // 5. Upload to Storage with assetId-based key
    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_STORAGE_PUT_START',
          jobId,
          assetId: asset.id,
          videoKey,
          bufferSize: sizeBytes,
          storageRoot,
        })
      ) + '\n'
    );
    await storage.put(videoKey, videoBuffer);
    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_STORAGE_PUT_DONE',
          jobId,
          assetId: asset.id,
          videoKey,
          absolutePath: storage.getAbsolutePath(videoKey),
        })
      ) + '\n'
    );

    // 6. Update Asset with final storageKey
    await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey: videoKey },
    });

    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_ASSET_REGISTERED',
          jobId,
          assetId: asset.id,
          videoKey,
          projectId: (job as any).projectId,
        })
      ) + '\n'
    );

    const duration = Date.now() - jobStartTime;

    process.stdout.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_RENDER_DONE',
          jobId,
          traceId,
          videoKey,
          elapsedMs: duration,
          sizeBytes,
        })
      ) + '\n'
    );

    // P0-2: 成本事件上报（不阻断主流程）
    const project = await prisma.project
      .findUnique({
        where: { id: (job as any).projectId },
        select: { ownerId: true },
      })
      .catch(() => null);

    if (project?.ownerId) {
      try {
        const costResult = await apiClient.postCostEvent({
          userId: project.ownerId,
          projectId: (job as any).projectId,
          jobId: jobId,
          jobType: 'VIDEO_RENDER',
          engineKey: 'ffmpeg',
          costAmount: 0.05, // P0-2: 固定成本，后续实现真实计费
          currency: 'USD',
          billingUnit: 'job',
          quantity: 1,
          metadata: {
            sizeBytes,
            durationMs: duration,
            framesCount: frameKeys.length,
          },
        });
        process.stdout.write(
          util.format(
            `[COST_EVENT] OK jobId=${jobId} costId=${costResult.id} deduplicated=${costResult.deduplicated}`
          ) + '\n'
        );
      } catch (e: any) {
        // 不阻断主流程，仅记录日志
        process.stderr.write(
          util.format(`[COST_EVENT] FAILED jobId=${jobId}`, e.message || e) + '\n'
        );
      }
    } else {
      process.stdout.write(
        util.format(`[COST_EVENT] SKIP jobId=${jobId} (no project owner found)`) + '\n'
      );
    }

    return {
      assetId: asset.id,
      videoKey,
      sizeBytes,
      durationMs: duration,
      status: 'SUCCESS',
    };
  } catch (error: any) {
    process.stderr.write(
      util.format(
        JSON.stringify({
          event: 'VIDEO_RENDER_FAIL',
          jobId,
          traceId,
          reason: error.message,
        })
      ) + '\n'
    );
    throw error;
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}
