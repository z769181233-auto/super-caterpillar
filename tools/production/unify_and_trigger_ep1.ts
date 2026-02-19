import { PrismaClient, JobType, JobStatus } from '../../packages/database/src/generated/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient();

async function main() {
    const targetProjectId = 'wangu_ep1_peak_v4';
    const targetEpisodeId = 'ep-wangu_ep1_peak_v4';
    const organizationId = 'org-wangu-prod';

    console.log(`--- Unifying Episode 1 Assets into ${targetProjectId} ---`);

    // 1. Find all other projects for "万古神帝 第一章"
    const novels = await prisma.novel.findMany({
        where: {
            organizationId: organizationId,
            title: '万古神帝 第一章',
            NOT: { projectId: targetProjectId }
        }
    });

    const sourceProjectIds = novels.map(n => n.projectId);
    console.log(`Found ${sourceProjectIds.length} source projects to migrate.`);

    // 2. Migrate Scenes
    const updateScenes = await prisma.scene.updateMany({
        where: {
            projectId: { in: sourceProjectIds as string[] }
        },
        data: {
            projectId: targetProjectId,
            episodeId: targetEpisodeId
        }
    });
    console.log(`Migrated ${updateScenes.count} scenes to ${targetProjectId}.`);

    // 3. Trigger Rendering for all shots in the target project
    const scenesInTarget = await prisma.scene.findMany({
        where: { projectId: targetProjectId }
    });

    let totalShots = 0;
    let triggeredShots = 0;

    for (const scene of scenesInTarget) {
        const shots = await prisma.shot.findMany({
            where: { sceneId: scene.id }
        });
        totalShots += shots.length;

        for (const shot of shots) {
            // Create SHOT_RENDER job
            const existing = await prisma.shotJob.findFirst({
                where: {
                    shotId: shot.id,
                    type: JobType.SHOT_RENDER
                }
            });

            if (!existing || existing.status === JobStatus.FAILED) {
                await prisma.shotJob.upsert({
                    where: { id: existing?.id || `manual_${shot.id}` },
                    update: { status: JobStatus.PENDING, lastError: null },
                    create: {
                        id: `manual_${shot.id}`,
                        projectId: targetProjectId,
                        organizationId: organizationId,
                        episodeId: targetEpisodeId,
                        sceneId: scene.id,
                        shotId: shot.id,
                        type: JobType.SHOT_RENDER,
                        status: JobStatus.PENDING,
                        priority: 50,
                        payload: {
                            projectId: targetProjectId,
                            sceneId: scene.id,
                            engineKey: 'real_shot_render',
                            pipelineRunId: `unify_trigger_${Date.now()}`
                        },
                        traceId: `unify_trace_${Date.now()}`
                    }
                });
                triggeredShots++;
            }
        }
    }

    console.log(`Total Shots in Project: ${totalShots}`);
    console.log(`Newly Triggered/Reset: ${triggeredShots}`);
    console.log('--- Done ---');
}

main().finally(() => prisma.$disconnect());
