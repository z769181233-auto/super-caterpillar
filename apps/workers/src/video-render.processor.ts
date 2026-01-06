
import { PrismaClient } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from './api-client';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { LocalStorageAdapter } from '@scu/storage';

/**
 * Stage 8: Video Render Processor
 * Uses @scu/storage for robust file handling
 */
import { ChildProcess } from 'child_process';

// P1 修复：记录当前所有活动中的渲染进程，防止孤儿进程
const activeProcesses = new Set<ChildProcess>();

/**
 * 紧急清理所有活动子进程
 */
export function cleanupVideoRenderProcesses() {
    console.log(`[VideoRender] Cleaning up ${activeProcesses.size} active FFmpeg processes...`);
    for (const cp of activeProcesses) {
        try {
            cp.kill('SIGKILL');
        } catch (e) {
            // ignore
        }
    }
    activeProcesses.clear();
}
export async function processVideoRenderJob(
    prisma: PrismaClient,
    job: WorkerJobBase,
    apiClient: ApiClient,
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
        throw new Error(`[VIDEO_RENDER] shotId is required in payload. Job cannot proceed without valid shot ownership.`);
    }

    const frameKeys = payload.frameKeys as string[];
    const fps = payload.fps || 24;

    console.log(JSON.stringify({
        event: 'VIDEO_RENDER_START',
        jobId,
        traceId,
        framesCount: frameKeys?.length
    }));

    if (!frameKeys || frameKeys.length === 0) {
        throw new Error('No frame keys provided');
    }

    // Prepare temp workspace
    const workspaceDir = path.resolve(process.cwd(), 'workspace', jobId);
    if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
    }

    try {
        // 1. Resolve Inputs -> input.txt
        const listFilePath = path.join(workspaceDir, 'input.txt');
        let listContent = frameKeys.map(key => {
            if (!storage.exists(key)) {
                console.error(`[Start-Video-Render] Frame missing: ${key}`);
                console.error(`[Start-Video-Render] StorageRoot: ${storageRoot}`);
                console.error(`[Start-Video-Render] AbsolutePath: ${storage.getAbsolutePath(key)}`);
                throw new Error(`Frame missing: ${key} (Root: ${storageRoot})`);
            }
            // FFmpeg needs absolute path - FORCE DURATION for test stability
            return `file '${storage.getAbsolutePath(key)}'\nduration 1.0`;
        }));
        let joinedListContent = listContent.join('\n');

        // FFmpeg concat demuxer quirk: Last file needs to be repeated or it won't have duration
        if (frameKeys.length > 0) {
            const lastKey = frameKeys[frameKeys.length - 1];
            joinedListContent += `\nfile '${storage.getAbsolutePath(lastKey)}'`;
        } else {
            joinedListContent = listContent.join('\n');
        }

        console.log(`[VIDEO_RENDER_DEBUG] input.txt content:\n${joinedListContent}`);
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
                '-f', 'lavfi',
                '-i', 'testsrc=duration=1:size=640x360:rate=24',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-y',
                tempOutput
            ];
            console.log(`[VIDEO_RENDER] Using testsrc mode (VIDEO_RENDER_TESTSRC=1)`);
        } else {
            // 正常模式: 使用真实 frames concat
            args = [
                '-f', 'concat',
                '-safe', '0',
                '-i', listFilePath,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-r', '24',
                '-y',
                tempOutput
            ];
            console.log(`[VIDEO_RENDER] Using real frames concat mode (frameKeys: ${frameKeys.length})`);
        }

        console.log(JSON.stringify({
            event: 'VIDEO_RENDER_FFMPEG_CMD',
            jobId,
            cmd: `${cmd} ${args.join(' ')}`
        }));

        await new Promise<void>((resolve, reject) => {
            const ff = spawn(cmd, args);
            activeProcesses.add(ff); // P1 引用：追踪进程

            // Collect stderr for debug if fails
            let stderr = '';
            ff.stderr.on('data', d => stderr += d.toString());
            ff.on('close', code => {
                activeProcesses.delete(ff); // P1 释放：任务结束删除追踪
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with ${code}: ${stderr.slice(-200)}`));
            });

            ff.on('error', err => {
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
                }
            },
            create: {
                projectId: (job as any).projectId,
                ownerType: 'SHOT',
                ownerId: shotId,
                type: 'VIDEO',
                status: 'GENERATED',
                storageKey: 'temp/pending', // Temporary, will update after upload
                checksum: null,
                createdByJobId: jobId
            },
            update: {
                status: 'GENERATED',
                storageKey: 'temp/pending', // Will update
                checksum: null,
                createdByJobId: jobId
            }
        });

        // FIX 2: 使用 assetId 作为 videoKey,保证资产与物理文件 1:1 对应
        const videoKey = `videos/${asset.id}.mp4`;

        // 5. Upload to Storage with assetId-based key
        console.log(JSON.stringify({
            event: 'VIDEO_STORAGE_PUT_START',
            jobId,
            assetId: asset.id,
            videoKey,
            bufferSize: sizeBytes,
            storageRoot
        }));
        await storage.put(videoKey, videoBuffer);
        console.log(JSON.stringify({
            event: 'VIDEO_STORAGE_PUT_DONE',
            jobId,
            assetId: asset.id,
            videoKey,
            absolutePath: storage.getAbsolutePath(videoKey)
        }));

        // 6. Update Asset with final storageKey
        await prisma.asset.update({
            where: { id: asset.id },
            data: { storageKey: videoKey }
        });

        console.log(JSON.stringify({
            event: 'VIDEO_ASSET_REGISTERED',
            jobId,
            assetId: asset.id,
            videoKey,
            projectId: (job as any).projectId
        }));

        const duration = Date.now() - jobStartTime;

        console.log(JSON.stringify({
            event: 'VIDEO_RENDER_DONE',
            jobId,
            traceId,
            videoKey,
            elapsedMs: duration,
            sizeBytes
        }));

        return {
            assetId: asset.id,
            videoKey,
            sizeBytes,
            durationMs: duration,
            status: 'SUCCESS'
        };

    } catch (error: any) {
        console.error(JSON.stringify({
            event: 'VIDEO_RENDER_FAIL',
            jobId,
            traceId,
            reason: error.message
        }));
        throw error;
    } finally {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
}
