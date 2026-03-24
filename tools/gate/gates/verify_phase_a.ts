import { PrismaClient } from '@prisma/client';
import { processStage1OrchestratorJob } from '../../../apps/workers/src/processors/stage1-orchestrator.processor';

const prisma = new PrismaClient();

async function main() {
    const orgId = `org_mock_${Date.now()}`;
    const projId = `proj_mock_${Date.now()}`;
    const epId = `ep_mock_${Date.now()}`;
    const traceId = `trace_${Date.now()}`;
    
    console.log("[Phase A] Setting up mock data...");
    await prisma.organization.create({ data: { id: orgId, name: 'Mock Org', ownerId: 'sys', updatedAt: new Date(), credits: 1000 } });
    await prisma.project.create({ data: { id: projId, name: 'Mock Proj', organizationId: orgId, ownerId: 'sys', status: 'in_progress', updatedAt: new Date() } });
    await prisma.season.create({ data: { id: `season_${Date.now()}`, projectId: projId, index: 1, title: 'S1', updatedAt: new Date() } });
    await prisma.episode.create({ data: { id: epId, seasonId: `season_${Date.now()}`, projectId: projId, name: 'Ep1', index: 1 } });

    const jobPayload = {
        novelText: "A WIDE SHOT of a valley.",
        projectId: projId,
        episodeId: epId,
        pipelineRunId: `run_${Date.now()}`,
        traceId: traceId
    };

    const mockJob = await prisma.shotJob.create({
        data: {
            organizationId: orgId,
            projectId: projId,
            episodeId: epId,
            traceId: traceId,
            type: 'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
            status: 'PENDING',
            payload: jobPayload,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    const mockCtx = {
        prisma: prisma as any,
        job: mockJob as any,
        logger: console,
        apiClient: { createJob: async (data: any) => ({ id: `dummy-job-${Date.now()}` }) } as any
    };

    console.log("[Phase A] --- RUNNING FIRST TIME ---");
    await processStage1OrchestratorJob(mockCtx);
    let shots1 = await prisma.shot.findMany({ where: { organizationId: orgId } });
    console.log(`[Phase A] First Run Complete. Shots in DB: ${shots1.length}`);

    console.log("[Phase A] --- RUNNING SECOND TIME (IDEMPOTENCY CHECK) ---");
    await processStage1OrchestratorJob(mockCtx);
    let shots2 = await prisma.shot.findMany({ where: { organizationId: orgId } });
    console.log(`[Phase A] Second Run Complete. Shots in DB: ${shots2.length}`);

    if (shots1.length === shots2.length && shots1.length > 0) {
        console.log("✅ PASS: Idempotency verified. Shots updated without UniqueConstraintError!");
    } else {
        console.log("❌ FAIL: Shots count mismatched or zero. Error in idempotency!");
        process.exit(1);
    }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
