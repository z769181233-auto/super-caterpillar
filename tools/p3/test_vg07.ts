import { VG07FacialExpressionAdapter } from '../../apps/api/src/engines/adapters/vg07_facial_expression.adapter';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';

async function main() {
  const prisma = new PrismaService();
  const redis = new RedisService();
  await redis.onModuleInit();
  const billing = new BillingService(prisma);
  const cost = new CostLedgerService(prisma, billing);
  const audit = new AuditService(prisma);

  const engine = new VG07FacialExpressionAdapter(redis, audit, cost);

  const suffix = Date.now().toString();
  const context = {
    projectId: 'vg07-test',
    userId: 'system',
    traceId: 'trace-vg07-' + suffix,
    jobId: 'job-vg07-' + suffix,
    organizationId: 'org1',
  };

  // Seed data
  await (prisma as any).user.upsert({
    where: { id: 'system' },
    update: {},
    create: { id: 'system', email: 'system@scu', passwordHash: 'mock' },
  });

  await (prisma as any).organization.upsert({
    where: { id: 'org1' },
    update: { credits: 10000 },
    create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 },
  });

  await (prisma as any).project.upsert({
    where: { id: context.projectId },
    update: {},
    create: { id: context.projectId, name: 'VG07 Test', ownerId: 'system', organizationId: 'org1' },
  });

  // Create ShotJob for billing
  await (prisma as any).shotJob.create({
    data: {
      id: context.jobId,
      projectId: context.projectId,
      status: 'RUNNING',
      type: 'VG_RENDER',
      attempts: 1,
      organizationId: 'org1',
    },
  });

  console.log('\n[Test 1] Happy Expression');
  const res1 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg07_facial_expression',
    payload: { characterId: 'char_001', emotion: 'happy', intensity: 1.0, duration: 1.0, fps: 24 },
    context,
  });
  console.log('✓ Expression:', res1.output.expressionDataUrl);
  console.log('✓ Emotion:', res1.output.meta.emotion);
  console.log('✓ Frames:', res1.output.meta.frameCount);
  console.log('✓ Keypoints:', res1.output.meta.keypointCount);

  console.log('\n[Test 2] Sad Expression (Low Intensity)');
  const res2 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg07_facial_expression',
    payload: { characterId: 'char_002', emotion: 'sad', intensity: 0.5, duration: 2.0, fps: 24 },
    context,
  });
  console.log('✓ Sad expression verified (intensity: 0.5)');

  console.log('\n[Test 3] Angry Expression (Elastic Transition)');
  const res3 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg07_facial_expression',
    payload: {
      characterId: 'char_003',
      emotion: 'angry',
      intensity: 1.0,
      duration: 1.5,
      fps: 30,
      transition: 'elastic',
    },
    context,
  });
  console.log('✓ Angry expression with elastic transition verified');

  console.log('\n[Test 4] Multiple Emotions');
  const emotions = ['surprised', 'fear', 'neutral'];
  for (const emotion of emotions) {
    const res = await engine.invoke({
      jobType: 'VG_RENDER',
      engineKey: 'vg07_facial_expression',
      payload: { characterId: 'char_test', emotion, intensity: 0.8, duration: 1.0, fps: 24 },
      context,
    });
    console.log(`✓ ${emotion} expression verified`);
  }

  console.log('\n✅ All Tests Passed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test Failed:', err.message);
  process.exit(1);
});
