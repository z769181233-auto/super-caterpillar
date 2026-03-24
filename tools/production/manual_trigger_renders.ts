import { PrismaClient, JobType, JobStatus } from '../../packages/database/src/generated/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const prisma = new PrismaClient({});

async function main() {
    const projectId = 'wangu_ep1_peak_v4';
    const organizationId = 'org-wangu-prod';

    console.log(`--- Manually Triggering SHOT_RENDER for ${projectId} ---`);

    // 1. Find all shots in this project
    const scenes = await prisma.scene.findMany({
        where: { projectId: projectId }
    });

    console.log(`Found ${scenes.length} scenes.`);

    let totalShots = 0;
    let triggeredShots = 0;

    for (const scene of scenes) {
        const shots = await prisma.shot.findMany({
            where: { sceneId: scene.id }
        });
        totalShots += shots.length;

        for (const shot of shots) {
            // Check if job already exists
            const existing = await prisma.shotJob.findFirst({
                where: {
                    shotId: shot.id,
                    type: JobType.SHOT_RENDER
                }
            });

            if (!existing) {
                await prisma.shotJob.create({
                    data: {
                        projectId: projectId,
                        organizationId: organizationId,
                        episodeId: scene.episodeId,
                        sceneId: scene.id,
                        shotId: shot.id,
                        type: JobType.SHOT_RENDER,
                        status: JobStatus.PENDING,
                        priority: 10,
                        payload: {
                            projectId: projectId,
                            sceneId: scene.id,
                            engineKey: 'real_shot_render',
                        },
                        traceId: `manual_trigger_${Date.now()}`
                    }
                });
                triggeredShots++;
            }
        }
    }

    console.log(`Total Shots Found: ${totalShots}`);
    console.log(`Newly Triggered: ${triggeredShots}`);
    console.log('--- Done ---');
}

main().finally(() => prisma.$disconnect());
