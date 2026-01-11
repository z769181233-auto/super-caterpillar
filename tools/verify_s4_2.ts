import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// 1. Safety Check: Dev/Local Only
if (process.env.NODE_ENV !== 'development' && process.env.CI) {
  console.error('❌ ERROR: This verification script is permitted in local development only.');
  process.exit(1);
}

import { PrismaClient } from '../packages/database';
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to DB...');
  await prisma.$connect();

  const pipelineRunId = 'run-' + Date.now();
  const projectId = 'test-s42-' + Date.now();
  const orgId = 'org-s42-' + Date.now();

  // Create Fixtures (Minimal)
  const user = await prisma.user.create({
    data: { id: 'u-' + Date.now(), email: 'u' + Date.now() + '@t.com', passwordHash: 'x' },
  });
  const org = await prisma.organization.create({
    data: { id: orgId, name: 'Org S4-2', ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: { id: projectId, name: 'Proj S4-2', ownerId: user.id, organizationId: orgId },
  });

  const season = await prisma.season.create({ data: { projectId, title: 'S1', index: 1 } });
  const episode = await prisma.episode.create({
    data: { seasonId: season.id, projectId, name: 'Ep1', index: 1 },
  });
  const scene = await prisma.scene.create({
    data: { episodeId: episode.id, projectId, title: 'Sc1', index: 1 },
  });
  const shot = await prisma.shot.create({
    data: { sceneId: scene.id, title: 'Shot1', type: 'DEFAULT', index: 1 },
  });

  console.log(`Fixtures: Project=${projectId} Shot=${shot.id} RunId=${pipelineRunId}`);

  // Trigger: Create PIPELINE_E2E_VIDEO (which effectively launches CE06 -> 03 -> 04)
  // Or we can start directly at CE06?
  // Plan says: trigger is E2E Pipeline or CE06. Let's start with E2E to verify full chain linkage.

  // BUT E2E pipeline processor (existing) needs to spawn CE06.
  // Existing code in e2e-video-pipeline.processor.ts spawns CE06.
  // Does it pass the right context? Yes, verified in S4-1.
  // So creating E2E job triggers the chain: E2E -> CE06 -> CE03 -> CE04.

  const rootJob = await prisma.shotJob.create({
    data: {
      projectId,
      organizationId: orgId,
      type: 'PIPELINE_E2E_VIDEO',
      status: 'PENDING',
      traceId: 'trace-' + pipelineRunId,
      episodeId: episode.id,
      sceneId: scene.id,
      shotId: shot.id,
      payload: {
        projectId,
        pipelineRunId,
      },
    } as any,
  });

  console.log(`Root Job Created: ${rootJob.id}`);

  // Wait for chain completion
  // We expect 4 jobs total: Root, CE06, CE03, CE04

  const requiredTypes = [
    'PIPELINE_E2E_VIDEO',
    'CE06_NOVEL_PARSING',
    'CE03_VISUAL_DENSITY',
    'CE04_VISUAL_ENRICHMENT',
  ];

  let attempts = 0;
  while (attempts < 30) {
    const jobs = await prisma.shotJob.findMany({
      where: {
        projectId,
      },
    });

    console.log(`[Algorithm Debug] Found ${jobs.length} jobs for project ${projectId}:`);
    jobs.forEach((j) => {
      console.log(` - ID: ${j.id} Type: ${j.type} Status: ${j.status} ShotId: ${j.shotId}`);
      console.log(`   Payload: ${JSON.stringify(j.payload)}`);
    });

    const targetJobs = jobs.filter((j) => {
      const pl = j.payload as any;
      return pl?.pipelineRunId === pipelineRunId;
    });

    // Check Status
    const typesFound = jobs.map((j) => j.type);
    const allCompleted = jobs.every((j) => j.status === 'SUCCEEDED');

    console.log(
      `[${attempts}/30] Found ${jobs.length} jobs: ${typesFound.join(', ')} | All Success: ${allCompleted}`
    );

    if (requiredTypes.every((t) => typesFound.includes(t as any)) && allCompleted) {
      console.log('✅ All chain jobs present and SUCCEEDED.');

      // Verify Persistence
      const updatedShot = await prisma.shot.findUnique({ where: { id: shot.id } });

      // 1. Quality Score
      const qs = updatedShot?.qualityScore as any;
      if (qs?.ce03?.visualDensity && typeof qs.ce03.visualDensity === 'number') {
        console.log('✅ Shot.qualityScore persisted:', JSON.stringify(qs.ce03));
      } else {
        console.error('❌ Shot.qualityScore missing or invalid:', qs);
        process.exit(1);
      }

      // 2. Enriched Prompt
      if (updatedShot?.enrichedPrompt && updatedShot.enrichedPrompt.length > 0) {
        console.log('✅ Shot.enrichedPrompt persisted:', updatedShot.enrichedPrompt);
      } else {
        console.error('❌ Shot.enrichedPrompt missing or empty');
        process.exit(1);
      }

      console.log('VERIFICATION SUCCESS: S4-2 Chain Complete & Persisted');
      process.exit(0);
    }

    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  console.error('TIMEOUT: Chain did not complete in time');
  process.exit(1);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
