import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient({});

async function test() {
  console.log('--- FINAL SEAL: DUAL TRACK ALIGNMENT ---');
  const organizationId = 'gate-org';
  const ownerId = 'gate-user';

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

  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      name: 'L2 Final Seal V4',
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

  const jobsConfig = [
    { type: 'SHOT_RENDER', engineId: 'engine-shot', engineKey: 'default_shot_render' },
    { type: 'AUDIO', engineId: 'engine-audio', engineKey: 'audio_engine' },
  ];

  const jobIds: string[] = [];
  for (const j of jobsConfig) {
    const job = await prisma.shotJob.create({
      data: {
        projectId: project.id,
        organizationId,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,
        type: j.type as any,
        status: 'PENDING',
        priority: 100, // Boost priority to ensure claim
        payload: { pipelineRunId, isVerification: true, stress_p1_1: true },
      },
    });
    await prisma.jobEngineBinding.create({
      data: {
        jobId: job.id,
        engineId: j.engineId,
        engineKey: j.engineKey,
        status: 'BOUND',
      } as any,
    });
    jobIds.push(job.id);
    console.log(`[Created] ${j.type} (${job.id})`);
  }

  console.log(
    `Initial PENDING count: ${await prisma.shotJob.count({ where: { status: 'PENDING' } })}`
  );

  const start = Date.now();
  while (Date.now() - start < 150000) {
    const results = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
    const succeeded = results.filter((j) => j.status === 'SUCCEEDED').length;
    const failed = results.filter((j) => j.status === 'FAILED').length;
    const running = results.filter((j) => j.status === 'RUNNING').length;

    process.stdout.write(`(${succeeded}/${jobIds.length} S, ${running} R, ${failed} F).`);
    if (succeeded === jobIds.length) {
      console.log('\n✅ DUAL TRACKS VERIFIED.');
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  const final = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
  if (final.some((j) => j.status !== 'SUCCEEDED')) throw new Error('Seal Verification Failed.');

  fs.writeFileSync(
    'gate_real_output.json',
    JSON.stringify(
      {
        pipelineRunId,
        summary: final.map((j) => ({ type: j.type, status: j.status })),
      },
      null,
      2
    )
  );
}

test().finally(() => prisma.$disconnect());
