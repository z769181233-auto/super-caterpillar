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

const prisma = new PrismaClient({});

async function main() {
  console.log('🚀 Starting S4-4 Verification (Video Synthesis)...');

  // 1. Setup Fixtures
  const projectId = `test-s44-${Date.now()}`;
  const pipelineRunId = `run-${Date.now()}`;

  console.log(`Fixtures: Project=${projectId} RunId=${pipelineRunId}`);

  // Create DB State
  const user = await prisma.user.create({
    data: {
      email: `user-s4-4-${Date.now()}@test.com`,
      passwordHash: 'mock-hash',
    },
  });

  const org = await prisma.organization.create({
    data: { name: 'S4-4 Org', ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: {
      id: projectId,
      name: 'S4-4 Project',
      owner: { connect: { id: user.id } },
      organization: { connect: { id: org.id } },
    },
  });
  const season = await prisma.season.create({
    data: {
      projectId: projectId,
      title: 'S1',
      index: 1,
    },
  });
  const episode = await prisma.episode.create({
    data: {
      seasonId: season.id,
      name: 'E1',
      index: 1,
      projectId: projectId,
    },
  });
  const scene = await prisma.scene.create({
    data: {
      episodeId: episode.id,
      title: 'Sc1',
      index: 1,
      projectId: projectId,
    },
  });

  // Create 3 Shots
  const shotIds = [];
  const frameKeys: string[] = [];

  for (let i = 1; i <= 3; i++) {
    const shotId = `shot-${i}-${Date.now()}`;
    shotIds.push(shotId);
    await prisma.shot.create({
      data: {
        id: shotId,
        sceneId: scene.id,
        index: i,
        organizationId: org.id,
        type: 'SHOT',
        enrichedPrompt: `Frame ${i} prompt`,
      },
    });

    // Trigger SHOT_RENDER (S4-3 Path)
    // ShotJob requires relations
    await prisma.shotJob.create({
      data: {
        project: { connect: { id: projectId } },
        organization: { connect: { id: org.id } },
        episode: { connect: { id: episode.id } },
        scene: { connect: { id: scene.id } },
        shot: { connect: { id: shotId } },
        type: 'SHOT_RENDER',
        status: 'PENDING',
        payload: { pipelineRunId, traceId: `shot-${i}` },
      },
    });
  }

  console.log(`Submitted 3 SHOT_RENDER jobs. Waiting...`);

  // Poll for 3 Assets
  let assetCount = 0;
  let attempts = 0;
  while (attempts++ < 30) {
    const assets = await prisma.asset.findMany({
      where: {
        projectId,
        ownerType: AssetOwnerType.SHOT,
        type: AssetType.IMAGE,
      },
    });
    assetCount = assets.length;
    if (assetCount === 3) {
      assets.forEach((a) => frameKeys.push(a.storageKey));
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (assetCount !== 3) {
    console.error(`❌ Failed to render all shots. Found ${assetCount}`);
    process.exit(1);
  }
  console.log(`✅ 3 Frames Generated: ${frameKeys.length}`);

  // 2. Trigger VIDEO_RENDER (Synthesis)
  console.log(`Triggering VIDEO_RENDER with ${frameKeys.length} frames...`);

  const videoJob = await prisma.shotJob.create({
    data: {
      project: { connect: { id: projectId } },
      organization: { connect: { id: org.id } },
      episode: { connect: { id: episode.id } },
      scene: { connect: { id: scene.id } },
      // Schema requires 'shot', so we link to the first one
      shot: { connect: { id: shotIds[0] } },
      type: 'VIDEO_RENDER',
      status: 'PENDING',
      payload: {
        projectId,
        episodeId: episode.id,
        pipelineRunId,
        traceId: 'video-s4-4',
        frames: frameKeys, // Pass storage keys
      },
    },
  });

  // 3. Poll for Success
  let videoJobSuccess = false;
  attempts = 0;
  while (attempts++ < 30) {
    const job = await prisma.shotJob.findUnique({ where: { id: videoJob.id } });
    if (job?.status === 'SUCCEEDED') {
      videoJobSuccess = true;
      break;
    }
    if (job?.status === 'FAILED') {
      console.error(`❌ VIDEO_RENDER Failed`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!videoJobSuccess) {
    console.error(`❌ Timeout waiting for VIDEO_RENDER`);
    process.exit(1);
  }
  console.log(`✅ VIDEO_RENDER Succeeded`);

  // 4. Verify Video Asset
  const videoAsset = await prisma.asset.findFirst({
    where: {
      projectId,
      ownerType: AssetOwnerType.SHOT, // Updated to SHOT per schema constraint
      ownerId: shotIds[0], // We linked to first shot
      type: AssetType.VIDEO,
    },
  });

  if (!videoAsset) {
    console.error('❌ Video Asset record not found');
    process.exit(1);
  }
  console.log(`✅ Video Asset Persisted: ${videoAsset.id} Key=${videoAsset.storageKey}`);

  // Verify File
  const absPath = path.resolve(process.cwd(), '.runtime', videoAsset.storageKey);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Video File not found at ${absPath}`);
    process.exit(1);
  }
  const stats = fs.statSync(absPath);
  console.log(`✅ Video File confirmed size=${stats.size}b`);

  // 5. Cleanup
  console.log('🧹 Cleanup...');
  const safeDelete = async (label: string, task: () => Promise<any>) => {
    try {
      await task();
    } catch (e: any) {
      // Ignore P2025 (Record not found)
      if (e.code !== 'P2025')
        console.warn(`   ⚠️ Failed to delete ${label}: ${e.message?.split('\n')[0]}`);
    }
  };

  // Robust Cleanup Order to avoid FK violations
  await safeDelete('AuditLogs', () => prisma.auditLog.deleteMany({ where: { orgId: org.id } }));
  await safeDelete('Assets', () => prisma.asset.deleteMany({ where: { projectId } }));
  await safeDelete('Jobs', () => prisma.shotJob.deleteMany({ where: { projectId } }));
  await safeDelete('Tasks', () => prisma.task.deleteMany({ where: { projectId } }));

  // Fetch Shot IDs for dependent deletion (QualityScore, SafetyResult, etc. do not cascade)
  const projectShots = await prisma.shot.findMany({
    where: { scene: { projectId } },
    select: { id: true },
  });
  const pShotIds = projectShots.map((s) => s.id);

  if (pShotIds.length > 0) {
    await safeDelete('QualityScores', () =>
      prisma.qualityScore.deleteMany({ where: { shotId: { in: pShotIds } } })
    );
    await safeDelete('SafetyResults', () =>
      prisma.safetyResult.deleteMany({ where: { shotId: { in: pShotIds } } })
    );
    await safeDelete('PublishingReviews', () =>
      prisma.publishingReview.deleteMany({ where: { shotId: { in: pShotIds } } })
    );
  }

  // Hierarchy (Leaf to Root)
  // Shot doesn't have projectId, so we delete Scenes (Cascades to Shots)
  // But to be safe and explicit based on user request:
  await safeDelete('Shots', () => prisma.shot.deleteMany({ where: { scene: { projectId } } }));

  await safeDelete('Scenes', () => prisma.scene.deleteMany({ where: { projectId } }));

  // Project dependents (No Cascade)
  await safeDelete('BillingEvents', () => prisma.billingEvent.deleteMany({ where: { projectId } }));
  await safeDelete('CostLedgers', () => prisma.costLedger.deleteMany({ where: { projectId } }));
  await safeDelete('ProjectMembers', () =>
    prisma.projectMember.deleteMany({ where: { projectId } })
  );
  await safeDelete('StructureQualityReports', () =>
    prisma.structureQualityReport.deleteMany({ where: { projectId } })
  );

  await safeDelete('Episodes', () => prisma.episode.deleteMany({ where: { projectId } }));
  await safeDelete('Seasons', () => prisma.season.deleteMany({ where: { projectId } }));
  await safeDelete('Project', () => prisma.project.delete({ where: { id: projectId } }));

  await safeDelete('Org', () => prisma.organization.delete({ where: { id: org.id } }));
  await safeDelete('User', () => prisma.user.delete({ where: { id: user.id } }));

  console.log('VERIFICATION SUCCESS: S4-4 Video Synthesis');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
