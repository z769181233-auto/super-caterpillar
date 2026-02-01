import { DialogueOptimizationAdapter } from '../../apps/api/src/engines/adapters/dialogue_optimization.adapter';
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
    console.log("Initializing DIA Runner...");
    const prisma = new PrismaService();
    await prisma.$connect();
    const redis = new RedisService();
    await redis.onModuleInit();
    const audit = new AuditService(prisma);
    const cost = new CostLedgerService(prisma, mockBillingService);

    const adapter = new DialogueOptimizationAdapter(redis, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const user = await prisma.user.create({ data: { email: `dia_${suffix}@test.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `DiaOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `DiaProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    const job = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, type: 'NOVEL_ANALYSIS', status: 'RUNNING', attempts: 1 } });

    const baseContext = {
        projectId: project.id,
        organizationId: org.id,
        userId: user.id,
        jobId: job.id,
        traceId: `trace_dia_${suffix}`,
        attempt: 1
    };

    try {
        console.log("=== Run 1: 'I am going to check this out' (No changes) ===");
        const input1: EngineInvokeInput = {
            payload: { dialogue: `I am going to check this out. [${suffix}]`, persona: 'neutral' },
            context: baseContext,
            engineKey: 'dialogue_optimization',
            jobType: 'NOVEL_ANALYSIS'
        };
        const res1 = await adapter.invoke(input1);
        console.log("Res1:", JSON.stringify(res1.output));

        if (res1.output.diff_summary.count !== 0) throw new Error("Expected diff 0");

        console.log("=== Run 2: 'I gonna shutup' (Optimize + OOC) ===");
        const input2: EngineInvokeInput = {
            payload: { dialogue: `I gonna shutup now. [${suffix}]`, persona: 'polite' },
            context: baseContext,
            engineKey: 'dialogue_optimization',
            jobType: 'NOVEL_ANALYSIS'
        };
        const res2 = await adapter.invoke(input2);
        console.log("Res2:", JSON.stringify(res2.output));

        // Check Optimization: gonna -> going to
        if (!res2.output.optimized.includes("going to")) throw new Error("Expected 'going to'");

        // Check OOC: shutup -> OOC flag if polite
        if (!res2.output.ooc_flags.includes('RUDE_DETECTED')) throw new Error("Expected RUDE_DETECTED");

        console.log("=== Run 3: Cache Hit Verify ===");
        const res3 = await adapter.invoke(input2);
        if (res3.output.source !== 'cache') throw new Error("Expected cache hit");

        // Verify Audit & Cost
        const runLogs = await prisma.auditLog.findMany({
            where: {
                action: 'DIALOGUE_OPTIMIZATION',
                details: { path: ['traceId'], equals: baseContext.traceId }
            }
        });
        console.log(`Audit Logs: ${runLogs.length}`);
        if (runLogs.length !== 3) throw new Error(`Expected 3 audit logs, got ${runLogs.length}`);

        const costs = await prisma.costLedger.findMany({ where: { jobId: job.id } });
        console.log(`Cost Records: ${costs.length}`);
        if (costs.length < 1) throw new Error("Expected costs > 0");

        // Cleanup
        await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map(l => l.id) } } });
        await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
        await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.organization.delete({ where: { id: org.id } });
        await prisma.user.delete({ where: { id: user.id } });

        await prisma.$disconnect();
        redis.onModuleDestroy();

        console.log("✅ Dialogue Optimization Verified");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
