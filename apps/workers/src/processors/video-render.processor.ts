import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';

export interface VideoRenderProcessorResult {
    status: 'SUCCEEDED' | 'FAILED';
    output?: any;
    error?: string;
}

type VideoRenderPayload = {
    pipelineRunId: string;
    projectId: string;
    sceneId: string;
    traceId?: string;
    frames?: string[];
    frameKeys?: string[];
    episodeId?: string;
};

function ensureDir(p: string) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function fileOk(p: string) {
    try {
        const st = fs.statSync(p);
        return st.isFile() && st.size > 0;
    } catch {
        return false;
    }
}

async function runFfmpeg(args: string[], logger: any) {
    await new Promise<void>((resolve, reject) => {
        const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        if (p.stdout) p.stdout.on('data', (d) => logger.log(String(d)));
        if (p.stderr) p.stderr.on('data', (d) => (stderr += String(d)));
        p.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`ffmpeg exit=${code}. stderr=${stderr}`));
        });
    });
}

export async function processVideoRenderJob(context: ProcessorContext): Promise<VideoRenderProcessorResult> {
    const { prisma, job, apiClient } = context;
    const logger = context.logger || console;

    const payload = (job.payload || {}) as VideoRenderPayload;

    const pipelineRunId = payload.pipelineRunId;
    const projectId = payload.projectId || (job as any).projectId;
    const sceneId = payload.sceneId;

    if (!pipelineRunId) throw new Error(`[VideoRender] Missing pipelineRunId in payload for job ${job.id}`);
    if (!projectId) throw new Error(`[VideoRender] Missing projectId in payload for job ${job.id}`);
    if (!sceneId) throw new Error(`[VideoRender] Missing sceneId in payload for job ${job.id}`);

    const traceId = payload.traceId || job.id;
    const frameKeys = payload.frames || payload.frameKeys || [];
    if (!Array.isArray(frameKeys) || frameKeys.length === 0) {
        throw new Error(`[VideoRender] Missing frames/frameKeys in payload for job ${job.id}`);
    }

    // Resolve paths under .runtime
    const runtimeRoot = path.resolve(process.cwd(), '.runtime');
    const absFrames = frameKeys.map((k) => path.resolve(runtimeRoot, k));
    for (const f of absFrames) {
        if (!fileOk(f)) throw new Error(`[VideoRender] Frame not found or empty: ${f}`);
    }

    // VIDEO asset (SCENE, sceneId, VIDEO) 幂等：
    // - 先 upsert 成 pending（允许失败后重跑）
    const pendingKey = `pending/videos/${projectId}/${sceneId}/${pipelineRunId}/scene.mp4`;
    const finalKey = `videos/${projectId}/${sceneId}/${pipelineRunId}/scene.mp4`;
    const finalAbs = path.resolve(runtimeRoot, finalKey);
    ensureDir(path.dirname(finalAbs));

    await prisma.asset.upsert({
        where: {
            ownerType_ownerId_type: {
                ownerType: AssetOwnerType.SCENE,
                ownerId: sceneId,
                type: AssetType.VIDEO,
            },
        },
        update: {
            // 如果之前是 pending 或坏文件，允许覆盖为 pending（重跑）
            storageKey: pendingKey,
            createdByJobId: job.id,
        },
        create: {
            projectId,
            ownerId: sceneId,
            ownerType: AssetOwnerType.SCENE,
            type: AssetType.VIDEO,
            storageKey: pendingKey,
            status: 'GENERATED',
            createdByJobId: job.id,
        },
    });

    // FFmpeg 合成：
    // 最小闭环：支持单帧 -> 1s mp4
    // 关键：强制 yuv420p + 偶数尺寸
    try {
        if (absFrames.length === 1) {
            const input = absFrames[0];
            const args = [
                '-y',
                '-loop', '1',
                '-t', '1',
                '-i', input,
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
                '-r', '25',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                finalAbs,
            ];
            logger.log(`[VideoRender] ffmpeg single-frame -> ${finalAbs}`);
            await runFfmpeg(args, logger);
        } else {
            // 多帧：写 concat 列表
            const listPath = path.resolve(runtimeRoot, `tmp/ffconcat_${sceneId}_${pipelineRunId}.txt`);
            ensureDir(path.dirname(listPath));
            const body = absFrames.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
            fs.writeFileSync(listPath, body, 'utf8');

            const args = [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', listPath,
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
                '-r', '25',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                finalAbs,
            ];
            logger.log(`[VideoRender] ffmpeg concat(${absFrames.length}) -> ${finalAbs}`);
            await runFfmpeg(args, logger);
        }

        if (!fileOk(finalAbs)) throw new Error(`[VideoRender] Output mp4 missing/empty: ${finalAbs}`);

        // 更新为最终 storageKey
        await prisma.asset.upsert({
            where: {
                ownerType_ownerId_type: {
                    ownerType: AssetOwnerType.SCENE,
                    ownerId: sceneId,
                    type: AssetType.VIDEO,
                },
            },
            update: { storageKey: finalKey, createdByJobId: job.id },
            create: {
                projectId,
                ownerId: sceneId,
                ownerType: AssetOwnerType.SCENE,
                type: AssetType.VIDEO,
                storageKey: finalKey,
                status: 'GENERATED',
                createdByJobId: job.id,
            },
        });

        // 审计（字段不确定时放 details，避免破坏 schema）
        await prisma.auditLog.create({
            data: {
                id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2),
                resourceType: 'scene',
                resourceId: sceneId,
                action: 'ce08.video_render.success',
                orgId: (job as any).organizationId || 'unknown',
                details: {
                    traceId,
                    jobId: job.id,
                    pipelineRunId,
                    frameCount: absFrames.length,
                    storageKey: finalKey,
                },
            },
        });

        return {
            status: 'SUCCEEDED',
            output: { storageKey: finalKey, absolutePath: finalAbs },
        };
    } catch (e: any) {
        // 失败保留 pendingKey，允许 SHOT_RENDER/Orchestrator 发现并重触发
        logger.error(`[VideoRender] Failed: ${e.message}`);
        return { status: 'FAILED', error: e.message };
    }
}
