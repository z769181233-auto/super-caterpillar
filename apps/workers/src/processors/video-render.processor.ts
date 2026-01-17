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
    sceneId?: string;  // P4 Fix: Optional, can be resolved from shotId
    shotId?: string;    // P4 Fix: Used to resolve sceneId if missing
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
        logger.log(`[VideoRender] Spawning ffmpeg with args: ${args.join(' ')}`);
        const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        if (p.stdout) p.stdout.on('data', (d) => logger.log(String(d)));
        if (p.stderr) p.stderr.on('data', (d) => (stderr += String(d)));
        p.on('error', (err) => {
            logger.error(`[VideoRender] ffmpeg spawn error: ${err.message}`);
            reject(err);
        });
        p.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`ffmpeg exit=${code}. stderr=${stderr}`));
        });
    });
}

/**
 * PLAN-2 SSOT: Normalize storage key (strict cleanup)
 * Remove pollution: .runtime/, apps/workers/.runtime/, absolute paths
 */
function normalizeStorageKey(key: string, logger: any): string {
    if (!key) return key;

    // If contains .runtime/ or apps/workers/: extract from assets/ or videos/
    if (key.includes('apps/workers/.runtime/') || key.includes('.runtime/')) {
        const assetsIdx = key.lastIndexOf('assets/');
        const videosIdx = key.lastIndexOf('videos/');
        const startIdx = Math.max(assetsIdx, videosIdx);

        if (startIdx !== -1) {
            const normalized = key.substring(startIdx);
            logger.log(`[NormalizeKey] Stripped pollution: "${key}" -> "${normalized}"`);
            return normalized;
        } else {
            throw new Error(`[NormalizeKey] REJECT: No assets/ or videos/ in key: ${key}`);
        }
    }

    // If absolute path: same extraction
    if (key.startsWith('/')) {
        const assetsIdx = key.lastIndexOf('assets/');
        const videosIdx = key.lastIndexOf('videos/');
        const startIdx = Math.max(assetsIdx, videosIdx);

        if (startIdx !== -1) {
            const normalized = key.substring(startIdx);
            logger.log(`[NormalizeKey] Stripped absolute: "${key}" -> "${normalized}"`);
            return normalized;
        } else {
            throw new Error(`[NormalizeKey] REJECT: Absolute path without assets/videos/: ${key}`);
        }
    }

    // Already clean
    return key;
}

/**
 * PLAN-2: Dual-root asset path resolution
 * Try: 1) STORAGE_ROOT/<key>  2) apps/workers/.runtime/<key>
 */
function resolveAssetPath(storageKey: string, storageRoot: string, logger: any): string {
    // Priority 1: STORAGE_ROOT
    const path1 = path.resolve(storageRoot, storageKey);
    if (fileOk(path1)) {
        logger.log(`[ResolvePath] HIT storageRoot="${storageRoot}" key="${storageKey}" abs="${path1}"`);
        return path1;
    }

    // Priority 2: Fallback to .runtime (backward compat)
    const runtimeFallback = path.resolve(process.cwd(), '.runtime', storageKey);
    if (fileOk(runtimeFallback)) {
        logger.log(`[ResolvePath] HIT fallback .runtime key="${storageKey}" abs="${runtimeFallback}"`);
        return runtimeFallback;
    }

    // Not found in either location
    throw new Error(`[ResolvePath] NOT FOUND: storageKey="${storageKey}" tried: ${path1}, ${runtimeFallback}`);
}

export async function processVideoRenderJob(context: ProcessorContext): Promise<VideoRenderProcessorResult> {
    const { prisma, job, apiClient } = context;
    const logger = context.logger || console;

    const payload = (job.payload || {}) as VideoRenderPayload;

    const pipelineRunId = payload.pipelineRunId;
    const projectId = payload.projectId || (job as any).projectId;
    let sceneId = payload.sceneId;

    if (!pipelineRunId) throw new Error(`[VideoRender] Missing pipelineRunId in payload for job ${job.id}`);
    if (!projectId) throw new Error(`[VideoRender] Missing projectId in payload for job ${job.id}`);

    // P4 Fix: If sceneId is missing, query from shotId
    if (!sceneId && payload.shotId) {
        logger.log(`[VideoRender] sceneId missing in payload, querying from shotId=${payload.shotId}`);
        const shot = await prisma.shot.findUnique({
            where: { id: payload.shotId },
            select: { sceneId: true },
        });
        if (!shot || !shot.sceneId) {
            throw new Error(`[VideoRender] Cannot resolve sceneId from shotId=${payload.shotId} for job ${job.id}`);
        }
        sceneId = shot.sceneId;
        logger.log(`[VideoRender] Resolved sceneId=${sceneId} from shotId`);
    }

    if (!sceneId) throw new Error(`[VideoRender] Missing sceneId in payload for job ${job.id}`);

    const traceId = payload.traceId || job.id;
    const rawFrameKeys = payload.frames || payload.frameKeys || [];
    if (!Array.isArray(rawFrameKeys) || rawFrameKeys.length === 0) {
        throw new Error(`[VideoRender] Missing frames/frameKeys in payload for job ${job.id}`);
    }

    // PLAN-2: Two-stage path resolution (normalize + dual-root lookup)
    const runtimeRoot = process.env.STORAGE_ROOT || path.resolve(process.cwd(), '.runtime');

    // Stage 1: Normalize all keys (remove pollution)
    const cleanKeys = rawFrameKeys.map((k) => normalizeStorageKey(k, logger));

    // Stage 2: Resolve to absolute paths with dual-root fallback
    const absFrames = cleanKeys.map((k) => resolveAssetPath(k, runtimeRoot, logger));

    // Validate all frames exist
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
        const asset = await prisma.asset.upsert({
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
            output: { assetId: asset.id, storageKey: finalKey, absolutePath: finalAbs },
        };
    } catch (e: any) {
        // 失败保留 pendingKey，允许 SHOT_RENDER/Orchestrator 发现并重触发
        logger.error(`[VideoRender] Failed: ${e.message}`);
        return { status: 'FAILED', error: e.message };
    }
}
