#!/usr/bin/env bash
# AU05 环境混响引擎验证

set -euo pipefail

EVID_DIR="./evidence/au05_reverb_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"
mkdir -p tools/p3

echo "=== AU05 环境混响引擎验证 ===" | tee "$EVID_DIR/gate.log"

cat <<'EOF' > tools/p3/test_au05.ts
import { AU05EnvironmentalReverbAdapter } from '../../apps/api/src/engines/adapters/au05_environmental_reverb.adapter';
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
    
    const engine = new AU05EnvironmentalReverbAdapter(redis, audit, cost);
    
    const suffix = Date.now().toString();
    const context = {
        projectId: 'au05-test',
        userId: 'system',
        traceId: 'trace-au05-' + suffix,
        jobId: 'job-au05-' + suffix,
        organizationId: 'org1'
    };
    
    // Seed
    await (prisma as any).user.upsert({ where: { id: 'system' }, update: {}, create: { id: 'system', email: 'system@scu', passwordHash: 'mock' } });
    await (prisma as any).organization.upsert({ where: { id: 'org1' }, update: { credits: 10000 }, create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 10000 } });
    await (prisma as any).project.upsert({ where: { id: context.projectId }, update: {}, create: { id: context.projectId, name: 'AU05 Test', ownerId: 'system', organizationId: 'org1' } });
    
    await (prisma as any).shotJob.create({
        data: {
            id: context.jobId,
            projectId: context.projectId,
            status: 'RUNNING',
            type: 'AU_RENDER',
            attempts: 1,
            organizationId: 'org1'
        }
    });
    
    console.log('\n[Test 1] Reverb Generation');
    const res1 = await engine.invoke({
        jobType: 'AU_RENDER',
        engineKey: 'au05_environmental_reverb',
        payload: { roomType: 'church' },
        context
    });
    console.log('✓ Reverb Profile:', res1.output.reverbProfile);
    
    console.log('\n✅ AU05 Verified!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Test Failed:', err.message);
    process.exit(1);
});
EOF

npx ts-node -r tsconfig-paths/register tools/p3/test_au05.ts 2>&1 | tee "$EVID_DIR/test_output.log"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ AU05 Gate PASS" | tee -a "$EVID_DIR/gate.log"
    exit 0
else
    echo "❌ AU05 Gate FAIL" | tee -a "$EVID_DIR/gate.log"
    exit 1
fi
