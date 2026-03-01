import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// 1. Safety Check: 本地/非CI验证专用
if (process.env.NODE_ENV !== 'development' && process.env.CI) {
  console.error('❌ ERROR: This verification script is permitted in local development only.');
  process.exit(1);
}

// 2. Gate Mode Warning
if (process.env.GATE_MODE === '0') {
  console.warn(
    '⚠️  WARNING: Running with GATE_MODE=0. This should only be used for local verification.'
  );
}

import { PrismaClient } from '../packages/database';
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to DB...');
  await prisma.$connect();

  const projectId = 'test-project-s4-1-' + Date.now();
  const userId = 'user-test-' + Date.now();
  const orgId = 'org-test-' + Date.now();

  console.log(`Creating test fixtures: Project=${projectId}, Org=${orgId}`);

  // Create minimal fixtures
  const user = await prisma.user.create({
    data: { id: userId, email: userId + '@test.com', passwordHash: 'hash' },
  });
  const org = await prisma.organization.create({
    data: { id: orgId, name: 'Test Org', ownerId: userId },
  });
  const project = await prisma.project.create({
    data: { id: projectId, name: 'Test Project', ownerId: userId, organizationId: orgId },
  });

  const seasonId = 'season-' + Date.now();
  const episodeId = 'ep-' + Date.now();
  const sceneId = 'scene-' + Date.now();
  const shotId = 'shot-' + Date.now();

  // Create hierarchy
  await prisma.season.create({
    data: { id: seasonId, projectId, title: 'Season 1', index: 1 },
  });

  await prisma.episode.create({
    data: { id: episodeId, seasonId, projectId, name: 'Ep 1', index: 1 },
  });

  await prisma.scene.create({
    data: { id: sceneId, episodeId, projectId, title: 'Scene 1', index: 1 },
  });

  await prisma.shot.create({
    data: { id: shotId, sceneId, title: 'Shot 1', type: 'DEFAULT', index: 1 },
  });

  console.log('Creating PIPELINE_E2E_VIDEO job...');
  const traceId = 'trace-' + Date.now();

  // Create Job with required relations
  const pipelineJob = await prisma.shotJob.create({
    data: {
      projectId,
      organizationId: orgId,
      type: 'PIPELINE_E2E_VIDEO',
      status: 'PENDING',
      traceId,
      payload: {
        projectId,
        pipelineRunId: 'run-' + Date.now(),
      },
      episodeId: episodeId,
      sceneId: sceneId,
      shotId: shotId,
    } as any,
  });

  console.log(`Job created: ${pipelineJob.id}. Waiting for worker...`);

  // Wait for status change
  let attempts = 0;
  while (attempts < 20) {
    const job = await prisma.shotJob.findUnique({ where: { id: pipelineJob.id } });
    console.log(`Job status: ${job?.status}`);

    if (job?.status === 'SUCCEEDED') {
      console.log('Job SUCCEEDED!');
      // Verify result
      const result = job.result as any;
      console.log('Result:', JSON.stringify(result));

      if (result.status === 'SPAWNED_CE06' && result.spawned?.ce06JobId) {
        console.log('SUCCESS: CE06 Job Spawned:', result.spawned.ce06JobId);

        // Verify child job
        const child = await prisma.shotJob.findUnique({ where: { id: result.spawned.ce06JobId } });
        console.log('Child Job:', child);
        if (child && child.type === 'CE06_NOVEL_PARSING') {
          // Verify Context Propagation (episodeId, etc)
          if (
            child.episodeId === episodeId &&
            child.sceneId === sceneId &&
            child.shotId === shotId
          ) {
            console.log('VERIFICATION PASSED: Child job has correct context');
            process.exit(0);
          } else {
            console.log('VERIFICATION FAILED: Child job missing context IDs');
            process.exit(1);
          }
        } else {
          console.log('VERIFICATION FAILED: Child job not found or wrong type');
          process.exit(1);
        }
      }
      break;
    }

    if (job?.status === 'FAILED') {
      console.log('Job FAILED:', job.lastError);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  if (attempts >= 20) {
    console.log('Timeout waiting for job');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
