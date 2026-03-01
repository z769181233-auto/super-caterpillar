import { EmotionAnalysisAdapter } from '../../apps/api/src/engines/adapters/emotion_analysis.adapter';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { EngineInvokeInput } from '@scu/shared-types';
import { randomUUID } from 'crypto';

// Mock Billing
const mockBillingService = {
  consumeCredits: async () => true,
  checkBalance: async () => true,
} as any;

async function main() {
  console.log('Initializing EMO Runner...');
  const prisma = new PrismaService();
  await prisma.$connect();
  const redis = new RedisService();
  await redis.onModuleInit();
  const audit = new AuditService(prisma);
  const cost = new CostLedgerService(prisma, mockBillingService);

  const adapter = new EmotionAnalysisAdapter(redis, audit, cost);

  // Setup Context
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const user = await prisma.user.create({
    data: { email: `emo_${suffix}@test.com`, passwordHash: 'x' },
  });
  const org = await prisma.organization.create({
    data: { name: `EmoOrg_${suffix}`, ownerId: user.id },
  });
  const project = await prisma.project.create({
    data: { name: `EmoProj_${suffix}`, organizationId: org.id, ownerId: user.id },
  });
  const job = await prisma.shotJob.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      type: 'NOVEL_ANALYSIS',
      status: 'RUNNING',
      attempts: 1,
    },
  });

  const baseContext = {
    projectId: project.id,
    organizationId: org.id,
    userId: user.id,
    jobId: job.id,
    traceId: `trace_emo_${suffix}`,
    attempt: 1,
  };

  try {
    console.log("=== Run 1: 'I am so happy' (Expect Joy) ===");
    const text1 = `I am so happy today! [${suffix}]`;
    const input1: EngineInvokeInput = {
      payload: { text: text1 },
      context: baseContext,
      engineKey: 'emotion_analysis',
      jobType: 'NOVEL_ANALYSIS',
    };
    const res1 = await adapter.invoke(input1);
    console.log('Res1:', JSON.stringify(res1.output));

    if (res1.output.primary !== 'joy') throw new Error(`Expected joy, got ${res1.output.primary}`);
    if (res1.output.source !== 'generated')
      throw new Error(`Expected generated, got ${res1.output.source}`);

    console.log("=== Run 2: 'I am very sad' (Expect Sadness) ===");
    const input2: EngineInvokeInput = {
      payload: { text: `I am very sad. [${suffix}]` },
      context: baseContext,
      engineKey: 'emotion_analysis',
      jobType: 'NOVEL_ANALYSIS',
    };
    const res2 = await adapter.invoke(input2);
    console.log('Res2:', JSON.stringify(res2.output));

    if (res2.output.primary !== 'sadness')
      throw new Error(`Expected sadness, got ${res2.output.primary}`);

    console.log('=== Run 3: Re-run Happy (Expect Cache HIT) ===');
    const res3 = await adapter.invoke(input1);
    console.log('Res3 Source:', res3.output.source);
    if (res3.output.source !== 'cache') throw new Error('Expected cache hit');

    // Verify Audit & Cost
    const runLogs = await prisma.auditLog.findMany({
      where: {
        action: 'EMOTION_ANALYSIS',
        details: { path: ['traceId'], equals: baseContext.traceId },
      },
    });
    console.log(`Audit Logs: ${runLogs.length}`);
    if (runLogs.length !== 3) throw new Error(`Expected 3 audit logs, got ${runLogs.length}`);

    const costs = await prisma.costLedger.findMany({ where: { jobId: job.id } });
    console.log(`Cost Records: ${costs.length}`);
    if (costs.length < 1) throw new Error('Expected costs > 0');

    // Cleanup
    await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map((l) => l.id) } } });
    await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
    await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: user.id } });

    await prisma.$disconnect();
    redis.onModuleDestroy();

    console.log('✅ Emotion Analysis Verified');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
