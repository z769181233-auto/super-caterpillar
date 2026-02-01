#!/usr/bin/env bash
set -euo pipefail

# gate_p3_vg_base.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_vg_base_20260201}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: VG Base Infrastructure ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
} > "$EVI/env_snapshot.txt"

# Run Unit Tests if any, or use a runner to verify cache/cost
echo "Verifying VG Base Logic via Mock Runner..." | tee -a "$EVI/gate.log"

# We'll create a temporary runner tools/p3/test_vg_base.ts
mkdir -p tools/p3
cat <<EOF > tools/p3/test_vg_base.ts
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { VgBaseEngine } from '../../apps/api/src/engines/base/vg_base.engine';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';

class MockVgEngine extends VgBaseEngine {
    constructor(redis: RedisService, audit: AuditService, cost: CostLedgerService) {
        super('mock_vg_engine', redis, audit, cost);
    }
    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }
    protected async processLogic(payload: any) {
        return { assetUrl: 'file:///tmp/mock_vg.png', meta: { mock: true } };
    }
}

async function main() {
    const prisma = new PrismaService();
    const redis = new RedisService();
    await redis.onModuleInit(); // IMPORTANT: Connect to Redis
    const billing = new BillingService(prisma);
    const cost = new CostLedgerService(prisma, billing);
    const audit = new AuditService(prisma);
    const engine = new MockVgEngine(redis, audit, cost);

    const suffix = Math.random().toString(36).substring(7);
    const context = {
        projectId: 'p3_vg_test',
        userId: 'system',
        traceId: 'trace_' + suffix,
        jobId: 'job_' + suffix,
        organizationId: 'org1'
    };

    // Ensure seed data
    await (prisma as any).user.upsert({ where: { id: 'system' }, update: {}, create: { id: 'system', email: 'system@scu', passwordHash: 'mock' } });
    await (prisma as any).organization.upsert({ where: { id: 'org1' }, update: { credits: 1000 }, create: { id: 'org1', name: 'Test Org', ownerId: 'system', credits: 1000 } });
    
    // Ensure project exists to avoid FK error
    await (prisma as any).project.upsert({
        where: { id: context.projectId },
        update: {},
        create: { id: context.projectId, name: 'VG Test Project', ownerId: 'system', organizationId: 'org1' }
    });

    // Ensure ShotJob exists for CostLedger
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

    console.log("--- 1. First Run (MISS) ---");
    const res1 = await engine.invoke({ jobType: 'VG_RENDER', engineKey: 'mock_vg_engine', payload: { test: suffix }, context });
    console.log("Res1 Source:", res1.output.meta.source);
    if (res1.output.meta.source !== 'generated') throw new Error("Expected source: generated");

    console.log("--- 2. Second Run (HIT) ---");
    const res2 = await engine.invoke({ jobType: 'VG_RENDER', engineKey: 'mock_vg_engine', payload: { test: suffix }, context });
    console.log("Res2 Source:", res2.output.meta.source);
    if (res2.output.meta.source !== 'cache') throw new Error("Expected source: cache");

    console.log("✅ VG Base Verified");
    process.exit(0);
}
main();
EOF

npx ts-node -r tsconfig-paths/register tools/p3/test_vg_base.ts > "$EVI/test_vg_base.log" 2>&1 || {
    echo "❌ VG Base Logic Test Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/test_vg_base.log" | tee -a "$EVI/gate.log"
    exit 1
}
echo "✅ VG Base Logic Passed" | tee -a "$EVI/gate.log"

# Evidence Index & Checksums
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p3_vg_base.sh",
  "status": "PASS",
  "timestamp": "$(date -Iseconds)"
}
EOF

cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256
