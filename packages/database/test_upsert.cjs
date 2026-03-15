const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    console.log("[Phase A] --- RUNNING IDEMPOTENCY TEST (CJS) ---");
    const orgId = `org_mock_${Date.now()}`;
    const projId = `proj_mock_${Date.now()}`;
    const epId = `ep_mock_${Date.now()}`;
    
    await prisma.organization.create({ data: { id: orgId, name: 'Mock Org', ownerId: 'sys', updatedAt: new Date(), credits: 1000 } });
    await prisma.project.create({ data: { id: projId, name: 'Mock Proj', organizationId: orgId, ownerId: 'sys', status: 'in_progress', updatedAt: new Date() } });
    await prisma.season.create({ data: { id: `season_${Date.now()}`, projectId: projId, index: 1, title: 'S1', updatedAt: new Date() } });
    await prisma.episode.create({ data: { id: epId, seasonId: `season_${Date.now()}`, projectId: projId, name: 'Ep1', index: 1 } });
    const scene = await prisma.scene.create({
        data: { episodeId: epId, projectId: projId, sceneIndex: 1, title: 'Main Scene', summary: 'Auto-generated' }
    });

    const shotData = {
        sceneId: scene.id,
        organizationId: orgId,
        index: 1,
        title: `Shot 1`,
        description: "Test paragraph",
        reviewStatus: 'APPROVED',
        params: { prompt: "Test paragraph", aspect_ratio: '16:9' },
        type: 'shot',
        enrichedPrompt: "Test paragraph"
    };

    console.log("[Phase A] FIRST EXECUTION: Simulating orchestration creating shot 1...");
    await prisma.shot.upsert({
        where: { sceneId_index: { sceneId: scene.id, index: 1 } },
        update: shotData,
        create: shotData,
    });
    console.log("-> Success. No constraint violation.");

    console.log("[Phase A] SECOND EXECUTION: Simulating orchestration creating shot 1 again (DUPLICATE PAYLOAD)...");
    await prisma.shot.upsert({
        where: { sceneId_index: { sceneId: scene.id, index: 1 } },
        update: shotData,
        create: shotData,
    });
    console.log("-> Success. Idempotent upsert absorbed the duplicate without crashing.");

    const dbShots = await prisma.shot.findMany({ where: { organizationId: orgId } });
    console.log(`[Phase A] DB Verification: Found exactly ${dbShots.length} shot(s). Expected: 1.`);
    
    if (dbShots.length === 1) {
        console.log("✅ PASS: Idempotency is mathematically proven at the Prisma layer.");
    } else {
        console.log("❌ FAIL: Duplicate shots or zero shots found.");
    }
}

run().catch(e => console.error("FATAL:", e)).finally(() => prisma.$disconnect());
