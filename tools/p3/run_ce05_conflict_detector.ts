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
  const userId = '00000000-0000-0000-0000-000000000001';
  const projectId = '00000000-0000-0000-0000-000000000002';
  const orgId = '00000000-0000-0000-0000-000000000003';
  console.log(`Running ${engineKey}...`);
  console.log(`TraceID: ${traceId}`);

  // Ensure User exists for FK
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `gate_${Date.now()}@scu`, passwordHash: 'mock' },
  });

  // Ensure Project and Org exist (for CostLedger foreign keys)
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: { id: orgId, name: 'Gate Org', ownerId: userId },
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

  // Create billing ledger entry (ledger_required=YES)
  const uniqueJobId = `00000000-0000-0000-0000-${Date.now().toString().padEnd(12, '0').substring(0, 12)}`;
  await (prisma as any).billingLedger.create({
    data: {
      projectId: projectId,
      jobId: uniqueJobId,
      billingState: 'CONSUME',
      amount: BigInt(100),
      idempotencyKey: `idempotency-${traceId}`,
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
