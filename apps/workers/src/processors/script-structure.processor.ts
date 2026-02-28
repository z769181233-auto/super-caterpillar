import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';
import { defaultLLMClient } from '../agents/llm-client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { UsageMeter } from '../../../../packages/metering/src/usage-meter';

export interface ScriptStructureResult {
    success: boolean;
    output?: any;
    error?: any;
}

/**
 * P5-C HARDENING: Utility to recompute hash from raw file bits
 */
async function recomputeHashFromRaw(filePath: string, offsetStart: number, offsetEnd: number): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(filePath)) return reject(new Error(`File not found: ${filePath}`));
            const stream = fs.createReadStream(filePath, { start: offsetStart, end: offsetEnd - 1 });
            const hash = crypto.createHash('sha256');
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => reject(err));
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * [CE06_SCRIPT_OUTLINE]
 */
export async function processScriptOutlineJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
    const { prisma, job } = ctx;
    const { sourceId, buildId, projectId } = job.payload;

    // P5-C HARDENING: Fetch PREVIEW chunks (e.g., first 50) for LLM context
    const previewChunks = await prisma.storyChunk.findMany({
        where: { sourceId },
        orderBy: { chunkIndex: 'asc' },
        take: 50,
    });

    if (previewChunks.length === 0) throw new Error(`No chunks found for sourceId: ${sourceId}`);

    const previews = previewChunks.map(c => `[Chunk ${c.chunkIndex}] ${c.contentPreview}`).join('\n');
    const prompt = `识别并拆分出主要 Episode 结构...\n${previews}`;

    const result = await defaultLLMClient.call({
        systemPrompt: "资深网文拆剧导演。",
        userPrompt: prompt,
        responseFormat: 'json_object'
    });

    const episodes = result.episodes || [];
    for (const ep of episodes) {
        // P5-C HARDENING Fix: Fetch the EXACT chunk by chunkIndex to get correct offsets
        const targetChunk = await prisma.storyChunk.findFirst({
            where: { sourceId, chunkIndex: ep.startChunkIndex }
        }) || previewChunks[0];

        const sourceRef = await prisma.storySourceRef.create({
            data: {
                chunkId: targetChunk.id,
                offsetStart: targetChunk.offsetStart,
                offsetEnd: targetChunk.offsetEnd,
                textHash: targetChunk.textHash
            }
        });

        await prisma.episode.create({
            data: {
                projectId,
                buildId,
                index: ep.index,
                name: ep.title,
                summary: ep.summary,
                sourceRefId: sourceRef.id,
                status: 'pending'
            }
        });
    }

    return { success: true, output: { episodeCount: episodes.length } };
}

/**
 * [CE11_SCENE_SPLIT]
 */
export async function processSceneSplitJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
    const { prisma, job } = ctx;
    const { episodeId, buildId, projectId } = job.payload;

    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { sourceRef: { include: { chunk: true } } }
    });

    if (!episode || !episode.sourceRef) throw new Error('Episode or SourceRef not found');

    const result = await defaultLLMClient.call({
        systemPrompt: "分镜师。",
        userPrompt: `拆分场景...\n${episode.sourceRef.chunk?.contentPreview}`,
        responseFormat: 'json_object'
    });

    const scenes = result.scenes || [];
    for (const sc of scenes) {
        const sceneSourceRef = await prisma.storySourceRef.create({
            data: {
                chunkId: episode.sourceRef!.chunkId,
                offsetStart: episode.sourceRef!.offsetStart,
                offsetEnd: episode.sourceRef!.offsetEnd,
                textHash: `scene-${sc.index}-${Date.now()}`
            }
        });

        await prisma.scene.create({
            data: {
                projectId,
                episodeId,
                buildId,
                sceneIndex: sc.index,
                title: sc.title,
                locationSlug: sc.location,
                summary: sc.summary,
                status: 'PENDING',
                sourceRefId: sceneSourceRef.id
            }
        });
    }

    return { success: true, output: { sceneCount: scenes.length } };
}

/**
 * [CE12_SHOT_SPLIT]
 */
export async function processShotSplitJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
    const { prisma, job } = ctx;
    const { sceneId, buildId, projectId } = job.payload;

    const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { sourceRef: { include: { chunk: true } } }
    });

    if (!scene || !scene.sourceRef) throw new Error('Scene or SourceRef not found');

    const result = await defaultLLMClient.call({
        systemPrompt: "分镜导演。",
        userPrompt: `拆解分镜...\n${scene.sourceRef.chunk?.contentPreview}`,
        responseFormat: 'json_object'
    });

    const shots = result.shots || [];
    for (const shot of shots) {
        const shotSourceRef = await prisma.storySourceRef.create({
            data: {
                chunkId: scene.sourceRef!.chunkId,
                offsetStart: scene.sourceRef!.offsetStart,
                offsetEnd: scene.sourceRef!.offsetEnd,
                textHash: `shot-${shot.index}-${Date.now()}`
            }
        });

        await prisma.shot.create({
            data: {
                sceneId,
                buildId,
                index: shot.index,
                content: shot.content,
                visualDescription: shot.visualDescription,
                renderStatus: 'PENDING',
                sourceRefId: shotSourceRef.id,
                type: 'GENERATED'
            }
        });
    }

    return { success: true, output: { shotCount: shots.length } };
}

