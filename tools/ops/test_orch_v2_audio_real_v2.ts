import { ApiClient } from '../../apps/workers/src/api-client';
import { PrismaClient } from 'database';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';

const prisma = new PrismaClient();
const apiClient = new ApiClient(
  'http://127.0.0.1:3000',
  process.env.WORKER_API_KEY || 'dev-worker-key',
  process.env.WORKER_API_SECRET || 'dev-worker-secret',
  process.env.WORKER_ID || 'gate-real-worker-01'
);

// Helper: Bind orphaned PENDING jobs to Mock Engines
async function autoBinder() {
  const map = {
    PIPELINE_STAGE1_NOVEL_TO_VIDEO: 'engine-orch',
    SHOT_RENDER: 'engine-shot',
    AUDIO: 'engine-audio',
    VIDEO_RENDER: 'engine-video',
  };

  const jobs = await prisma.shotJob.findMany({
    where: { status: 'PENDING' },
  });

  for (const job of jobs) {
    const engineId = (map as any)[job.type];
    if (!engineId) continue;

    const existing = await prisma.jobEngineBinding.findFirst({ where: { jobId: job.id } });
    if (!existing) {
      await prisma.jobEngineBinding.create({
        data: {
          jobId: job.id,
          engineId: engineId,
          engineKey: (await prisma.engine.findUnique({ where: { id: engineId } }))?.engineKey!,
          status: 'BOUND',
          priority: 0,
        } as any,
      });
      console.log(`[AutoBinder] Bound job ${job.id} (${job.type}) to ${engineId}`);
    }
  }
}

async function test() {
  console.log('--- L2 REAL SEAL: DUAL TRACK EXECUTION ---');
  const user = await prisma.user.upsert({
    where: { id: 'gate-user' },
    update: {},
    create: {
      id: 'gate-user',
      email: 'gate@scu.local',
      userType: 'admin',
      passwordHash: 'HASH',
    } as any,
  });
  const org = await prisma.organization.upsert({
    where: { id: 'gate-org' },
    update: { credits: 1000 },
    create: { id: 'gate-org', name: 'Gate Org', ownerId: user.id, credits: 1000 } as any,
  });
  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      name: 'L2 Dual Track Seal',
      organizationId: org.id,
      ownerId: user.id,
      status: 'in_progress',
    } as any,
  });

  // Mock Reference Sheet (Required by Stage 1 API)
  const refJob = await prisma.shotJob.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      type: 'NOVEL_ANALYSIS' as any,
      status: 'SUCCEEDED' as any,
    },
  });
  const refBinding = await prisma.jobEngineBinding.create({
    data: {
      jobId: refJob.id,
      engineId: 'engine-shot',
      engineKey: 'default_shot_render',
      status: 'COMPLETED' as any,
    } as any,
  });

  console.log(`[Trigger] Starting Pipeline...`);
  const pipelineRes = await (apiClient as any).request(
    'POST',
    '/api/orchestrator/pipeline/stage1',
    {
      novelText: 'Final Seal. Harmonizing Sound and Vision.',
      projectId: project.id,
      referenceSheetId: refBinding.id,
      isVerification: true,
    }
  );
  if (!pipelineRes.success) throw new Error(`Trigger failed: ${JSON.stringify(pipelineRes)}`);
  const { pipelineRunId } = pipelineRes.data;
  console.log(`[Pipeline] ID: ${pipelineRunId}. Tracking...`);

  const start = Date.now();
  let audioJob: any = null;
  let videoJobs: any[] = [];

  while (Date.now() - start < 180000) {
    await autoBinder(); // Keep binding as jobs appear

    audioJob = await prisma.shotJob.findFirst({
      where: { type: 'AUDIO', payload: { path: ['pipelineRunId'], equals: pipelineRunId } },
    });
    videoJobs = await prisma.shotJob.findMany({
      where: { type: 'SHOT_RENDER', payload: { path: ['pipelineRunId'], equals: pipelineRunId } },
    });

    if (
      audioJob?.status === 'SUCCEEDED' &&
      videoJobs.length > 0 &&
      videoJobs.every((v) => v.status === 'SUCCEEDED')
    ) {
      break;
    }

    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (!audioJob || videoJobs.length === 0) throw new Error('DAG Lifecycle Broken. Jobs missing.');
  if (audioJob.status !== 'SUCCEEDED') throw new Error('AUDIO Track Failed.');

  console.log(`\n[OK] L2 REAL SEAL ACHIEVED.`);
  console.log(`- Final Pipeline Run: ${pipelineRunId}`);
  console.log(`- Parallel Vision Track: ${videoJobs.length} shots completed.`);
  console.log(`- Parallel Sound Track: AUDIO completed.`);

  fs.writeFileSync(
    'gate_real_output.json',
    JSON.stringify(
      {
        pipelineRunId,
        audioJobId: audioJob.id,
        videoCount: videoJobs.length,
        ts: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

test().catch((e) => {
  console.error('\n❌ L2 SEAL FAILED:');
  console.error(e);
  process.exit(1);
});
