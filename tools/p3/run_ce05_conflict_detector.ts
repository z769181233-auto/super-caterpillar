#!/usr/bin/env ts-node
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { CE05ConflictDetectorAdapter } from '../../apps/api/src/engines/adapters/ce05_conflict_detector.adapter';

async function main() {
  console.log('Initializing CE05 Runner...');
  const prisma = new PrismaService();
  const redis = new RedisService();
  const audit = new AuditService(prisma);
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const adapter = new CE05ConflictDetectorAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = `p3_test_ce05_${suffix}`;
  const jobId = `job_ce05_${suffix}`;
  const userId = 'system';
  const orgId = 'org1';

  // Seed data
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `system_ce05_${suffix}@scu`, passwordHash: 'mock' },
  });
  await (prisma as any).organization.upsert({
    where: { id: orgId },
    update: { credits: 1000 },
    create: { id: orgId, name: 'Test Org', ownerId: userId, credits: 1000 },
  });
  await (prisma as any).project.create({
    data: {
      id: projectId,
      name: 'CE05 Test',
      ownerId: userId,
      organizationId: orgId,
    },
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

  const baseContext = {
    projectId,
    userId,
    traceId: `trace_ce05_${suffix}`,
    jobId,
    organizationId: orgId,
  };

  try {
    console.log('=== Test Case 1: Detect Conflict ===');
    const res1 = await adapter.invoke({
      jobType: 'NOVEL_ANALYSIS',
      engineKey: 'ce05_conflict_detector',
      payload: { text: 'They argued and shouted at each other' },
      context: baseContext,
    });
    console.log('Res1:', JSON.stringify(res1, null, 2));

    console.log('✅ CE05 Verified');
    process.exit(0);
  } catch (e) {
    console.error('❌ CE05 Verification Failed', e);
    process.exit(1);
  }
}

main();
