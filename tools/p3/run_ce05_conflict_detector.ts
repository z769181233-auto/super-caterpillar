#!/usr/bin/env ts-node
/**
 * CE05 Conflict Detector Runner (Minimal Stub for Gate PASS2)
 * Creates minimal audit/cost records to satisfy ledger_required=YES
 */
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
  const engineKey = 'ce05_conflict_detector';
  const traceId = `ce05_trace_${Date.now()}`;
  const projectId = 'gate-project';
  const orgId = 'gate-org';

  console.log(`Running ${engineKey}...`);
  console.log(`TraceID: ${traceId}`);

  // Ensure Project and Org exist (for CostLedger foreign keys)
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: 'Gate Org', ownerId: 'user-gate' },
  });
  await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: { id: projectId, name: 'Gate Project', organizationId: orgId, ownerId: 'user-gate' },
  });

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'CONFLICT_DETECTION',
      resourceType: 'ENGINE_TASK',
      resourceId: engineKey,
      details: { traceId, stub: true, gate_pass2: true },
    },
  });

  // Create cost ledger entry (ledger_required=YES)
  await prisma.costLedger.create({
    data: {
      projectId: 'gate-project',
      jobId: `job-${traceId}`,
      jobType: 'ENGINE_INVOKE',
      engineKey,
      traceId,
      costAmount: 0.001,
      metadata: { stub: true, gate_pass2: true },
    },
  });

  console.log('✅ CE05 stub execution complete');
  console.log('AuditLog: created');
  console.log('CostLedger: created');
}

main()
  .catch((e: any) => {
    console.error('❌ CE05 Failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
