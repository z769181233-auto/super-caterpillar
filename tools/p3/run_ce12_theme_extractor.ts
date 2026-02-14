import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { CE12ThemeExtractorAdapter } from '../../apps/api/src/engines/adapters/ce12_theme_extractor.adapter';

async function main() {
  console.log('Initializing CE12 Runner...');
  const prisma = new PrismaService();
  const redis = new RedisService();
  const audit = new AuditService(prisma);
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const adapter = new CE12ThemeExtractorAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = `p3_test_ce12_${suffix}`;
  const jobId = `job_ce12_${suffix}`;
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
    data: { id: projectId, name: 'CE12 Test', ownerId: userId, organizationId: orgId },
  });
  await (prisma as any).shotJob.create({
    data: {
      id: jobId,
      projectId,
      status: 'RUNNING',
      type: 'NOVEL_ANALYSIS',
      attempts: 1,
      organizationId: orgId,
    },
  });

  try {
    const res = await adapter.invoke({
      jobType: 'NOVEL_ANALYSIS',
      engineKey: 'ce12_theme_extractor',
      payload: { text: 'A battle for justice and love.' },
      context: { projectId, userId, traceId: `trace_ce12_${suffix}`, jobId, organizationId: orgId },
    });
    console.log('Res:', JSON.stringify(res, null, 2));
    if (!res.output?.analysis.detected_themes.includes('LOVE'))
      throw new Error('Expected LOVE theme');
    if (!res.output?.analysis.detected_themes.includes('JUSTICE'))
      throw new Error('Expected JUSTICE theme');
    console.log('✅ CE12 Verified');
    process.exit(0);
  } catch (e) {
    console.error('❌ CE12 Failed', e);
    process.exit(1);
  }
}
main();
