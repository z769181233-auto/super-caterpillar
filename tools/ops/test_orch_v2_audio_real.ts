import { ApiClient } from '../../apps/workers/src/api-client';
import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient();
const apiClient = new ApiClient(
    'http://127.0.0.1:3000',
    process.env.WORKER_API_KEY || 'dev-worker-key',
    process.env.WORKER_API_SECRET || 'dev-worker-secret',
    process.env.WORKER_ID || 'gate-real-worker-01'
);

async function test() {
    console.log("--- FINAL REAL E2E TEST RUN ---");
    const user = await prisma.user.upsert({
        where: { id: 'gate-user' },
        update: {},
        create: { id: 'gate-user', email: 'gate@scu.local', userType: 'admin', passwordHash: 'HASH' } as any
    });
    const org = await prisma.organization.upsert({
        where: { id: 'gate-org' },
        update: { credits: 1000 },
        create: { id: 'gate-org', name: 'Gate Org', ownerId: user.id, credits: 1000 } as any
    });
    const project = await prisma.project.create({
        data: { id: randomUUID(), name: 'L2 Final Seal', organizationId: org.id, ownerId: user.id, status: 'in_progress' } as any
    });

    const dummyJob = await prisma.shotJob.create({
        data: {
            organizationId: org.id,
            projectId: project.id,
            type: 'NOVEL_ANALYSIS' as any,
            status: 'SUCCEEDED' as any
        }
    });
    const refBinding = await prisma.jobEngineBinding.create({
        data: {
            jobId: dummyJob.id,
            engineId: 'system-mock-id',
            engineKey: 'system-mock',
            status: 'COMPLETED' as any,
        } as any
    });

    console.log(`[OK] Project ${project.id}. Triggering Pipeline...`);
    const pipelineRes = await (apiClient as any).request('POST', '/api/orchestrator/pipeline/stage1', {
        novelText: "Seal Proof. Sound + Vision.",
        projectId: project.id,
        referenceSheetId: refBinding.id,
        isVerification: true
    });

    if (!pipelineRes.success) throw new Error(`Trigger failed: ${JSON.stringify(pipelineRes)}`);
    const { pipelineRunId } = pipelineRes.data;
    console.log(`Pipeline: ${pipelineRunId}. Tracking Parallel Completion...`);

    const start = Date.now();
    let videoJobs: any[] = [];
    let audioJobs: any[] = [];

    while (Date.now() - start < 180000) {
        audioJobs = await prisma.shotJob.findMany({
            where: { type: 'AUDIO', payload: { path: ['pipelineRunId'], equals: pipelineRunId } }
        });
        videoJobs = await prisma.shotJob.findMany({
            where: { type: 'SHOT_RENDER', payload: { path: ['pipelineRunId'], equals: pipelineRunId } }
        });

        const audioReady = audioJobs.length > 0 && audioJobs.every(v => v.status === 'SUCCEEDED');
        const videoReady = videoJobs.length > 0 && videoJobs.every(v => v.status === 'SUCCEEDED');

        if (audioReady && videoReady) break;
        
        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 5000));
    }

    if (audioJobs.length === 0 || videoJobs.length === 0) throw new Error("DAG Transition Failed (Jobs missing)");
    if (audioJobs.some(v => v.status !== 'SUCCEEDED') || videoJobs.some(v => v.status !== 'SUCCEEDED')) throw new Error("Parallel Tracks Timeout or Error");

    console.log(`\n[OK] SUCCESS! AUDIO Count: ${audioJobs.length}, SHOT_RENDER Count: ${videoJobs.length}`);
    fs.writeFileSync('gate_real_output.json', JSON.stringify({ pipelineRunId, audioCount: audioJobs.length, videoCount: videoJobs.length }, null, 2));
}

test().catch(e => {
    console.error("\n❌ GATE ERROR:");
    console.error(e);
    process.exit(1);
});
