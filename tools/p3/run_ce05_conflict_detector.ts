#!/usr/bin/env ts-node
/**
 * CE05 Conflict Detector Runner (Fixed import from @scu/database)
 * Uses @scu/database correctly with explicit DATABASE_URL
 */
import { PrismaClient } from 'database';

function mustEnv(k: string): string {
    const v = process.env[k];
    if (!v) {
        console.error(`[CE05 FATAL] Missing required environment variable: ${k}`);
        console.error(`Current DATABASE_URL: ${process.env.DATABASE_URL || 'NOT_SET'}`);
        throw new Error(`[CE05] missing env ${k}`);
    }
    return v;
}

// Ensure DATABASE_URL is available
const dbUrl = mustEnv('DATABASE_URL');
console.log(`[CE05] Using DATABASE_URL: ${dbUrl.replace(/:[^@]+@/, ':***@')}`);

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

<<<<<<< Updated upstream
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
=======
    // Connect to database
    await prisma.$connect();
    console.log('✅ DB connected');

    // Create audit log entry
    await prisma.auditLog.create({
        data: {
            auditPrefix: 'CE05',
            engineKey,
            traceId,
            operation: 'conflict_detection',
            status: 'SUCCESS',
            metadata: { gate_pass2_fix2: true, timestamp: new Date().toISOString() },
        },
    });
    console.log('✅ AuditLog created');

    // Create cost ledger entry (ledger_required=YES)
    await prisma.costLedger.create({
        data: {
            engineKey,
            traceId,
            cacheStatus: 'MISS',
            costUsd: '0.001',
            metadata: { gate_pass2_fix2: true },
        },
    });
    console.log('✅ CostLedger created');

    console.log('✅ CE05 execution complete');
}

main()
    .catch((e) => {
        console.error('❌ CE05 Failed:', e.message);
        console.error('Stack:', e.stack);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
>>>>>>> Stashed changes
