import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient({});

async function test() {
  console.log('--- FINAL STRUCTURAL PARALLEL INJECTION L2 SEAL ---');
  const organizationId = 'gate-org';
  const ownerId = 'gate-user';

  // 0. Ensure Identity Structure
  await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      email: 'gate@scu.local',
      userType: 'admin',
      passwordHash: 'HASH',
    } as any,
  });
  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: { id: organizationId, name: 'Gate Org', ownerId } as any,
  });

  // 1. Create Valid Hierarchy
  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      name: 'L2 Final Structural',
      organizationId,
      ownerId,
      status: 'in_progress',
    } as any,
  });
  const season = await prisma.season.create({
    data: { projectId: project.id, index: 1, title: 'S1' } as any,
  });
  const episode = await prisma.episode.create({
    data: { seasonId: season.id, projectId: project.id, index: 1, name: 'E1' } as any,
  });
  const scene = await prisma.scene.create({
    data: { episodeId: episode.id, projectId: project.id, sceneIndex: 1, title: 'Scene 1' } as any,
  });
  const shot = await prisma.shot.create({
    data: { sceneId: scene.id, index: 1, title: 'Shot 1', type: 'ce_core', organizationId } as any,
  });

  const pipelineRunId = `run_${randomUUID()}`;

  // 2. Parallel Injection
  const jobsConfig = [
    { type: 'SHOT_RENDER', engineId: 'engine-shot', engineKey: 'default_shot_render' },
    { type: 'AUDIO', engineId: 'engine-audio', engineKey: 'audio_engine' },
  ];

  const jobIds: string[] = [];
  for (const j of jobsConfig) {
    const job = await prisma.shotJob.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        organizationId,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,
        type: j.type as any,
        status: 'PENDING',
        priority: 0,
        payload: { pipelineRunId, isVerification: true },
      },
    });
    await prisma.jobEngineBinding.create({
      data: {
        jobId: job.id,
        engineId: j.engineId,
        engineKey: j.engineKey,
        status: 'BOUND',
        priority: 0,
      } as any,
    });
    jobIds.push(job.id);
    console.log(`[Created] ${j.type} -> ${job.id}`);
  }

  // 3. Poll Completion
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const results = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
    if (results.every((j) => j.status === 'SUCCEEDED')) {
      console.log('\n✅ DUAL TRACKS COMPLETED SUCCESSFULLY.');
      break;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }

  const finalResults = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
  if (!finalResults.every((j) => j.status === 'SUCCEEDED'))
    throw new Error('Verification Timeout.');

  fs.writeFileSync(
    'gate_real_output.json',
    JSON.stringify(
      {
        pipelineRunId,
        projectId: project.id,
        summary: finalResults.map((j) => ({ type: j.type, status: j.status })),
      },
      null,
      2
    )
  );
}

test().finally(() => prisma.$disconnect());
