import { PrismaClient, JobType, JobStatus } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { ProcessorContext } from '../types/processor-context';
import { fileExists } from '../../../../packages/shared/fs_async';
import { hydrateShotWithDirectorControls } from '../v3/utils/shot_field_extractor';
import {
    ensureDefaultMetrics,
    stage4JobsTotal,
    stage4DurationSeconds,
    stage4PeakRssMb,
} from '../observability/stage4.metrics';

export async function processNovelReduce(context: ProcessorContext) {
    ensureDefaultMetrics();
    const t0 = Date.now();
    let peakRssMb = 0;

    function sampleRss() {
        const rss = process.memoryUsage().rss;
        const mb = Math.round(rss / 1024 / 1024);
        if (mb > peakRssMb) peakRssMb = mb;
    }

    const { prisma, job } = context;
    const { projectId, ingestRunId, isVerification, novelSourceId } = job.payload;

    console.log(`[NovelReduce] 🏁 Starting aggregation for ingestRun ${ingestRunId}`);

    try {
        stage4JobsTotal.inc({ type: job.type, status: 'RUNNING' }, 1);
        sampleRss();

        // 1. Fetch all completed chunks for this run
        const chunks = await prisma.novelChunk.findMany({
            where: { ingestRunId },
            orderBy: { chNo: 'asc' },
        });

        const pendingChunks = chunks.filter(c => c.status !== 'COMPLETED');
        if (pendingChunks.length > 0) {
            console.warn(`[NovelReduce] Found ${pendingChunks.length} chunks not completed. Partial aggregation may occur.`);
        }

        // 2. Aggregate Artifacts
        const allScenes: any[] = [];
        const storageRoot = (config as any).storageRoot || '/tmp/storage';

        for (const chunk of chunks) {
            if (!chunk.artifactUrl) continue;

            const artifactPath = path.resolve(storageRoot, chunk.artifactUrl);
            if (await fileExists(artifactPath)) {
                try {
                    const content = await fsp.readFile(artifactPath, 'utf8');
                    const data = JSON.parse(content);
                    // Adjust scene indices/IDs to be globally unique or sequential
                    allScenes.push(...(data.scenes || []));
                } catch (err: any) {
                    console.error(`[NovelReduce] Failed to read artifact for chunk ${chunk.id}: ${err.message}`);
                }
            }
        }

        console.log(`[NovelReduce] Aggregated ${allScenes.length} total scenes from ${chunks.length} chunks.`);

        if (allScenes.length === 0) {
            throw new Error(`[NovelReduce] No scenes found in any chunk artifacts.`);
        }

        // 3. Final Persistence (Heavy Transaction)
        // We group multiple chunks into one "Episode" for simplicity or follow original logic.
        // For now, let's treat the whole run as a unified set of scenes for the Project.

        const createdSceneIds: string[] = [];

        await prisma.$transaction(async (tx) => {
            // CLEAR existing project structure (Fresh deployment of this run)
            // Note: In a real production system, we might want versioned Seasons/Episodes.
            // Here we follow the existing pattern of project-level flattening if no specific episodeId is passed.

            // Look for a default episode for this project or create one
            let episode = await tx.episode.findFirst({ where: { projectId } });
            if (!episode) {
                episode = await tx.episode.create({
                    data: {
                        projectId,
                        index: 1,
                        name: 'Default Episode',
                    }
                });
            }
            const episodeId = episode.id;

            // Clean up old matches
            const oldScenes = await tx.scene.findMany({ where: { episodeId }, select: { id: true } });
            const oldSceneIds = oldScenes.map(s => s.id);
            if (oldSceneIds.length > 0) {
                await tx.shot.deleteMany({ where: { sceneId: { in: oldSceneIds } } });
                await tx.scene.deleteMany({ where: { episodeId } });
            }

            // Batch Insert Scenes & Shots
            for (const [sIdx, scene] of allScenes.entries()) {
                const dbScene = await tx.scene.create({
                    data: {
                        projectId,
                        episodeId,
                        sceneIndex: sIdx + 1,
                        title: scene.title || `场景 ${sIdx + 1}`,
                        summary: scene.description || scene.summary || '',
                        enrichedText: scene.shots?.map((s: any) => s.text).join('\n') || '',
                    },
                });
                createdSceneIds.push(dbScene.id);

                if (scene.shots && scene.shots.length > 0) {
                    await tx.shot.createMany({
                        data: scene.shots.map((shot: any, shIdx: number) => {
                            const shotParams = {
                                sourceText: shot.text,
                                ...(shot.visualParams || {}),
                            };
                            const visual = shot.visualParams || {};

                            return hydrateShotWithDirectorControls(
                                {
                                    organizationId: job.organizationId as string,
                                    sceneId: dbScene.id,
                                    index: shIdx + 1,
                                    title: shot.title || `Shot ${shIdx + 1}`,
                                    description: shot.summary || shot.text.slice(0, 50),
                                    type: 'novel_reduce',
                                    params: shotParams,
                                    shotType: visual.shotType || 'MEDIUM_SHOT',
                                    cameraMovement: visual.cameraMovement || 'STATIC',
                                    lightingPreset: visual.lightingPreset || 'NATURAL',
                                },
                                shotParams
                            );
                        }),
                    });
                }
            }
        }, { timeout: 120000 }); // Large novel = large transaction

        // 4. Update Final Status
        if (novelSourceId) {
            await prisma.novelSource.update({
                where: { id: novelSourceId },
                data: { status: 'COMPLETED' as any }
            });
        }

        await prisma.novelIngestRun.update({
            where: { id: ingestRunId },
            data: { status: 'COMPLETED' }
        });

        // 5. Cascade Trigger (Shot Planning)
        if (createdSceneIds.length > 0) {
            const targetEngineKey = isVerification ? 'ce11_shot_generator_mock' : 'ce11_shot_generator_real';

            const cascadeJobs = createdSceneIds.map((sceneId, idx) => ({
                type: JobType.CE11_SHOT_GENERATOR,
                status: JobStatus.PENDING,
                projectId,
                organizationId: job.organizationId,
                taskId: job.taskId,
                traceId: job.traceId,
                isVerification,
                priority: 5 + (idx % 10),
                payload: {
                    novelSceneId: sceneId,
                    projectId,
                    traceId: job.traceId,
                    engineKey: targetEngineKey,
                    isVerification,
                },
            }));

            // Create with bindings to satisfy PRODUCTION_MODE requirements
            const BATCH = 20;
            for (let i = 0; i < cascadeJobs.length; i += BATCH) {
                const batchJobs = cascadeJobs.slice(i, i + BATCH);
                await Promise.all(batchJobs.map(jobData =>
                    prisma.shotJob.create({
                        data: {
                            ...jobData,
                            engineBinding: {
                                create: {
                                    engineKey: targetEngineKey,
                                    engine: { connect: { engineKey: targetEngineKey } },
                                    status: 'BOUND',
                                }
                            }
                        } as any
                    })
                ));
            }
            console.log(`[NovelReduce] Triggered ${cascadeJobs.length} CE11_SHOT_GENERATOR jobs with bindings.`);
        }

        const durationSec = (Date.now() - t0) / 1000;
        stage4DurationSeconds.observe({ type: job.type }, durationSec);
        stage4PeakRssMb.set({ type: job.type }, peakRssMb);
        stage4JobsTotal.inc({ type: job.type, status: 'SUCCEEDED' }, 1);

        return {
            status: 'SUCCEEDED',
            message: `Aggregated ${allScenes.length} scenes and triggered shot planning.`,
        };

    } catch (error: any) {
        console.error(`[NovelReduce] ❌ Error: ${error.message}`);
        stage4JobsTotal.inc({ type: job.type, status: 'FAILED' }, 1);
        throw error;
    }
}

async function readChunk(filePath: string, start: number, end: number): Promise<string> {
    const readStream = fs.createReadStream(filePath, { start: start, end: end - 1 });
    let result = '';
    for await (const chunk of readStream) {
        result += chunk.toString('utf8');
    }
    return result;
}
