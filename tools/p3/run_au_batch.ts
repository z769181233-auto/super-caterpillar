import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { AU01VoiceTTSAdapter } from '../../apps/api/src/engines/adapters/au01_voice_tts.adapter';
import { AU02BGMGenAdapter } from '../../apps/api/src/engines/adapters/au02_bgm_gen.adapter';
import { AU03SFXGenAdapter } from '../../apps/api/src/engines/adapters/au03_sfx_gen.adapter';
import { AU04AudioMixAdapter } from '../../apps/api/src/engines/adapters/au04_audio_mix.adapter';

async function main() {
  const prisma = new PrismaService();
  const redis = new RedisService();
  process.env.AUDIO_REAL_FORCE_DISABLE = '1'; // Force stub mode for gate
  await redis.onModuleInit();
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const audit = new AuditService(prisma);

  const metrics = new (require('../../apps/api/src/ops/ops-metrics.service').OpsMetricsService)(prisma);
  const audioService = new (require('../../apps/api/src/audio/audio.service').AudioService)(metrics);

  const au01 = new AU01VoiceTTSAdapter(redis, audit, cost, audioService);
  const au02 = new AU02BGMGenAdapter(redis, audit, cost, audioService);
  const au03 = new AU03SFXGenAdapter(redis, audit, cost);
  const au04 = new AU04AudioMixAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = 'p3_au_batch_test';
  const userId = 'system';
  const orgId = 'org1';

  // Seed
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `au_sys_${suffix}@scu`, passwordHash: 'mock' },
  });
  await (prisma as any).organization.upsert({
    where: { id: orgId },
    update: { credits: 1000 },
    create: { id: orgId, name: 'AU Org', ownerId: userId, credits: 1000 },
  });
  await (prisma as any).project.upsert({
    where: { id: projectId },
    update: {},
    create: { id: projectId, name: 'AU Batch Project', ownerId: userId, organizationId: orgId },
  });

  const engines = [
    { name: 'au01', adapter: au01, payload: { text: 'hello world' } },
    { name: 'au02', adapter: au02, payload: { style: 'epic' } },
    { name: 'au03', adapter: au03, payload: { description: 'explosion' } },
  ];

  const results = [];
  for (const e of engines) {
    const jobId = `job_${e.name}_${suffix}`;
    await (prisma as any).shotJob.create({
      data: {
        id: jobId,
        projectId,
        status: 'RUNNING',
        type: 'AU_RENDER',
        attempts: 1,
        organizationId: orgId,
      },
    });
    const res = await e.adapter.invoke({
      jobType: 'AU_RENDER',
      engineKey: `${e.name}_...`, // handled by adapter.supports
      payload: e.payload,
      context: {
        projectId,
        userId,
        traceId: `trace_${e.name}_${suffix}`,
        jobId,
        organizationId: orgId,
      },
    });
    console.log(`✅ ${e.name} result:`, res.output.assetUrl);
    results.push(res);
  }

  // Mix test
  const mixJobId = `job_au04_${suffix}`;
  await (prisma as any).shotJob.create({
    data: {
      id: mixJobId,
      projectId,
      status: 'RUNNING',
      type: 'AU_RENDER',
      attempts: 1,
      organizationId: orgId,
    },
  });
  const mixRes = await au04.invoke({
    jobType: 'AU_RENDER',
    engineKey: 'au04_audio_mix',
    payload: { tracks: results.map((r) => ({ url: r.output.assetUrl })) },
    context: {
      projectId,
      userId,
      traceId: `trace_au04_${suffix}`,
      jobId: mixJobId,
      organizationId: orgId,
    },
  });
  console.log(`✅ au04 result:`, mixRes.output.assetUrl);

  process.exit(0);
}
main();
