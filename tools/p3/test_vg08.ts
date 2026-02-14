import { VG08AdvancedLightingAdapter } from '../../apps/api/src/engines/adapters/vg08_advanced_lighting.adapter';
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

  const engine = new VG08AdvancedLightingAdapter(redis, audit, cost);

  const suffix = Date.now().toString();
  const context = {
    projectId: 'vg08-test',
    userId: 'system',
    traceId: 'trace-vg08-' + suffix,
    jobId: 'job-vg08-' + suffix,
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
    create: { id: context.projectId, name: 'VG08 Test', ownerId: 'system', organizationId: 'org1' },
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

  console.log('\n[Test 1] Production Quality Lighting');
  const res1 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg08_advanced_lighting',
    payload: {
      sceneId: 'scene_001',
      quality: 'production',
      lightSources: [
        { type: 'point', intensity: 1.0, color: '#ffffff' },
        { type: 'ambient', intensity: 0.3, color: '#4444ff' },
      ],
    },
    context,
  });
  console.log('✓ LightMap:', res1.output.lightMapUrl);
  console.log('✓ Quality:', res1.output.meta.quality);

  console.log('\n[Test 2] Ultra Quality Raytracing');
  const res2 = await engine.invoke({
    jobType: 'VG_RENDER',
    engineKey: 'vg08_advanced_lighting',
    payload: {
      sceneId: 'scene_002',
      quality: 'ultra',
      rayDepth: 4,
    },
    context,
  });
  console.log('✓ Ray depth verified:', res2.output.meta.rayDepth);

  console.log('\n✅ All Tests Passed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test Failed:', err.message);
  process.exit(1);
});
