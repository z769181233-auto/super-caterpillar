import { CE17CulturalConsistencyAdapter } from '../../apps/api/src/engines/adapters/ce17_cultural_consistency.adapter';
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

  const engine = new CE17CulturalConsistencyAdapter(redis, audit, cost);

  const suffix = Date.now().toString();
  const context = {
    projectId: 'ce17-test',
    userId: 'system',
    traceId: 'trace-ce17-' + suffix,
    jobId: 'job-ce17-' + suffix,
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
    create: { id: context.projectId, name: 'CE17 Test', ownerId: 'system', organizationId: 'org1' },
  });

  await (prisma as any).shotJob.create({
    data: {
      id: context.jobId,
      projectId: context.projectId,
      status: 'RUNNING',
      type: 'NOVEL_ANALYSIS',
      attempts: 1,
      organizationId: 'org1',
    },
  });

  console.log('\n[Test 1] Cultural Check');
  const res1 = await engine.invoke({
    jobType: 'NOVEL_ANALYSIS',
    engineKey: 'ce17_cultural_consistency',
    payload: { region: 'China' },
    context,
  });
  console.log('✓ Consistency Score:', res1.output.consistencyScore);

  console.log('\n✅ CE17 Verified!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test Failed:', err.message);
  process.exit(1);
});
