import { TranslationCloudAdapter } from '../../apps/api/src/engines/adapters/translation.cloud.adapter';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { EngineInvokeInput } from '@scu/shared-types';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

// Mock Billing
const mockBillingService = {
  consumeCredits: async () => true,
  checkBalance: async () => true,
} as any;

async function main() {
  console.log('Initializing Services...');

  // DB
  const prisma = new PrismaService();
  await prisma.$connect();

  // Services
  const audit = new AuditService(prisma);
  const cost = new CostLedgerService(prisma, mockBillingService);

  // Target Adapter
  const adapter = new TranslationCloudAdapter(prisma, audit, cost);

  // Setup Context
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `trans_runner_${suffix}@example.com`, passwordHash: 'x' },
  });
  const org = await prisma.organization.create({
    data: { name: `TransOrg_${suffix}`, ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: { name: `TransProj_${suffix}`, organizationId: org.id, ownerId: user.id },
  });
  const task = await prisma.task.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      type: 'CE_CORE_PIPELINE',
      status: 'RUNNING',
    },
  });
  const job = await prisma.shotJob.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      taskId: task.id,
      type: 'CE06_NOVEL_PARSING',
      status: 'RUNNING',
      attempts: 1,
    },
  });

  const sourceText = 'Hello World ' + Date.now();
  const input: EngineInvokeInput = {
    payload: { sourceText, targetLang: 'zh', provider: 'deepl' },
    context: {
      projectId: project.id,
      organizationId: org.id,
      userId: user.id,
      jobId: job.id,
      traceId: `trace_${suffix}`,
      attempt: 1,
    },
    engineKey: 'translation_engine',
    jobType: 'TRANSLATION',
  };

  try {
    // --- Test 1: Success (With Key) ---
    process.env.TRANSLATION_API_KEY = 'mock_key';

    console.log('--- Run 1: Cache MISS (Expect Provider Call) ---');
    const t0 = performance.now();
    const res1 = await adapter.invoke(input);
    const t1 = performance.now();
    console.log(JSON.stringify(res1, null, 2));
    console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

    console.log('--- Run 2: Cache HIT (Expect Cache) ---');
    const t2 = performance.now();
    const res2 = await adapter.invoke(input);
    const t3 = performance.now();
    console.log(JSON.stringify(res2, null, 2));
    console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

    // Verify Logic
    let exitCode = 0;

    if (res1.output.source !== 'provider') {
      console.error('FAIL: Run 1 source != provider');
      exitCode = 1;
    }
    if (res2.output.source !== 'cache') {
      console.error('FAIL: Run 2 source != cache');
      exitCode = 1;
    }
    if (res1.output.text !== res2.output.text) {
      console.error('FAIL: Run 1 text != Run 2 text');
      exitCode = 1;
    }

    // --- Test 2: Failure (No Key) ---
    console.log('--- Run 3: No Key (Expect FAIL) ---');
    delete process.env.TRANSLATION_API_KEY;
    const colInput = {
      ...input,
      payload: { ...input.payload, sourceText: 'New Unique Text ' + Date.now() },
    };
    const res3 = await adapter.invoke(colInput);
    console.log(JSON.stringify(res3, null, 2));

    if (res3.status !== 'FAILED') {
      console.error('FAIL: Run 3 expected FAILED, got ' + res3.status);
      exitCode = 1;
    }
    if ((res3 as any).error?.code !== 'TRANSLATION_NO_KEY') {
      console.error('FAIL: Run 3 expected TRANSLATION_NO_KEY');
      exitCode = 1;
    }

    // --- Verify Audit & Cost ---
    // Expect:
    // Run 1: MISS (Success)
    // Run 2: HIT (Success)
    // Run 3: MISS (Failed)
    // Total 3 audits
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'TRANSLATION_INVOKE',
        details: { path: ['traceId'], equals: `trace_${suffix}` },
      },
    });
    console.log(`Audit Logs Found: ${auditLogs.length}`);
    if (auditLogs.length !== 3) {
      console.error(`FAIL: Expected 3 audit logs, got ${auditLogs.length}`);
      exitCode = 1;
    }

    // Confirm Run 3 logic: Failed -> Audit(MISS, failed_request)
    const failedAudit = auditLogs.find((l) => (l.details as any).status === 'FAILED');
    if (!failedAudit) {
      console.error('FAIL: Missing FAILED audit log');
      exitCode = 1;
    }

    // Cleanup
    // Cleanup Audit: Find by traceId then delete (projectId is inside details)
    const runLogs = await prisma.auditLog.findMany({
      where: {
        action: 'TRANSLATION_INVOKE',
        details: { path: ['traceId'], equals: `trace_${suffix}` },
      },
      select: { id: true },
    });
    if (runLogs.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map((l) => l.id) } } });
    }
    await prisma.translationCache.deleteMany({ where: { projectId: project.id } });
    await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
    await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: user.id } });

    await prisma.$disconnect();

    if (exitCode === 0) console.log('✅ Translation Logic Verified');
    process.exit(exitCode);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
