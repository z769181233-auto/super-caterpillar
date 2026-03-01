import { VG10ClothDynamicsAdapter } from '../../apps/api/src/engines/adapters/vg10_cloth_dynamics.adapter';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';

async function main() {
  const prisma = new PrismaService();
  const redis = new RedisService();
  await redis.onModuleInit();
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const audit = new AuditService(prisma);

  const engine = new VG10ClothDynamicsAdapter(redis, audit, cost);

  const suffix = Date.now().toString();
  const context = {
    projectId: 'vg10-test',
    userId: 'system',
    traceId: 'trace-vg10-' + suffix,
    jobId: 'job-vg10-' + suffix,
    organizationId: 'org1',
  };

  // Seed
  await (prisma as any).user.upsert({
    where: { id: 'system' },
    update: {},
    create: { id: 'system', email: 'system@scu', passwordHash: 'mock' },
  });
  await (prisma as any).organization.upsert({
    where: { id: 'org1' },
    update: { credits: 10000 },
    create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 },
  });
  await (prisma as any).project.upsert({
    where: { id: context.projectId },
    update: {},
    create: { id: context.projectId, name: 'VG10 Test', ownerId: 'system', organizationId: 'org1' },
  });

  await (prisma as any).shotJob.create({
    data: {
      id: context.jobId,
      projectId: context.projectId,
      status: 'RUNNING',
      type: 'VG_RENDER',
      attempts: 1,
      organizationId: 'org1',
    },
  });

  console.log('\n[Test 1] Silk Cloth Dynamics');
  const res1 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg10_cloth_dynamics',
    payload: { characterId: 'char_001', clothType: 'silk' },
    context,
  });
  console.log('✓ Dynamics Data:', res1.output.dynamicsDataUrl);

  console.log('\n✅ VG10 Verified!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test Failed:', err.message);
  process.exit(1);
});
