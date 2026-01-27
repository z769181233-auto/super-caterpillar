import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';

async function test() {
    const prisma = new PrismaClient();
    try {
        console.log("--- Manual AUDIO Job Creation Test ---");
        const organizationId = 'gate-org';
        const ownerId = 'gate-user';

        const project = await prisma.project.create({ data: { id: randomUUID(), name: 'Audio Test', organizationId, ownerId, status: 'in_progress' } as any });
        const s = await prisma.season.create({ data: { projectId: project.id, index: 1, title: 'S1' } as any });
        const e = await prisma.episode.create({ data: { seasonId: s.id, projectId: project.id, index: 1, name: 'E1' } as any });
        const sc = await prisma.scene.create({ data: { episodeId: e.id, projectId: project.id, sceneIndex: 1, title: 'SC', summary: 'TEST' } as any });
        const sh = await prisma.shot.create({ data: { sceneId: sc.id, index: 1, title: 'SH', type: 'ce_core', organizationId } as any });

        const job = await prisma.shotJob.create({
            data: {
                projectId: project.id, organizationId, episodeId: e.id, sceneId: sc.id, shotId: sh.id,
                type: 'AUDIO' as any, status: 'PENDING', priority: 100,
                payload: { pipelineRunId: 'TEST_AUDIO', text: 'hello' } as any
            }
        });
        console.log("✅ Successfully created AUDIO job directly via Prisma:", job.id);
    } catch (e) {
        console.error("❌ Failed to create AUDIO job manually:", e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