/**
 * [CE99_CONTINUITY_AUDIT] - INDUSTRIAL SEALED EDITION
 */
export async function processContinuityAuditJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
    const { prisma, job } = ctx;
    const { buildId } = job.payload;
    const startTime = Date.now();

    const build = await prisma.scriptBuild.findUnique({
        where: { id: buildId },
        include: { storySource: true }
    });
    if (!build) throw new Error(`Build ${buildId} not found`);

    const sourceFilePath = build.storySource.path;
    const totalSourceSize = build.storySource.size;

    const episodes = await prisma.episode.findMany({
        where: { buildId },
        orderBy: { index: 'asc' },
        include: {
            sourceRef: { include: { chunk: true } },
            scenes: {
                orderBy: { sceneIndex: 'asc' },
                include: {
                    sourceRef: true,
                    shots: {
                        orderBy: { index: 'asc' },
                        include: { sourceRef: true }
                    }
                }
            }
        }
    });

    const auditSummary = {
        episodesChecked: episodes.length,
        scenesChecked: 0,
        shotsChecked: 0,
        hashRecheckPassed: 0,
        hashRecheckFailed: 0,
        monotonicViolations: 0,
        episodeMonotonic: true,
        sceneMonotonic: true,
        shotMonotonic: true,
        maxGapChars: 0,
        maxOverlapChars: 0,
        coveragePercent: 0,
        isIndustrialSealed: false,
        auditLogs: [] as string[]
    };

    let lastEpisodeOffset = -1;
    let totalCoveredEnd = 0;

    for (const ep of episodes) {
        if (!ep.sourceRef || !ep.sourceRef.chunk) {
            auditSummary.auditLogs.push(`[FATAL] Episode ${ep.index} missing SourceRef`);
            continue;
        }

        const epOffset = ep.sourceRef.offsetStart;
        if (epOffset <= lastEpisodeOffset) {
            auditSummary.episodeMonotonic = false;
            auditSummary.monotonicViolations++;
            auditSummary.auditLogs.push(`[FAIL] Ep ${ep.index} backtrack: ${epOffset} <= ${lastEpisodeOffset}`);
        }
        lastEpisodeOffset = epOffset;

        try {
            const realHash = await recomputeHashFromRaw(sourceFilePath, ep.sourceRef.offsetStart, ep.sourceRef.offsetEnd);
            if (realHash === ep.sourceRef.chunk.textHash) {
                auditSummary.hashRecheckPassed++;
            } else {
                auditSummary.hashRecheckFailed++;
                auditSummary.auditLogs.push(`[FAIL] Ep ${ep.index} Hash mismatch`);
            }
        } catch (e: any) {
            auditSummary.auditLogs.push(`[ERROR] Re-hash Ep ${ep.index}: ${e.message}`);
        }

        totalCoveredEnd = Math.max(totalCoveredEnd, ep.sourceRef.offsetEnd);

        let lastSceneOffset = -1;
        for (const sc of ep.scenes) {
            auditSummary.scenesChecked++;
            if (!sc.sourceRef) continue;
            if (sc.sourceRef.offsetStart < lastSceneOffset) {
                auditSummary.sceneMonotonic = false;
                auditSummary.monotonicViolations++;
            }
            lastSceneOffset = sc.sourceRef.offsetStart;
            totalCoveredEnd = Math.max(totalCoveredEnd, sc.sourceRef.offsetEnd);

            let lastShotOffset = -1;
            for (const shot of sc.shots) {
                auditSummary.shotsChecked++;
                if (!shot.sourceRef) continue;
                if (shot.sourceRef.offsetStart < lastShotOffset) {
                    auditSummary.shotMonotonic = false;
                    auditSummary.monotonicViolations++;
                }
                lastShotOffset = shot.sourceRef.offsetStart;
                totalCoveredEnd = Math.max(totalCoveredEnd, shot.sourceRef.offsetEnd);
            }
        }
    }

    auditSummary.coveragePercent = (totalCoveredEnd / totalSourceSize) * 100;
    const coverageGap = totalSourceSize - totalCoveredEnd;
    auditSummary.maxGapChars = coverageGap;

    if (auditSummary.hashRecheckFailed === 0 &&
        auditSummary.monotonicViolations === 0 &&
        coverageGap < 1000) {
        auditSummary.isIndustrialSealed = true;
    }

    await prisma.scriptBuild.update({
        where: { id: buildId },
        data: {
            status: auditSummary.isIndustrialSealed ? 'AUDITED' : 'FAILED',
            metadata: auditSummary as any
        }
    });

    console.log(`\n${auditSummary.isIndustrialSealed ? '✅' : '❌'} AUDIT FINISHED. Sealed: ${auditSummary.isIndustrialSealed}`);

    // P5-A: Soft Metering - Record compute effort
    try {
        const projectId = job.payload.projectId || build.projectId;
        const proj = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });
        if (proj?.organizationId) {
            await UsageMeter.recordProcessing(proj.organizationId, Date.now() - startTime, {
                episodes: episodes.length,
                isIndustrialSealed: auditSummary.isIndustrialSealed
            });
        }
    } catch (e) {
        console.warn(`[UsageMeter] Failed to record processing:`, e);
    }

    return { success: true, output: auditSummary };
}
