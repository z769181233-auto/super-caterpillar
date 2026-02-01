import { EngineInvokeInput } from '@scu/shared-types';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { CE05ConflictDetectorAdapter } from '../../apps/api/src/engines/adapters/ce05_conflict_detector.adapter';

import { BillingService } from '../../apps/api/src/billing/billing.service';

async function main() {
    console.log("Initializing CE05 Runner...");
    const prisma = new PrismaService();
    const redis = new RedisService();
    const audit = new AuditService(prisma);
    const billing = new BillingService(prisma);
    const cost = new CostLedgerService(prisma, billing);
    const adapter = new CE05ConflictDetectorAdapter(redis, audit, cost);

    const suffix = Math.random().toString(36).substring(7);
    const projectId = `p3_test_ce05_${suffix}`;
    const jobId = `job_ce05_${suffix}`;
    const jobId2 = `job_ce05_2_${suffix}`;
    const traceId = `trace_ce05_${suffix}`;
    const userId = 'system';
    const orgId = 'org1';

    // Ensure User, Org, Project, and Job exist (Bypass strict types for test setup)
    await (prisma as any).user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'system@scu', passwordHash: 'mock' }
    });
    await (prisma as any).organization.upsert({
        where: { id: orgId },
        update: { credits: 1000 },
        create: { id: orgId, name: 'Test Org', ownerId: userId, credits: 1000 }
    });

    await (prisma as any).project.create({
        data: {
            id: projectId,
            name: 'CE05 Test',
            ownerId: userId,
            organizationId: orgId
        }
    });

    await (prisma as any).shotJob.create({
        data: {
            id: jobId,
            projectId,
            status: 'RUNNING',
            type: 'NOVEL_ANALYSIS',
            attempts: 1,
            organizationId: orgId
        }
    });

    await (prisma as any).shotJob.create({
        data: {
            id: jobId2,
            projectId,
            status: 'RUNNING',
            type: 'NOVEL_ANALYSIS',
            attempts: 1,
            organizationId: orgId
        }
    });

    const baseContext = {
        projectId,
        userId,
        traceId,
        jobId,
        organizationId: orgId
    };

    try {
        console.log("=== Test Case 1: Active Conflict ===");
        const res1 = await adapter.invoke({
            jobType: 'NOVEL_ANALYSIS',
            engineKey: 'ce05_conflict_detector',
            payload: { text: "They argued and shouted all night." },
            context: baseContext
        });
        console.log("Res1:", JSON.stringify(res1, null, 2));
        if (!res1.output?.analysis.conflict_detected) throw new Error("Expected conflict_detected: true");

        console.log("=== Test Case 2: Calm Passage ===");
        const res2 = await adapter.invoke({
            jobType: 'NOVEL_ANALYSIS',
            engineKey: 'ce05_conflict_detector',
            payload: { text: "The water was still." },
            context: { ...baseContext, traceId: `trace_ce05_2_${suffix}`, jobId: jobId2 }
        });
        console.log("Res2:", JSON.stringify(res2, null, 2));
        if (res2.output?.analysis.conflict_detected) throw new Error("Expected conflict_detected: false");

        console.log("✅ CE05 Verified");
        process.exit(0);
    } catch (e) {
        console.error("❌ CE05 Verification Failed", e);
        process.exit(1);
    }
}

main();
