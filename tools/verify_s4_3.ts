import { PrismaClient, AssetOwnerType, AssetType } from 'database';
import { ApiClient } from '../apps/workers/src/api-client';
import * as path from 'path';
import * as fs from 'fs';

// DEV-ONLY GUARD
if (process.env.GATE_MODE !== '1') {
  console.error('❌ GATE_MODE=1 required');
  process.exit(1);
}

if (process.env.RENDER_ENGINE !== 'mock') {
  console.error('❌ RENDER_ENGINE=mock required');
  process.exit(1);
}

const prisma = new PrismaClient();
const apiClient = new ApiClient(
  process.env.API_URL || 'http://localhost:3000',
  process.env.WORKER_API_KEY || 'scu-worker-key',
  process.env.WORKER_API_SECRET || 'scu-worker-secret'
);

async function main() {
  console.log('🚀 Starting S4-3 Verification (E2E -> Render Asset)...');

  // 1. Setup Fixtures
  const projectId = `test-s43-${Date.now()}`;
  const pipelineRunId = `run-${Date.now()}`;
  const uniqueShotId = `shot-${Date.now()}`;

  console.log(`Fixtures: Project=${projectId} RunId=${pipelineRunId}`);

  // Create DB State
  const user = await prisma.user.create({
    data: {
      email: `user-s4-3-${Date.now()}@test.com`,
      passwordHash: 'mock-hash',
    },
  });
  const org = await prisma.organization.create({
    data: { name: 'S4-3 Org', ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: {
      id: projectId,
      name: 'S4-3 Project',
      ownerId: user.id,
      organizationId: org.id,
    },
  });
  const season = await prisma.season.create({
    data: { projectId, title: 'S1', index: 1 },
  });
  const episode = await prisma.episode.create({
    data: { seasonId: season.id, name: 'E1', index: 1, projectId },
  });
  const scene = await prisma.scene.create({
    data: { episodeId: episode.id, title: 'Sc1', index: 1, projectId },
  });
  const shot = await prisma.shot.create({
    data: {
      id: uniqueShotId,
      sceneId: scene.id,
      index: 1,
      organizationId: org.id,
      type: 'SHOT',
      enrichedPrompt: 'A futuristic caterpillar verification test.',
    },
  });

  // 2. Trigger Chain Start (E2E Pipeline Job)
  // ApiClient uses REST, so we can use `fetch` or just use Prisma if ApiClient doesn't expose public createJob
  // Actually, looking at api-client.ts, it might not have createJob.
  // We will cheat and use DB directly to enqueue the job as 'PENDING'
  // because this is an internal verification tool.
  const rootJob = await prisma.shotJob.create({
    data: {
      type: 'PIPELINE_E2E_VIDEO',
      projectId,
      shotId: shot.id,
      organizationId: org.id,
      episodeId: episode.id,
      sceneId: scene.id,
      status: 'PENDING',
      payload: { projectId, pipelineRunId, traceId: 'verify-trace' },
    },
  });

  console.log(`Root Job Created (DB): ${rootJob.id}`);

  // 3. Poll for SHOT_RENDER Success
  let renderJobId: string | undefined;
  let attempts = 0;
  while (attempts++ < 60) {
    const jobs = await prisma.shotJob.findMany({
      where: { projectId, payload: { path: ['pipelineRunId'], equals: pipelineRunId } },
    });

    // Debug Log
    const types = jobs.map((j) => `${j.type}:${j.status}`).join(', ');
    if (attempts % 5 === 0) console.log(`[${attempts}/60] Jobs: ${types}`);

    const renderJob = jobs.find((j) => j.type === 'SHOT_RENDER');
    if (renderJob && renderJob.status === 'SUCCEEDED') {
      renderJobId = renderJob.id;
      break;
    }

    if (jobs.some((j) => j.status === 'FAILED')) {
      console.error('❌ Chain Broken: Found FAILED job');
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!renderJobId) {
    console.error('❌ Timeout waiting for SHOT_RENDER SUCCEEDED');
    process.exit(1);
  }
  console.log(`✅ SHOT_RENDER Succeeded: ${renderJobId}`);

  // 4. Verify Asset Persistence
  const asset = await prisma.asset.findFirst({
    where: {
      ownerId: shot.id,
      ownerType: AssetOwnerType.SHOT,
      type: AssetType.IMAGE,
    },
  });

  if (!asset) {
    console.error('❌ Asset record not found in DB');
    process.exit(1);
  }
  console.log(`✅ Asset persisted: ${asset.id} Key=${asset.storageKey}`);

  // 5. Verify File Existence
  const absPath = path.resolve(process.cwd(), '.runtime', asset.storageKey);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found at ${absPath}`);
    process.exit(1);
  }
  console.log(`✅ File confirmed on disk`);

  // 6. Idempotency Check
  console.log('🔄 Checking Idempotency (Simulating Duplicate CE04)...');

  const jobCountBefore = await prisma.shotJob.count({
    where: {
      projectId,
      type: 'SHOT_RENDER',
      payload: { path: ['pipelineRunId'], equals: pipelineRunId },
    },
  });

  // Create duplicate CE04 to trigger spawn logic check
  await prisma.shotJob.create({
    data: {
      projectId,
      organizationId: org.id,
      episodeId: episode.id,
      sceneId: scene.id,
      shotId: shot.id,
      type: 'CE04_VISUAL_ENRICHMENT',
      status: 'PENDING',
      payload: { pipelineRunId, traceId: 'retry-test' },
    },
  });

  // Wait for worker
  await new Promise((r) => setTimeout(r, 6000));

  const jobCountAfter = await prisma.shotJob.count({
    where: {
      projectId,
      type: 'SHOT_RENDER',
      payload: { path: ['pipelineRunId'], equals: pipelineRunId },
    },
  });

  const assetCountAfter = await prisma.asset.count({
    where: { ownerId: shot.id, type: AssetType.IMAGE },
  });

  if (jobCountAfter !== jobCountBefore) {
    console.error(`❌ Idempotency FAILED: Job count changed ${jobCountBefore} -> ${jobCountAfter}`);
    process.exit(1);
  }

  if (assetCountAfter !== 1) {
    console.error(`❌ Idempotency FAILED: Asset count changed -> ${assetCountAfter}`);
    process.exit(1);
  }

  console.log(
    `✅ Idempotency Verified (Job Count: ${jobCountAfter}, Asset Count: ${assetCountAfter})`
  );
  // Cleanup
  console.log('🧹 Cleaning up fixtures...');

  // Helper for safe deletion
  const safeDelete = async (label: string, task: () => Promise<any>) => {
    try {
      await task();
      console.log(`   ✅ Deleted ${label}`);
    } catch (err: any) {
      console.warn(`   ⚠️ Failed to delete ${label}: ${err.message?.split('\n')[0]}`);
      // Continue despite error
    }
  };

  // 1. Delete Audit Logs (Leaves)
  await safeDelete('AuditLogs', () =>
    prisma.auditLog.deleteMany({
      where: { orgId: org.id },
    })
  );

  // 2. Delete Assets (Leaves)
  await safeDelete('Assets', () =>
    prisma.asset.deleteMany({
      where: { projectId: projectId },
    })
  );

  // 3. Delete Jobs (Leaves)
  await safeDelete('ShotJobs', () =>
    prisma.shotJob.deleteMany({
      where: { projectId: projectId },
    })
  );

  // 3a. Delete Tasks
  await safeDelete('Tasks', () =>
    prisma.task.deleteMany({
      where: { projectId: projectId },
    })
  );

  // 4. Delete Shot (Child of Scene)
  // Shot does not have projectId, find via Scene or let Scene cascade?
  // We'll trust explicit deletion via relation
  await safeDelete('Shot', () =>
    prisma.shot.deleteMany({
      where: { scene: { projectId } },
    })
  );

  // 5. Delete Scene (Child of Episode)
  await safeDelete('Scene', () =>
    prisma.scene.deleteMany({
      where: { projectId: projectId },
    })
  );

  // Project dependents (No Cascade) - Added for robustness
  await safeDelete('BillingEvents', () => prisma.billingEvent.deleteMany({ where: { projectId } }));
  await safeDelete('CostLedgers', () => prisma.costLedger.deleteMany({ where: { projectId } }));
  await safeDelete('ProjectMembers', () =>
    prisma.projectMember.deleteMany({ where: { projectId } })
  );
  await safeDelete('StructureQualityReports', () =>
    prisma.structureQualityReport.deleteMany({ where: { projectId } })
  );

  // 6. Delete Episode (Child of Season)
  await safeDelete('Episode', () =>
    prisma.episode.deleteMany({
      where: { projectId: projectId },
    })
  );

  // 7. Delete Season (Child of Project)
  await safeDelete('Season', () =>
    prisma.season.deleteMany({
      where: { projectId: projectId },
    })
  );

  // 8. Delete Project (Root)
  await safeDelete('Project', () =>
    prisma.project.delete({
      where: { id: projectId },
    })
  );

  // 9. Delete Org (Root)
  await safeDelete('Organization', () =>
    prisma.organization.delete({
      where: { id: org.id },
    })
  );

  await safeDelete('User', () =>
    prisma.user.delete({
      where: { id: user.id },
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
