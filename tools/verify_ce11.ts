import { PrismaClient, JobStatus, JobType, AssetOwnerType, AssetType } from 'database';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const orgId = 'org_s4_11';
  const projectId = 'proj_s4_11';
  const episodeId = 'ep_s4_11';
  const sceneId = 'scene_s4_11';
  const shotIds = ['shot_s4_11_1', 'shot_s4_11_2'];

  console.log('--- CE11 Verification: Timeline Preview & CE09 Unified ---');

  // Cleanup
  await prisma.jobEngineBinding.deleteMany({ where: { job: { projectId } } });
  await prisma.shotJob.deleteMany({ where: { projectId } });
  await prisma.asset.deleteMany({ where: { projectId } });
  await prisma.shot.deleteMany({ where: { sceneId } });
  await prisma.scene.deleteMany({ where: { id: sceneId } });

  // Setup DB
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: 'Org S4-11',
      owner: {
        create: {
          email: `test_ce11_${Date.now()}@example.com`,
          passwordHash: 'hash',
          userType: 'individual',
          role: 'admin',
        },
      },
    },
  });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });

  await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      name: 'Proj S4-11',
      organizationId: orgId,
      status: 'in_progress',
      ownerId: org!.ownerId,
    },
  });

  // Create Worker API Key
  await prisma.apiKey.upsert({
    where: { key: 'ak_worker_dev_0000000000000000' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'worker-key-id',
      key: 'ak_worker_dev_0000000000000000',
      secretHash: 'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678',
      name: 'Worker Dev Key',
      ownerOrgId: orgId,
      status: 'ACTIVE',
      ownerUserId: org!.ownerId,
    },
  });

  const season = await prisma.season.upsert({
    where: { projectId_index: { projectId, index: 1 } },
    update: {},
    create: {
      projectId,
      index: 1,
      title: 'Season 1',
    },
  });

  await prisma.episode.upsert({
    where: { id: episodeId },
    update: {},
    create: {
      id: episodeId,
      seasonId: season.id,
      projectId,
      name: 'Ep S4-11',
      index: 1,
    },
  });

  await prisma.scene.upsert({
    where: { id: sceneId },
    update: {},
    create: {
      id: sceneId,
      episodeId,
      index: 1,
      title: 'Scene 1',
    },
  });

  for (let i = 0; i < shotIds.length; i++) {
    await prisma.shot.upsert({
      where: { id: shotIds[i] },
      update: { sceneId, organizationId: orgId },
      create: {
        id: shotIds[i],
        sceneId,
        index: i + 1,
        type: 'norm',
        durationSeconds: 2,
        organizationId: orgId,
      },
    });
  }

  // 1. Submit TIMELINE_PREVIEW Job
  const timelineData = {
    version: '1.0',
    fps: 24,
    width: 640,
    height: 360,
    totalDurationFrames: 96,
    organizationId: orgId,
    projectId: projectId,
    episodeId: episodeId,
    sceneId: sceneId,
    shots: shotIds.map((id) => ({
      shotId: id,
      durationFrames: 48,
      framesTxtStorageKey: `frames/${id}/frames.txt`,
      transition: 'none',
    })),
    audio: {
      tracks: [],
    },
  };

  // Create dummy assets for the shots
  const dummyImageKey = 'dummy/1px.png';
  const dummyImageAbs = path.resolve(process.cwd(), '.runtime', dummyImageKey);
  if (!fs.existsSync(path.dirname(dummyImageAbs)))
    fs.mkdirSync(path.dirname(dummyImageAbs), { recursive: true });
  // Minimal 1x1 black PNG
  const onePixelPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108000000003a7e920b0000000a4944415408d76360000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(dummyImageAbs, onePixelPng);

  for (const id of shotIds) {
    const framesTxtKey = `frames/${id}/frames.txt`;
    const framesTxtAbs = path.resolve(process.cwd(), '.runtime', framesTxtKey);
    if (!fs.existsSync(path.dirname(framesTxtAbs)))
      fs.mkdirSync(path.dirname(framesTxtAbs), { recursive: true });
    // Create a frames.txt with 48 lines pointing to the dummy image
    const content = Array(48).fill(`file '${dummyImageAbs}'\nduration 0.041666`).join('\n');
    fs.writeFileSync(framesTxtAbs, content);
  }

  const timelineKey = `timelines/${projectId}/${sceneId}_preview.json`;
  const timelineAbsPath = path.resolve(process.cwd(), '.runtime', timelineKey);
  if (!fs.existsSync(path.dirname(timelineAbsPath)))
    fs.mkdirSync(path.dirname(timelineAbsPath), { recursive: true });
  fs.writeFileSync(timelineAbsPath, JSON.stringify(timelineData));

  console.log('Submitting Timeline Preview Job...');
  const previewJob = await prisma.shotJob.create({
    data: {
      type: 'TIMELINE_PREVIEW' as JobType,
      organizationId: orgId,
      projectId,
      episodeId,
      sceneId,
      shotId: shotIds[0],
      status: 'PENDING',
      payload: {
        timelineStorageKey: timelineKey,
        pipelineRunId: 'verify_ce11_run',
      },
    },
  });

  const previewResult = await waitForJob(previewJob.id);
  console.log('✅ Preview Job Succeeded:', previewResult.id);

  // 2. Verify Asset Isolation (SCENE Owner)
  const sceneAsset = await prisma.asset.findUnique({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SCENE,
        ownerId: sceneId,
        type: AssetType.VIDEO,
      },
    },
  });

  if (!sceneAsset) throw new Error('Preview Asset (Scene Owner) not found!');
  console.log('✅ Asset Isolation Verified: OwnerType=SCENE, OwnerId=' + sceneAsset.ownerId);

  // 3. Verify CE09 Trigger
  let ce09Job;
  for (let i = 0; i < 20; i++) {
    const jobs = await prisma.shotJob.findMany({
      where: { type: JobType.CE09_MEDIA_SECURITY, projectId },
    });
    ce09Job = jobs.find((j) => (j.payload as any).assetId === sceneAsset.id);
    if (ce09Job) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!ce09Job) throw new Error('CE09 Job not triggered for Preview Asset');
  console.log('✅ CE09 Job Triggered:', ce09Job.id);

  await waitForJob(ce09Job.id);
  console.log('✅ CE09 Job Succeeded');

  // 4. Verify Secured Asset
  const securedAsset = await prisma.asset.findUnique({ where: { id: sceneAsset.id } });
  if (!securedAsset?.storageKey.includes('secure/'))
    throw new Error('Asset storageKey not updated to secure path');
  console.log('✅ Security Link Verified: ' + securedAsset.storageKey);

  // 5. Regression Test: Legacy SHOT Asset
  console.log('Running Regression Test for Legacy SHOT Asset...');
  // Create a dummy shot asset first
  const legacyShotId = shotIds[0];
  const legacyAssetKey = `temp_mp4s/verify_ce11_regression/shot_${legacyShotId}.mp4`;
  const legacyAssetAbs = path.resolve(process.cwd(), '.runtime', legacyAssetKey);
  if (!fs.existsSync(path.dirname(legacyAssetAbs)))
    fs.mkdirSync(path.dirname(legacyAssetAbs), { recursive: true });
  // Just copy the onePixelPng to act as a placeholder MP4 (CE09 dummy won't check it)
  fs.writeFileSync(legacyAssetAbs, onePixelPng);

  const shotAsset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SHOT,
        ownerId: legacyShotId,
        type: AssetType.VIDEO,
      },
    },
    create: {
      projectId,
      ownerId: legacyShotId,
      ownerType: AssetOwnerType.SHOT,
      type: AssetType.VIDEO,
      storageKey: legacyAssetKey,
      status: 'GENERATED',
    },
    update: {
      storageKey: legacyAssetKey,
      status: 'GENERATED',
    },
  });

  const legacyCe09Job = await prisma.shotJob.create({
    data: {
      type: JobType.CE09_MEDIA_SECURITY,
      organizationId: orgId,
      projectId,
      episodeId,
      sceneId,
      shotId: legacyShotId,
      status: 'PENDING',
      payload: {
        videoAssetStorageKey: legacyAssetKey,
        pipelineRunId: 'verify_ce11_regression',
        traceId: 'reg_trace',
        shotId: legacyShotId,
        projectId,
      },
    },
  });

  await waitForJob(legacyCe09Job.id);
  const securedShotAsset = await prisma.asset.findUnique({ where: { id: shotAsset.id } });
  if (!securedShotAsset?.storageKey.includes('secure/'))
    throw new Error('Legacy Shot Asset not secured');
  console.log('✅ Regression Test Passed: Legacy Shot Asset secured.');
}

async function waitForJob(jobId: string) {
  process.stdout.write(`Waiting for job ${jobId}`);
  for (let i = 0; i < 60; i++) {
    const job = await prisma.shotJob.findUnique({ where: { id: jobId } });
    process.stdout.write('.');
    if (job?.status === 'SUCCEEDED') {
      console.log(' DONE');
      return job;
    }
    if (job?.status === 'FAILED') {
      console.log(' FAILED');
      throw new Error(`Job Failed: ${JSON.stringify(job.lastError)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(' TIMEOUT');
  throw new Error('Timeout waiting for job');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
