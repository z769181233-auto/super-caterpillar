import { PrismaClient, JobStatus, JobType, AssetOwnerType, AssetType } from 'database';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting S4-7 Verification (Multi-Shot Timeline Render)...');

  const runId = `run-s47-${Date.now()}`;
  const projectId = `proj-s47-${Date.now()}`;
  const episodeId = uuidv4();
  const sceneId = uuidv4();
  const shotIds = [uuidv4(), uuidv4()];

  try {
    // 1. Setup Data Hierarchy
    const user = await prisma.user.findFirstOrThrow();
    const org = await prisma.organization.findFirstOrThrow({ where: { ownerId: user.id } });

    // Ensure API Key exists for Worker
    await prisma.apiKey.upsert({
      where: { id: '558d1b0c-e6fe-4d50-b097-058af8eb9599' },
      update: {},
      create: {
        id: '558d1b0c-e6fe-4d50-b097-058af8eb9599',
        key: 'test-key',
        secretHash: 'test-secret',
        name: 'Test Worker Key',
        status: 'ACTIVE',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        name: projectId,
        ownerId: user.id,
        organizationId: org.id,
      },
    });

    await prisma.episode.create({
      data: {
        id: episodeId,
        project: { connect: { id: projectId } },
        name: 'Ep 1',
        index: 1,
        season: {
          create: {
            projectId,
            index: 1,
            title: 'Season 1',
          },
        },
      },
    });

    await prisma.scene.create({
      data: {
        id: sceneId,
        episodeId,
        index: 1,
        title: 'Scene 1',
      },
    });

    for (let i = 0; i < shotIds.length; i++) {
      await prisma.shot.create({
        data: {
          id: shotIds[i],
          sceneId,
          index: i + 1,
          type: 'SHOT',
          durationSeconds: 1,
          params: { transition: 'none' },
        },
      });
    }
    console.log('✅ Data Fixtures Created');

    // 2. Generate Frames for Each Shot
    const runtimeDir = path.resolve(process.cwd(), '.runtime');
    for (const shotId of shotIds) {
      const frameDir = path.join(runtimeDir, 'frames', shotId);
      if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

      const framesTxtPath = path.join(frameDir, 'frames.txt');
      const framesContent: string[] = [];

      for (let i = 0; i < 12; i++) {
        // 0.5s at 24fps
        const fpath = path.join(frameDir, `f_${i}.png`);
        spawnSync('ffmpeg', [
          '-f',
          'lavfi',
          '-i',
          `color=c=${i % 2 === 0 ? 'red' : 'blue'}:s=1280x720`,
          '-frames:v',
          '1',
          '-y',
          fpath,
        ]);
        framesContent.push(`file '${fpath}'`);
      }
      fs.writeFileSync(framesTxtPath, framesContent.join('\n'));
    }
    console.log('✅ Frames & frames.txt generated for shots');

    // 3. Submit PIPELINE_TIMELINE_COMPOSE
    const composeJobId = uuidv4();
    await prisma.shotJob.create({
      data: {
        id: composeJobId,
        type: 'PIPELINE_TIMELINE_COMPOSE' as any,
        projectId,
        organizationId: org.id,
        episodeId,
        sceneId,
        shotId: shotIds[0],
        payload: { sceneId, pipelineRunId: runId },
        status: 'PENDING',
      },
    });
    await bindEngine(composeJobId, 'pipeline_orchestrator');

    console.log(`Submitted Compose Job ${composeJobId}. Waiting...`);
    const composeResult = await waitForJob(composeJobId);
    const timelinePath = composeResult.timelineStorageKey;
    if (!fs.existsSync(timelinePath)) throw new Error('timeline.json not found');
    console.log('✅ Timeline Composed');

    // 4. Submit TIMELINE_RENDER
    const renderJobId = uuidv4();
    await prisma.shotJob.create({
      data: {
        id: renderJobId,
        type: 'TIMELINE_RENDER' as any,
        projectId,
        organizationId: org.id,
        episodeId,
        sceneId,
        shotId: shotIds[0],
        payload: { timelineStorageKey: timelinePath, pipelineRunId: runId },
        status: 'PENDING',
      },
    });
    await bindEngine(renderJobId, 'pipeline_orchestrator');

    console.log(`Submitted Render Job ${renderJobId}. Waiting...`);
    const renderResult = await waitForJob(renderJobId);
    const videoKey = renderResult.storageKey;
    console.log(`✅ TIMELINE_RENDER Succeeded. StorageKey: ${videoKey}`);

    // 5. Verify Output and Constraints
    const absVideoPath = path.resolve(runtimeDir, videoKey);
    if (!fs.existsSync(absVideoPath)) throw new Error('Final Video Missing');

    const ffprobe = spawnSync('ffmpeg', ['-i', absVideoPath]);
    const stderr = ffprobe.stderr.toString();
    if (!stderr.includes('Duration: 00:00:01.00'))
      console.warn('Duration might mismatch, expected ~1s (24 frames total)');
    if (!stderr.includes('Video: h264')) throw new Error('Final Video not H.264');
    console.log('✅ Final Video encoding verified');

    // Asset Binding (First Shot)
    const asset = await prisma.asset.findFirst({
      where: { ownerId: shotIds[0], type: AssetType.VIDEO, storageKey: videoKey },
    });
    if (!asset) throw new Error('Asset not bound to FIRST shotId');
    console.log('✅ Asset FIRST-SHOT binding verified');

    // CE09 Downstream Trigger
    const ce09Jobs = await prisma.shotJob.findMany({
      where: { sceneId, type: 'CE09_MEDIA_SECURITY' as any },
    });
    if (ce09Jobs.length !== 1) throw new Error(`CE09 expected 1 trigger, found ${ce09Jobs.length}`);
    console.log('✅ CE09 Downstream Trigger verified');
  } catch (e) {
    console.error('❌ VERIFICATION FAILED:', e);
    process.exit(1);
  } finally {
    console.log('Cleaning up project records...');
    await prisma.asset.deleteMany({ where: { projectId } });
    await prisma.shotJob.deleteMany({ where: { projectId } });
    await prisma.shot.deleteMany({ where: { scene: { episode: { projectId } } } });
    await prisma.scene.deleteMany({ where: { episode: { projectId } } });
    await prisma.episode.deleteMany({ where: { projectId } });
    await prisma.season.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    console.log('✅ Cleanup Finished');
  }
}

async function waitForJob(jobId: string) {
  for (let i = 0; i < 60; i++) {
    const job = await prisma.shotJob.findUnique({ where: { id: jobId } });
    if (job?.status === 'SUCCEEDED') return job.result as any;
    if (job?.status === 'FAILED') throw new Error(`Job Failed: ${job.lastError}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timeout waiting for job');
}

async function bindEngine(jobId: string, engineKey: string) {
  const engine = await prisma.engine.findFirstOrThrow({ where: { engineKey } });
  await prisma.jobEngineBinding.upsert({
    where: { jobId },
    update: {},
    create: {
      jobId,
      engineId: engine.id,
      engineKey,
      status: 'BOUND',
    },
  });
}

main();
