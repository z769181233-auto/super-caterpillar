import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient({});

async function test() {
  console.log('--- DIRECT PARALLEL INJECTION L2 SEAL ---');
  const pipelineRunId = `run_${randomUUID()}`;
  const projectId = randomUUID();

  // 1. Create Parallel Jobs
  const jobs = [
    { type: 'SHOT_RENDER', engineId: 'engine-shot', engineKey: 'default_shot_render' },
    { type: 'AUDIO', engineId: 'engine-audio', engineKey: 'audio_engine' },
  ];

  const jobIds: string[] = [];
  for (const j of jobs) {
    const job = await prisma.shotJob.create({
      data: {
        id: randomUUID(),
        projectId,
        organizationId: 'gate-org',
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

  // 2. Poll for Completion
  console.log(`Waiting for Worker (@scu/worker) to finish parallel tracks...`);
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const active = await prisma.shotJob.findMany({
      where: { id: { in: jobIds } },
    });
    if (active.every((j) => j.status === 'SUCCEEDED')) {
      console.log('\n✅ ALL TRACKS SUCCEEDED.');
      break;
    }
    if (active.some((j) => j.status === 'FAILED')) throw new Error('A track FAILED.');
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }

  const final = await prisma.shotJob.findMany({ where: { id: { in: jobIds } } });
  if (!final.every((j) => j.status === 'SUCCEEDED'))
    throw new Error('Timeout waiting for workers.');

  fs.writeFileSync(
    'gate_real_output.json',
    JSON.stringify(
      {
        pipelineRunId,
        results: final.map((j) => ({ id: j.id, type: j.type, status: j.status })),
      },
      null,
      2
    )
  );
}

test().finally(() => prisma.$disconnect());
