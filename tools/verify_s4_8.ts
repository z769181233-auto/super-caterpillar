import { PrismaClient, JobStatus, JobType, AssetOwnerType, AssetType } from 'database';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient({});

async function main() {
  console.log('🚀 Starting S4-8 Verification (Transitions, BGM & Timecode)...');

  const runId = `run-s48-${Date.now()}`;
  const projectId = `proj-s48-${Date.now()}`;
  const episodeId = uuidv4();
  const sceneId = uuidv4();
  const shotIds = [uuidv4(), uuidv4(), uuidv4()]; // 3 shots for xfade test

  try {
    // 1. Setup Data Hierarchy
    const user = await prisma.user.findFirstOrThrow();
    const org = await prisma.organization.findFirstOrThrow({ where: { ownerId: user.id } });

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

    // Seed Shots: Shot 2 and 3 have xfade transitions
    for (let i = 0; i < shotIds.length; i++) {
      await prisma.shot.create({
        data: {
          id: shotIds[i],
          sceneId,
          index: i + 1,
          type: 'SHOT',
          durationSeconds: 2, // 48 frames
          params: {
            transition: i === 0 ? 'none' : 'xfade',
            transitionSec: 0.5, // 12 frames
          },
        },
      });
    }
    console.log('✅ Data Fixtures Created (Shot 2 & 3 set to xfade, duration=2s)');

    // 2. Generate Frames & Mock BGM
    const runtimeDir = path.resolve(process.cwd(), '.runtime');

    // Generate BGM
    const bgmRelativePath = `bgm_s48_${Date.now()}.aac`;
    const bgmPath = path.join(runtimeDir, bgmRelativePath);
    console.log('Generating Mock BGM...');
    spawnSync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=10',
      '-ac',
      '2',
      '-c:a',
      'aac',
      '-y',
      bgmPath,
    ]);

    for (const shotId of shotIds) {
      const frameDir = path.join(runtimeDir, 'frames', shotId);
      if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

      const framesTxtPath = path.join(frameDir, 'frames.txt');
      const framesContent: string[] = [];

      for (let i = 0; i < 48; i++) {
        const fpath = path.join(frameDir, `f_${i}.png`);
        spawnSync('ffmpeg', [
          '-f',
          'lavfi',
          '-i',
          `color=c=${i % 2 === 0 ? 'green' : 'black'}:s=1280x720`,
          '-frames:v',
          '1',
          '-y',
          fpath,
        ]);
        framesContent.push(`file '${fpath}'`);
      }
      fs.writeFileSync(framesTxtPath, framesContent.join('\n'));
    }
    console.log('✅ Frames & Mock BGM Generated');

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
    let timelinePath = composeResult.timelineStorageKey;

    // INJECT BGM into timeline.json for this test
    const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    timeline.audio = {
      bgmStorageKey: bgmRelativePath,
      mode: 'loop',
    };
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
    console.log('✅ Timeline Composed & BGM Injected');

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

    // 5. Verify Output and S4-8 Constraints
    const absVideoPath = path.resolve(runtimeDir, videoKey);
    const ffprobe = spawnSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_name,pix_fmt,r_frame_rate,channels',
      '-of',
      'json',
      absVideoPath,
    ]);
    const probeData = JSON.parse(ffprobe.stdout.toString());

    // Duration: 2s + 2s + 2s - 0.5s - 0.5s = 5s
    const duration = parseFloat(probeData.format.duration);
    console.log(`Video Duration: ${duration}s`);
    if (Math.abs(duration - 5.0) > 0.1)
      throw new Error(`Duration Mismatch! Expected ~5.0s, found ${duration}s`);

    const vStream = probeData.streams.find((s: any) => s.codec_name === 'h264');
    if (!vStream) throw new Error('Video Stream Missing or not H264');

    const aStream = probeData.streams.find((s: any) => s.codec_name === 'aac');
    if (!aStream) throw new Error('Audio Stream Missing or not AAC');

    console.log('✅ Final Video (Advanced Path) verified: Duration, H264, AAC');

    // Asset Binding & CE09 Trigger
    console.log(`Checking Asset for shot: ${shotIds[0]}, Key: ${videoKey}`);
    const allAssets = await prisma.asset.findMany({ where: { ownerId: shotIds[0] } });
    console.log(
      `Found ${allAssets.length} assets for this shot:`,
      allAssets.map((a) => a.storageKey)
    );

    const asset = await prisma.asset.findFirst({
      where: { ownerId: shotIds[0], type: AssetType.VIDEO, storageKey: videoKey },
    });
    if (!asset) throw new Error('Asset not bound to FIRST shotId');

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
