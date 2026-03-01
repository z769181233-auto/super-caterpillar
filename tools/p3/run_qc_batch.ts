import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { QC01VisualFidelityAdapter } from '../../apps/api/src/engines/adapters/qc01_visual_fidelity.adapter';
import { QC02NarrativeConsistencyAdapter } from '../../apps/api/src/engines/adapters/qc02_narrative_consistency.adapter';
import { QC03IdentityContinuityAdapter } from '../../apps/api/src/engines/adapters/qc03_identity_continuity.adapter';
import { QC04ComplianceScanAdapter } from '../../apps/api/src/engines/adapters/qc04_compliance_scan.adapter';

async function main() {
  const prisma = new PrismaService();
  const redis = new RedisService();
  await redis.onModuleInit();
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const audit = new AuditService(prisma);

  const qc01 = new QC01VisualFidelityAdapter(redis, audit, cost);
  const qc02 = new QC02NarrativeConsistencyAdapter(redis, audit, cost);
  const qc03 = new QC03IdentityContinuityAdapter(redis, audit, cost);
  const qc04 = new QC04ComplianceScanAdapter(redis, audit, cost);

  const suffix = Math.random().toString(36).substring(7);
  const projectId = 'p3_qc_batch_test';
  const userId = 'system';
  const orgId = 'org1';

  // Seed
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `qc_sys_${suffix}@scu`, passwordHash: 'mock' },
  });
  await (prisma as any).organization.upsert({
    where: { id: orgId },
    update: { credits: 2000 },
    create: { id: orgId, name: 'QC Org', ownerId: userId, credits: 2000 },
  });
  await (prisma as any).project.upsert({
    where: { id: projectId },
    update: {},
    create: { id: projectId, name: 'QC Batch Project', ownerId: userId, organizationId: orgId },
  });

  const engines = [
    { name: 'qc01', adapter: qc01 },
    { name: 'qc02', adapter: qc02 },
    { name: 'qc03', adapter: qc03 },
    { name: 'qc04', adapter: qc04 },
  ];

  for (const e of engines) {
    const jobId = `job_${e.name}_${suffix}`;
    await (prisma as any).shotJob.create({
      data: {
        id: jobId,
        projectId,
        status: 'RUNNING',
        type: 'QC_CHECK',
        attempts: 1,
        organizationId: orgId,
      },
    });
    const res = await e.adapter.invoke({
      jobType: 'QC_CHECK',
      engineKey: `${e.name}_...`,
      payload: {},
      context: {
        projectId,
        userId,
        traceId: `t_${e.name}_${suffix}`,
        jobId,
        organizationId: orgId,
      },
    });
    console.log(`✅ ${e.name} result:`, res.output.status);
  }

  process.exit(0);
}
main();
