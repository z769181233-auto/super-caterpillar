#!/usr/bin/env bash
# PP05 封面海报生成引擎验证

set -euo pipefail

EVID_DIR="./evidence/pp05_poster_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"
mkdir -p tools/p3

echo "=== PP05 封面海报生成引擎验证 ===" | tee "$EVID_DIR/gate.log"

cat <<'EOF' > tools/p3/test_pp05.ts
import { PP05PosterGenAdapter } from '../../apps/api/src/engines/adapters/pp05_poster_gen.adapter';
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
    
    const engine = new PP05PosterGenAdapter(redis, audit, cost);
    
    const suffix = Date.now().toString();
    const context = {
        projectId: 'pp05-test',
        userId: 'system',
        traceId: 'trace-pp05-' + suffix,
        jobId: 'job-pp05-' + suffix,
        organizationId: 'org1'
    };
    
    // Seed
    await (prisma as any).user.upsert({ where: { id: 'system' }, update: {}, create: { id: 'system', email: 'system@scu', passwordHash: 'mock' } });
    await (prisma as any).organization.upsert({ where: { id: 'org1' }, update: { credits: 10000 }, create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 } });
    await (prisma as any).project.upsert({ where: { id: context.projectId }, update: {}, create: { id: context.projectId, name: 'PP05 Test', ownerId: 'system', organizationId: 'org1' } });
    
    await (prisma as any).shotJob.create({
        data: {
            id: context.jobId,
            projectId: context.projectId,
            status: 'RUNNING',
            type: 'PP_RENDER',
            attempts: 1,
            organizationId: 'org1'
        }
    });
    
    console.log('\n[Test 1] Poster Generation');
    const res1 = await engine.invoke({
        jobType: 'PP_RENDER',
        engineKey: 'pp05_poster_gen',
        payload: { title: 'The Caterpillar Returns' },
        context
    });
    console.log('✓ Poster URL:', res1.output.posterUrl);
    
    console.log('\n✅ PP05 Verified!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test Failed:', err.message);
    process.exit(1);
});
EOF

npx ts-node -r tsconfig-paths/register tools/p3/test_pp05.ts 2>&1 | tee "$EVID_DIR/test_output.log"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ PP05 Gate PASS" | tee -a "$EVID_DIR/gate.log"
    exit 0
else
    echo "❌ PP05 Gate FAIL" | tee -a "$EVID_DIR/gate.log"
    exit 1
fi
