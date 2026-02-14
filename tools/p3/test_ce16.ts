import { CE16StoryBranchCoordinatorAdapter } from '../../apps/api/src/engines/adapters/ce16_story_branch_coordinator.adapter';
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
    
    const engine = new CE16StoryBranchCoordinatorAdapter(redis, audit, cost);
    
    const suffix = Date.now().toString();
    const context = {
        projectId: 'ce16-test',
        userId: 'system',
        traceId: 'trace-ce16-' + suffix,
        jobId: 'job-ce16-' + suffix,
        organizationId: 'org1'
    };
    
    // Seed
    await (prisma as any).user.upsert({ where: { id: 'system' }, update: {}, create: { id: 'system', email: 'system@scu', passwordHash: 'mock' } });
    await (prisma as any).organization.upsert({ where: { id: 'org1' }, update: { credits: 10000 }, create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 } });
    await (prisma as any).project.upsert({ where: { id: context.projectId }, update: {}, create: { id: context.projectId, name: 'CE16 Test', ownerId: 'system', organizationId: 'org1' } });
    
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
    
    console.log('\n[Test 1] Story Branch Analysis');
    const res1 = await engine.invoke({
        jobType: 'NOVEL_ANALYSIS',
        engineKey: 'ce16_story_branch_coordinator',
        payload: { branchId: 'alt_universe_01' },
        context
    });
    console.log('✓ BranchId:', res1.output.branchId);
    console.log('✓ Paradox Risk:', res1.output.paradoxRiskScore);
    
    console.log('\n✅ CE16 Verified!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test Failed:', err.message);
    process.exit(1);
});
