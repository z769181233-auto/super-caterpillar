import { StyleTransferReplicateAdapter } from '../../apps/api/src/engines/adapters/style-transfer.replicate.adapter';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { EngineInvokeInput } from '@scu/shared-types';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

// Mock Billing
const mockBillingService = {
    consumeCredits: async () => true,
    checkBalance: async () => true,
} as any;

async function main() {
    console.log("Initializing Services...");

    // DB & Redis
    const prisma = new PrismaService();
    await prisma.$connect();
    const redis = new RedisService();
    await redis.onModuleInit();

    // Services
    const audit = new AuditService(prisma);
    const cost = new CostLedgerService(prisma, mockBillingService);

    // Target Adapter
    const adapter = new StyleTransferReplicateAdapter(redis, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const user = await prisma.user.create({ data: { email: `style_runner_${suffix}@example.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `StyleOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `StyleProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    const task = await prisma.task.create({ data: { organizationId: org.id, projectId: project.id, type: 'CE_CORE_PIPELINE', status: 'RUNNING' } });
    const job = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, taskId: task.id, type: 'SHOT_RENDER', status: 'RUNNING', attempts: 1 } }); // Use generic SHOT_RENDER type for now

    const input: EngineInvokeInput = {
        payload: { style: 'anime', image_url: `http://test.com/source_${suffix}.jpg` },
        context: {
            projectId: project.id,
            organizationId: org.id,
            userId: user.id,
            jobId: job.id,
            traceId: `trace_${suffix}`,
            attempt: 1
        },
        engineKey: 'style_transfer',
        jobType: 'STYLE_TRANSFER'
    };

    try {
        // --- Test 1: Stub (Success + Cache Miss) ---
        process.env.STYLE_TRANSFER_PROVIDER = "stub";

        console.log("--- Run 1: Stub (Expect PNG) ---");
        const t0 = performance.now();
        const res1 = await adapter.invoke(input);
        const t1 = performance.now();
        console.log(JSON.stringify(res1, null, 2));
        console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

        if (res1.status !== 'SUCCESS') { console.error("FAIL: Run 1 failed"); process.exit(1); }
        if (!res1.output.url?.startsWith('file://')) { console.error("FAIL: Run 1 missing file:// URL"); process.exit(1); }
        if (res1.output.source !== 'render') { console.error("FAIL: Run 1 source != render"); process.exit(1); }

        // --- Test 2: Stub (Cache HIT) ---
        console.log("--- Run 2: Cache HIT (Expect Cache) ---");
        const t2 = performance.now();
        const res2 = await adapter.invoke(input);
        const t3 = performance.now();
        console.log(JSON.stringify(res2, null, 2));
        console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

        if (res2.output.source !== 'cache') { console.error("FAIL: Run 2 source != cache"); process.exit(1); }
        if (res1.output.url !== res2.output.url) { console.error("FAIL: URL mismatch"); process.exit(1); }

        // --- Test 3: Replicate No-Key (Expect FAIL) ---
        console.log("--- Run 3: Replicate No-Key (Expect FAIL) ---");
        process.env.STYLE_TRANSFER_PROVIDER = "replicate";
        delete process.env.REPLICATE_API_TOKEN;

        // Use unique stale to avoid cache
        const input3 = { ...input, payload: { ...input.payload, style: 'watercolor' } }; // New style = new hash
        const res3 = await adapter.invoke(input3);
        console.log(JSON.stringify(res3, null, 2));

        if (res3.status !== 'FAILED') { console.error("FAIL: Run 3 should fail"); process.exit(1); }
        if ((res3 as any).error?.code !== 'STYLE_NO_KEY') { console.error("FAIL: Run 3 expected STYLE_NO_KEY"); process.exit(1); }

        // Cleanup
        // Cleanup Audit & Cost
        const runLogs = await prisma.auditLog.findMany({
            where: {
                action: 'STYLE_TRANSFER',
                details: { path: ['traceId'], equals: `trace_${suffix}` }
            },
            select: { id: true }
        });
        if (runLogs.length > 0) {
            await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map(l => l.id) } } });
        }
        await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
        await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
        await prisma.task.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.organization.delete({ where: { id: org.id } });
        await prisma.user.delete({ where: { id: user.id } });

        await prisma.$disconnect();
        redis.onModuleDestroy(); // Close redis

        console.log("✅ Style Transfer Logic Verified");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
