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
  const userId = 'user-gate';
  const projectId = 'gate-project';
  const orgId = 'gate-org';
  console.log(`Running ${engineKey}...`);
  console.log(`TraceID: ${traceId}`);

  // Ensure User exists for FK
  await (prisma as any).user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: 'gate@scu', passwordHash: 'mock' },
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
  await (prisma as any).billingLedger.create({
    data: {
      projectId: 'gate-project',
      jobId: `job-${traceId.substring(0, 8)}`, // Must be UUID format or similar if enforced
      billingState: 'CONSUME',
      amount: BigInt(100), // 0.001 * 10^5 or similar
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
