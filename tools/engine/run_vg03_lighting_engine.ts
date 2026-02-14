import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { VG03LightingEngineAdapter } from '../../apps/api/src/engines/adapters/vg03_lighting_engine.adapter';

async function main() {
  console.log('Initializing VG03 Runner...');
  const prisma = new PrismaService();
  const redis = new RedisService();
  await redis.onModuleInit();
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const audit = new AuditService(prisma);
  const adapter = new VG03LightingEngineAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = `p3_test_vg03_${suffix}`;
  const jobId = `job_vg03_${suffix}`;
  const userId = 'system';
  const orgId = 'org1';

  // Seed data
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `system_${suffix}@scu`, passwordHash: 'mock' },
  });
  await (prisma as any).organization.upsert({
    where: { id: orgId },
    update: { credits: 1000 },
    create: { id: orgId, name: 'Test Org', ownerId: userId, credits: 1000 },
  });
  await (prisma as any).project.create({
    data: { id: projectId, name: 'VG03 Test', ownerId: userId, organizationId: orgId },
  });
  await (prisma as any).shotJob.create({
    data: {
      id: jobId,
      projectId,
      status: 'RUNNING',
      type: 'VG_RENDER',
      attempts: 1,
      organizationId: orgId,
    },
  });

  try {
    const res = await adapter.invoke({
      jobType: 'VG_RENDER',
      engineKey: 'vg03_lighting_engine',
      payload: { sourceUrl: '/tmp/not_found.png', lightingPreset: 'night' },
      context: { projectId, userId, traceId: `trace_vg03_${suffix}`, jobId, organizationId: orgId },
    });
    console.log('Res:', JSON.stringify(res, null, 2));
    if (!res.output?.assetUrl.startsWith('file://')) throw new Error('Expected file:// assetUrl');
    console.log('✅ VG03 Verified');
    process.exit(0);
  } catch (e) {
    console.error('❌ VG03 Failed', e);
    process.exit(1);
  }
}
main();
