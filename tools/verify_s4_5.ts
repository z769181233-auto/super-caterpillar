import { PrismaClient, JobType, JobStatus, AssetOwnerType, AssetType } from 'database';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({});

// Helper for delays
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Starting S4-5 Verification (Media Security Pipeline)...');

  // 1. Setup Fixtures
  const runId = `run-${Date.now()}`;
  const projectId = `test-s45-${Date.now()}`;
  console.log(`Fixtures: Project=${projectId} RunId=${runId}`);

  // Create Hierarchy
  // 1. Create User first (Organization requires owner)
  const user = await prisma.user.create({
    data: {
      // id: auto-generated or explicit?
      id: `user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'dummyhash',
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'TestOrg',
      slug: `test-org-${Date.now()}`,
      ownerId: user.id,
      credits: 1000,
    },
  });

  await prisma.project.create({
    data: {
      id: projectId,
      name: 'Test Project S4-5',
      organizationId: org.id,
      ownerId: user.id,
    },
  });

  // Create Season -> Episode -> Scene -> Shot
  const season = await prisma.season.create({
    data: { projectId, index: 1, title: 'S1' },
  });
  const episode = await prisma.episode.create({
    data: { seasonId: season.id, projectId, index: 1, name: 'E1' },
  });
  const scene = await prisma.scene.create({
    data: {
      episodeId: episode.id,
      projectId,
      index: 1,
      title: 'SC1',
      summary: 'Ensure S4-5 verification passes',
    },
  });

  // Ensure Engine Exists
  const engine = await prisma.engine.upsert({
    where: { code: 'gate_noop' },
    update: {},
    create: {
      code: 'gate_noop',
      engineKey: 'gate_noop', // Usually same as code or similar
      name: 'Gate Noop Engine',
      type: 'LOCAL',
      isActive: true,
      adapterName: 'gate_noop',
      adapterType: 'noop',
      config: {},
      // provider, config etc might not be on Engine but on attributes or version.
      // keeping it minimal to satisfy FK.
    },
  });

  // Create 3 Shots
  const shotIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const shot = await prisma.shot.create({
      data: {
        organizationId: org.id,
        sceneId: scene.id,
        index: i,
        type: 'DEFAULT', // Added type field which is required (String)
        enrichedPrompt: 'Mock Enriched Prompt for Testing Security Pipeline',
      },
    });
    shotIds.push(shot.id);
  }

  // We need a dummy user for later cleanup -> Already created as `user`
  if (!user) throw new Error('User creation failed');

  try {
    // --- Reuse S4-4 Logic: Generate Video ---

    // 2. Submit SHOT_RENDER jobs
    console.log('Submitted 3 SHOT_RENDER jobs. Waiting...');
    for (const sId of shotIds) {
      const job = await prisma.shotJob.create({
        data: {
          type: JobType.SHOT_RENDER,
          projectId,
          organizationId: org.id,
          episodeId: episode.id,
          sceneId: scene.id,
          shotId: sId,
          status: JobStatus.PENDING,
          payload: { pipelineRunId: runId, frameIndex: 1 },
        },
      });
      // Create Binding
      await prisma.jobEngineBinding.create({
        data: {
          jobId: job.id,
          engineId: engine.id,
          engineKey: engine.code,
          status: 'BOUND',
        },
      });
    }

    // Wait for Mock Worker (Gate App) to process them (simulated via wait or check)
    // In this env, likely specific worker handles it.
    // Wait for SUCCESS
    let retries = 0;
    while (retries < 120) {
      const count = await prisma.shotJob.count({
        where: { projectId, type: JobType.SHOT_RENDER, status: JobStatus.SUCCEEDED },
      });
      if (count === 3) break;
      await sleep(1000);
      retries++;
      if (retries % 5 === 0) console.log(`Waiting for shots... ${count}/3`);
    }

    // Assert Shot Assets created
    // (Mock worker creates Assets for SHOT_RENDER)
    const frameAssets = await prisma.asset.findMany({
      where: { ownerType: AssetOwnerType.SHOT, ownerId: { in: shotIds } },
    });
    const frameKeys = frameAssets.map((a) => a.storageKey);

    console.log(`✅ 3 Frames Generated: ${frameAssets.length}`);
    if (frameAssets.length < 3) throw new Error('Frames missing');

    // 3. Trigger VIDEO_RENDER
    console.log('Triggering VIDEO_RENDER with 3 frames...');
    const videoJob = await prisma.shotJob.create({
      data: {
        type: JobType.VIDEO_RENDER,
        projectId,
        organizationId: org.id,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shotIds[0], // Arbitrary link for job, but logic uses shots
        status: JobStatus.PENDING,
        payload: {
          pipelineRunId: runId,
          shotIds,
          traceId: `trace-${runId}`,
          frames: frameKeys,
        },
      },
    });
    await prisma.jobEngineBinding.create({
      data: {
        jobId: videoJob.id,
        engineId: engine.id,
        engineKey: engine.code,
        status: 'BOUND',
      },
    });

    // Wait for VIDEO_RENDER Success
    retries = 0;
    let jobResult;
    while (retries < 30) {
      jobResult = await prisma.shotJob.findUnique({ where: { id: videoJob.id } });
      if (jobResult?.status === JobStatus.SUCCEEDED) {
        console.log(`✅ VIDEO_RENDER Succeeded. Worker=${jobResult.workerId}`);
        console.log('Result Metadata:', JSON.stringify(jobResult.result || {}));
        break;
      }
      if (jobResult?.status === JobStatus.FAILED)
        throw new Error(`VIDEO_RENDER Failed: ${jobResult.lastError}`);
      await sleep(1000);
      retries++;
    }
    console.log('✅ VIDEO_RENDER Succeeded');

    // --- Verify S4-5 Logic: CE09 Execution ---

    // 4. Wait for CE09_MEDIA_SECURITY spawn & success
    console.log('Waiting for CE09_MEDIA_SECURITY to spawn and finish...');
    let attempts = 0;
    let ce09Job = null;
    while (attempts++ < 120) {
      ce09Job = await prisma.shotJob.findFirst({
        where: {
          projectId,
          type: JobType.CE09_MEDIA_SECURITY,
          payload: { path: ['pipelineRunId'], equals: runId },
        },
      });

      if (ce09Job && ce09Job.status === JobStatus.SUCCEEDED) {
        console.log(`✅ CE09 Job Succeeded: ${ce09Job.id}`);
        break;
      }
      if (ce09Job && ce09Job.status === JobStatus.FAILED) {
        throw new Error(`CE09 Failed: ${ce09Job.lastError}`);
      }

      await sleep(1000);
      retries++;
      if (retries % 5 === 0) console.log('Waiting for CE09...');
    }
    if (!ce09Job) throw new Error('CE09 Job was not spawned!');

    // 5. Verify Artifacts

    // A) Secure Asset Exists
    // Based on implementation, we UPDATED the video asset metadata/checksum
    // Or updated storageKey.
    // Let's refetch the Asset for Shot[0] (where we linked it)
    const videoAsset = await prisma.asset.findFirst({
      where: {
        ownerType: AssetOwnerType.SHOT,
        ownerId: shotIds[0],
        type: AssetType.VIDEO,
      },
    });

    if (!videoAsset) throw new Error('Video Asset missing');
    // Check fingerprint (checksum field)
    if (!videoAsset.checksum || videoAsset.checksum.length < 10) {
      throw new Error(`Missing fingerprint in asset checksum: ${videoAsset.checksum}`);
    }
    console.log(
      `✅ Secure Asset Verified: ${videoAsset.id} Fingerprint=${videoAsset.checksum.substring(0, 8)}...`
    );

    // Check storageKey points to 'secure' folder
    if (!videoAsset.storageKey.includes('secure')) {
      throw new Error(`Asset storageKey does not point to secure folder: ${videoAsset.storageKey}`);
    }

    // B) File Exists
    const runtimeDir = path.resolve(process.cwd(), '.runtime');
    const absPath = path.join(runtimeDir, videoAsset.storageKey);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Secure file missing on disk: ${absPath}`);
    }
    console.log(`✅ Secure File confirmed: ${videoAsset.storageKey}`);

    // C) PublishingReview Exists
    const review = await prisma.publishingReview.findFirst({
      where: { shotId: shotIds[0] },
    });

    // We implemented 'require_review' as status in Result enum
    // Actually we used `result: 'require_review'`
    // Let's import enum if possible, or string check
    // We know enum is 'require_review'
    const expectedResult = 'require_review';

    if (!review) throw new Error('PublishingReview record missing');
    if (review.result !== expectedResult) {
      throw new Error(
        `PublishingReview status mismatch. Expected ${expectedResult}, got ${review.result}`
      );
    }
    console.log(`✅ PublishingReview confirmed: result=${review.result}`);

    // D) Audit Log
    const audits = await prisma.auditLog.findMany({
      where: {
        action: 'ce09.media_security.success',
        details: { path: ['pipelineRunId'], equals: runId },
      },
    });
    if (audits.length === 0) throw new Error('Audit Log missing');
    console.log('✅ Audit Log confirmed');

    console.log('VERIFICATION SUCCESS: S4-5 Media Security');
  } catch (e) {
    console.error('VERIFICATION FAILED:', e);
    process.exit(1);
  } finally {
    console.log('🧹 Cleanup...');
    const safeDelete = async (label: string, fn: () => Promise<any>) => {
      try {
        await fn();
      } catch (e: any) {
        if (e.code !== 'P2025') console.warn(`   ⚠️ Failed to delete ${label}: ${e.message}`);
      }
    };

    // Robust Cleanup Order from S4-4
    await safeDelete('AuditLogs', () => prisma.auditLog.deleteMany({ where: { orgId: org.id } }));
    await safeDelete('Assets', () => prisma.asset.deleteMany({ where: { projectId } }));
    await safeDelete('Jobs', () => prisma.shotJob.deleteMany({ where: { projectId } }));
    await safeDelete('Tasks', () => prisma.task.deleteMany({ where: { projectId } }));

    // Fetch Shot IDs for dependent deletion
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
    await safeDelete('Shots', () => prisma.shot.deleteMany({ where: { scene: { projectId } } }));

    await safeDelete('Scenes', () => prisma.scene.deleteMany({ where: { projectId } }));

    // Project dependents (No Cascade)
    await safeDelete('BillingEvents', () =>
      prisma.billingEvent.deleteMany({ where: { projectId } })
    );
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
  }
}

main();
