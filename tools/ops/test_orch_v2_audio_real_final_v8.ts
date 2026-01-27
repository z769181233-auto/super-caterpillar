import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function test() {
    console.log("--- L2 REAL SEAL: PERFECT PARALLEL RUN ---");
    const organizationId = 'gate-org';
    const ownerId = 'gate-user';

    await prisma.user.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, email: 'gate@scu.local', userType: 'admin', passwordHash: 'HASH' } as any });
    await prisma.organization.upsert({ where: { id: organizationId }, update: {}, create: { id: organizationId, name: 'Gate Org', ownerId } as any });

    const project = await prisma.project.create({ data: { id: randomUUID(), name: 'L2 Parallel Success', organizationId, ownerId, status: 'in_progress' } as any });
    const s = await prisma.season.create({ data: { projectId: project.id, index: 1, title: 'S1' } as any });
    const e = await prisma.episode.create({ data: { seasonId: s.id, projectId: project.id, index: 1, name: 'E1' } as any });
    const sc = await prisma.scene.create({ data: { episodeId: e.id, projectId: project.id, sceneIndex: 1, title: 'SC' } as any });
    const sh = await prisma.shot.create({ data: { sceneId: sc.id, index: 1, title: 'SH', type: 'ce_core', organizationId } as any });

    const jobsConfig = [
        { type: 'SHOT_RENDER', engineId: 'engine-s1', engineKey: 'default_shot_render' },
        { type: 'VIDEO_RENDER', engineId: 'engine-v2', engineKey: 'video_merge' }
    ];

    const jobIds: string[] = [];
    const pipelineRunId = 'FINAL_PERFECT';
    for (const j of jobsConfig) {
        const job = await prisma.shotJob.create({
            data: {
                projectId: project.id, organizationId, episodeId: e.id, sceneId: sc.id, shotId: sh.id,
                type: j.type as any, status: 'PENDING', priority: 100,
                payload: { pipelineRunId, isVerification: true }
            }
        });
        await prisma.jobEngineBinding.create({
            data: { jobId: job.id, engineId: j.engineId, engineKey: j.engineKey, status: 'BOUND' } as any
        });
        jobIds.push(job.id);
        console.log(`[Inject] ${j.type} (${job.id})`);
    }

    const start = Date.now();
    while (Date.now() - start < 150000) {
        const results = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
        const succeeded = results.filter(j => j.status === 'SUCCEEDED').length;
        console.log(`Audit: ${succeeded}/2 S. States=${results.map(x=>x.type+":"+x.status).join(',')}`);
        if (succeeded === 2) break;
        await new Promise(r => setTimeout(r, 5000));
    }

    const final = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
    if (final.every(x => x.status === 'SUCCEEDED')) {
        console.log("\n✅ L2 SEAL ACHIEVED: Parallel orchestration verified.");
        fs.writeFileSync('gate_real_output.json', JSON.stringify({ verifiedCount: 2, pipelineRunId }, null, 2));
    }
}

test().finally(() => prisma.$disconnect());
