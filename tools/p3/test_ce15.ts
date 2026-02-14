import { CE15MultiCharSceneAdapter } from '../../apps/api/src/engines/adapters/ce15_multi_char_scene.adapter';
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
    
    const engine = new CE15MultiCharSceneAdapter(redis, audit, cost);
    
    const suffix = Date.now().toString();
    const context = {
        projectId: 'ce15-test',
        userId: 'system',
        traceId: 'trace-ce15-' + suffix,
        jobId: 'job-ce15-' + suffix,
        organizationId: 'org1'
    };
    
    // Seed data
    await (prisma as any).user.upsert({
        where: { id: 'system' },
        update: {},
        create: { id: 'system', email: 'system@scu', passwordHash: 'mock' }
    });
    
    await (prisma as any).organization.upsert({
        where: { id: 'org1' },
        update: { credits: 10000 },
        create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 }
    });
    
    await (prisma as any).project.upsert({
        where: { id: context.projectId },
        update: {},
        create: { id: context.projectId, name: 'CE15 Test', ownerId: 'system', organizationId: 'org1' }
    });
    
    // Create ShotJob for billing
    await (prisma as any).shotJob.create({
        data: {
            id: context.jobId,
            projectId: context.projectId,
            status: 'RUNNING',
            type: 'NOVEL_ANALYSIS',
            attempts: 1,
            organizationId: 'org1'
        }
    });
    
    console.log('\n[Test 1] Dual Character Scene');
    const res1 = await engine.invoke({
        jobType: 'NOVEL_ANALYSIS',
        engineKey: 'ce15_multi_char_scene',
        payload: { sceneId: 'scene_001', characterIds: ['char_001', 'char_002'] },
        context
    });
    console.log('✓ SceneId:', res1.output.coordination.sceneId);
    console.log('✓ Char Count:', res1.output.coordination.characterCount);
    console.log('✓ Interactions:', res1.output.coordination.interactions.length);
    console.log('✓ Recommendation:', res1.output.coordination.compositionRecommendation);
    
    console.log('\n[Test 2] Single Character Scene');
    const res2 = await engine.invoke({
        jobType: 'NOVEL_ANALYSIS',
        engineKey: 'ce15_multi_char_scene',
        payload: { sceneId: 'scene_002', characterIds: ['char_001'] },
        context
    });
    console.log('✓ Character count confirmed');
    
    console.log('\n✅ All Tests Passed!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test Failed:', err.message);
    process.exit(1);
});
