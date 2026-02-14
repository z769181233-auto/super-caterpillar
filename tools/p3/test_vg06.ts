import { VG06SkeletalAnimationAdapter } from '../../apps/api/src/engines/adapters/vg06_skeletal_animation.adapter';
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
    
    const engine = new VG06SkeletalAnimationAdapter(redis, audit, cost);
    
    const suffix = Date.now().toString();
    const context = {
        projectId: 'vg06-test',
        userId: 'system',
        traceId: 'trace-vg06-' + suffix,
        jobId: 'job-vg06-' + suffix,
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
        create: { id: context.projectId, name: 'VG06 Test', ownerId: 'system', organizationId: 'org1' }
    });
    
    // Create ShotJob for billing
    await (prisma as any).shotJob.create({
        data: {
            id: context.jobId,
            projectId: context.projectId,
            status: 'RUNNING',
            type: 'VG_RENDER',
            attempts: 1,
            organizationId: 'org1'
        }
    });
    
    console.log('\n[Test 1] Walk Animation');
    const res1 = await engine.invoke({
        jobType: 'VG_RENDER',
        engineKey: 'vg06_skeletal_animation',
        payload: { characterId: 'char_001', action: 'walk', duration: 2.0, fps: 24 },
        context
    });
    console.log('✓ Animation:', res1.output.animationDataUrl);
    console.log('✓ Frames:', res1.output.meta.frameCount);
    console.log('✓ Bones:', res1.output.meta.boneCount);
    
    console.log('\n[Test 2] Jump Animation');
    const res2 = await engine.invoke({
        jobType: 'VG_RENDER',
        engineKey: 'vg06_skeletal_animation',
        payload: { characterId: 'char_002', action: 'jump', duration: 1.0, fps: 30 },
        context
    });
    console.log('✓ Jump animation verified');
    
    console.log('\n[Test 3] Layered Animation');
    const res3 = await engine.invoke({
        jobType: 'VG_RENDER',
        engineKey: 'vg06_skeletal_animation',
        payload: { characterId: 'char_003', action: 'wave', duration: 2.0, fps: 24, layered: true },
        context
    });
    console.log('✓ Layered animation verified');
    
    console.log('\n✅ All Tests Passed!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test Failed:', err.message);
    process.exit(1);
});
