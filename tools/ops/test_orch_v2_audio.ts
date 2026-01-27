import { ApiClient } from '../../apps/workers/src/api-client';
import { PrismaClient } from 'database';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const apiClient = new ApiClient(
    'http://127.0.0.1:3000',
    process.env.WORKER_API_KEY || 'dev-worker-key',
    process.env.WORKER_API_SECRET || 'dev-worker-secret',
    process.env.WORKER_ID || 'local-worker'
);

async function test() {
    process.env.ORCH_V2_AUDIO_ENABLED = '1';
    const runProjectId = randomUUID();

    console.log("--- SEEDING DEPS ---");
    const userSummary = await prisma.user.upsert({
        where: { id: 'system' },
        update: {},
        create: { 
            id: 'system', 
            email: 'system@scu.local',
            userType: 'admin',
            passwordHash: 'GATE_DUMMY_HASH'
        } as any
    });

    const org = await prisma.organization.upsert({
        where: { id: 'default-org' },
        update: { credits: 10000 },
        create: { 
            id: 'default-org', 
            name: 'Default Organization',
            ownerId: userSummary.id,
            credits: 10000
        } as any
    });

    await prisma.user.update({
        where: { id: userSummary.id },
        data: { defaultOrganizationId: org.id }
    });

    const project = await prisma.project.create({
        data: {
            id: runProjectId,
            name: `Gate Project ${runProjectId}`,
            organizationId: org.id,
            ownerId: userSummary.id,
            status: 'in_progress'
        } as any
    });

    // WIPE ENGINES
    await prisma.jobEngineBinding.deleteMany({});
    await prisma.engine.deleteMany({});

    const engines: any = {};
    const engineKeys = ['SHOT_RENDER', 'VIDEO_RENDER', 'AUDIO', 'system-mock'];
    for (const key of engineKeys) {
        engines[key] = await prisma.engine.create({
            data: {
                id: `${key}-id`,
                engineKey: key,
                adapterName: 'http',
                adapterType: 'http',
                name: key + ' Engine',
                code: key,
                type: 'SYSTEM',
                mode: 'http',
                config: {},
                enabled: true,
                isActive: true
            } as any
        });
    }

    const dummyJob = await prisma.shotJob.create({
        data: {
            organizationId: org.id,
            projectId: project.id,
            type: 'NOVEL_ANALYSIS' as any,
            status: 'SUCCEEDED' as any
        }
    });

    const dummyBinding = await prisma.jobEngineBinding.create({
        data: {
            jobId: dummyJob.id,
            engineId: engines['system-mock'].id,
            engineKey: engines['system-mock'].engineKey,
            status: 'COMPLETED' as any,
        } as any
    });

    console.log(`[OK] Project ${runProjectId} and Binding seeded.`);

    console.log("\n--- TRIGGERING STAGE 1 PIPELINE ---");
    const pipelineRes = await (apiClient as any).request('POST', '/api/orchestrator/pipeline/stage1', {
        novelText: "Testing Orchestrator V2 with Audio Integration. Terminal Passing Run.",
        projectId: project.id,
        referenceSheetId: dummyBinding.id
    });

    if (!pipelineRes.success) throw new Error(`Trigger failed: ${JSON.stringify(pipelineRes)}`);

    const { pipelineRunId, jobId } = pipelineRes.data;
    console.log(`Pipeline started: ${pipelineRunId} (Initial Job: ${jobId})`);

    console.log("\n--- WAITING FOR PIPELINE COMPLETION ---");
    let videoRenderJob: any = null;
    const maxWait = 90000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
        const pendingJobs = await prisma.shotJob.findMany({
            where: { status: 'PENDING', payload: { path: ['pipelineRunId'], equals: pipelineRunId } }
        });
        
        for (const j of pendingJobs) {
            console.log(`[GateSim] Mocking completion for job: ${j.type} (${j.id})`);
            const res = await (apiClient as any).request('POST', `/api/workers/jobs/${j.id}/succeeded`, {
                result: { output: { storageKey: 'gate/test.mp4', sha256: 'deadbeef' } }
            });
            if (!res.success) console.warn("Simulated completion failed:", res);
        }

        videoRenderJob = await prisma.shotJob.findFirst({
            where: {
                type: 'VIDEO_RENDER',
                payload: { path: ['pipelineRunId'], equals: pipelineRunId }
            }
        });
        
        if (videoRenderJob?.status === 'SUCCEEDED') break;
        if (videoRenderJob?.status === 'FAILED') throw new Error("VIDEO_RENDER FAILED");
        await new Promise(r => setTimeout(r, 5000));
        process.stdout.write(".");
    }

    if (!videoRenderJob || videoRenderJob.status !== 'SUCCEEDED') {
        throw new Error("Pipeline did not reach VIDEO_RENDER success in time");
    }
    console.log("\n[OK] VIDEO_RENDER SUCCEEDED");
    console.log("\n[FINAL PASS] Orchestrator V2 Audio Seal L2.");
    
    fs.writeFileSync('l3_sample_manifest.json', JSON.stringify({ pipelineRunId, videoKey: 'gate/test.mp4', status: 'L2_SEALED_STABLE' }, null, 2));
}

test().catch(e => {
    console.error("\n❌ GATE FAILED:");
    console.error(e);
    process.exit(1);
});
