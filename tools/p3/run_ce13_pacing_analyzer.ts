import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { CE13PacingAnalyzerAdapter } from '../../apps/api/src/engines/adapters/ce13_pacing_analyzer.adapter';

async function main() {
  console.log('Initializing CE13 Runner...');
  const prisma = new PrismaService();
  const redis = new RedisService();
  const audit = new AuditService(prisma);
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const adapter = new CE13PacingAnalyzerAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = `p3_test_ce13_${suffix}`;
  const jobId = `job_ce13_${suffix}`;
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
    data: { id: projectId, name: 'CE13 Test', ownerId: userId, organizationId: orgId },
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
    console.log('--- FAST Pacing Test ---');
    const resFast = await adapter.invoke({
      jobType: 'NOVEL_ANALYSIS',
      engineKey: 'ce13_pacing_analyzer',
      payload: { text: 'Run! Fast. Now.' },
      context: {
        projectId,
        userId,
        traceId: `trace_ce13_fast_${suffix}`,
        jobId,
        organizationId: orgId,
      },
    });
    console.log('Res:', JSON.stringify(resFast, null, 2));
    if (resFast.output?.analysis.pacing !== 'FAST') throw new Error('Expected FAST pacing');

    console.log('--- SLOW Pacing Test ---');
    const jobId2 = `job_ce13_slow_${suffix}`;
    await (prisma as any).shotJob.create({
      data: {
        id: jobId2,
        projectId,
        status: 'RUNNING',
        type: 'NOVEL_ANALYSIS',
        attempts: 1,
        organizationId: orgId,
      },
    });
    const resSlow = await adapter.invoke({
      jobType: 'NOVEL_ANALYSIS',
      engineKey: 'ce13_pacing_analyzer',
      payload: {
        text: 'The very long and winding road lead to a place where time stood still, according to the ancient legends of the mountain people.',
      },
      context: {
        projectId,
        userId,
        traceId: `trace_ce13_slow_${suffix}`,
        jobId: jobId2,
        organizationId: orgId,
      },
    });
    console.log('Res:', JSON.stringify(resSlow, null, 2));
    if (resSlow.output?.analysis.pacing !== 'SLOW') throw new Error('Expected SLOW pacing');

    console.log('✅ CE13 Verified');
    process.exit(0);
  } catch (e) {
    console.error('❌ CE13 Failed', e);
    process.exit(1);
  }
}
main();
