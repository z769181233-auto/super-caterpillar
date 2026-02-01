import { CharacterGenAdapter } from '../../apps/api/src/engines/adapters/character_gen.adapter';
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
    // RedisService constructor takes no args as per recent fix
    const redis = new RedisService();
    await redis.onModuleInit();

    // Services
    const audit = new AuditService(prisma);
    const cost = new CostLedgerService(prisma, mockBillingService);

    // Target Adapter
    const adapter = new CharacterGenAdapter(redis, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const user = await prisma.user.create({ data: { email: `char_runner_${suffix}@example.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `CharOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `CharProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    const task = await prisma.task.create({ data: { organizationId: org.id, projectId: project.id, type: 'CE_CORE_PIPELINE', status: 'RUNNING' } });
    const job = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, taskId: task.id, type: 'SHOT_RENDER', status: 'RUNNING', attempts: 1 } });

    // Base Input (Random seed/prompt to ensure uniqueness across runs)
    const baseInput: EngineInvokeInput = {
        payload: { prompt: `A warrior ${suffix}`, style: 'anime', view: 'front', seed: 12345 },
        context: {
            projectId: project.id,
            organizationId: org.id,
            userId: user.id,
            jobId: job.id,
            traceId: `trace_${suffix}`,
            attempt: 1
        },
        engineKey: 'character_gen',
        jobType: 'CHARACTER_GEN'
    };

    try {
        // --- Test 1: Stub (Success + Cache Miss) ---
        process.env.CHARACTER_GEN_PROVIDER = "stub";

        console.log("--- Run 1: Stub (Expect PNG) ---");
        const t0 = performance.now();
        const res1 = await adapter.invoke(baseInput);
        const t1 = performance.now();
        console.log(JSON.stringify(res1, null, 2));
        console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

        if (res1.status !== 'SUCCESS') { console.error("FAIL: Run 1 failed"); process.exit(1); }
        if (!res1.output.url?.startsWith('file://')) { console.error("FAIL: Run 1 missing file:// URL"); process.exit(1); }
        if (res1.output.source !== 'render') { console.error("FAIL: Run 1 source != render"); process.exit(1); }
        if (!res1.output.url.endsWith('.png')) { console.error("FAIL: Output not png"); process.exit(1); }

        // --- Test 2: Stub (Cache HIT) ---
        console.log("--- Run 2: Cache HIT (Expect Cache) ---");
        const t2 = performance.now();
        const res2 = await adapter.invoke(baseInput);
        const t3 = performance.now();
        console.log(JSON.stringify(res2, null, 2));
        console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

        if (res2.output.source !== 'cache') { console.error("FAIL: Run 2 source != cache"); process.exit(1); }
        if (res1.output.url !== res2.output.url) { console.error("FAIL: URL mismatch"); process.exit(1); }

        // --- Test 3: Remote No-Key (Expect FAIL) ---
        // Need new input to avoid cache hit from previous run
        const uniqueInput = {
            ...baseInput,
            payload: { ...baseInput.payload, seed: 99999 }
        };

        console.log("--- Run 3: Remote No-Key (Expect FAIL) ---");
        process.env.CHARACTER_GEN_PROVIDER = "replicate"; // or comfy
        const originalKey = process.env.REPLICATE_API_TOKEN;
        delete process.env.REPLICATE_API_TOKEN;
        delete process.env.COMFY_API_URL;

        const res3 = await adapter.invoke(uniqueInput);
        console.log(JSON.stringify(res3, null, 2));

        if (res3.status !== 'FAILED') { console.error("FAIL: Run 3 should fail"); process.exit(1); }
        if ((res3 as any).error?.code !== 'CHAR_NO_KEY') { console.error("FAIL: Run 3 expected CHAR_NO_KEY"); process.exit(1); }

        // Restore env
        if (originalKey) process.env.REPLICATE_API_TOKEN = originalKey;

        // Cleanup
        // Cleanup Audit & Cost
        const runLogs = await prisma.auditLog.findMany({
            where: {
                action: 'CHARACTER_GEN',
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
        redis.onModuleDestroy();

        console.log("✅ Character Gen Logic Verified");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
