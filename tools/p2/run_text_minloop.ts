import { DialogueOptimizationAdapter } from '../../apps/api/src/engines/adapters/dialogue_optimization.adapter';
import { EmotionAnalysisAdapter } from '../../apps/api/src/engines/adapters/emotion_analysis.adapter';
import { CE07MemoryUpdateAdapter } from '../../apps/api/src/engines/adapters/ce07_memory_update.local.adapter';
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
    console.log("Initializing Text Minloop Runner...");
    const prisma = new PrismaService();
    await prisma.$connect();
    const redis = new RedisService();
    await redis.onModuleInit();
    const audit = new AuditService(prisma);
    const cost = new CostLedgerService(prisma, mockBillingService);

    // Instantiate Adapters
    const diaAdapter = new DialogueOptimizationAdapter(redis, audit, cost);
    const emoAdapter = new EmotionAnalysisAdapter(redis, audit, cost);
    const memAdapter = new CE07MemoryUpdateAdapter(prisma, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    // Use unique email to avoid collision if user already exists
    const user = await prisma.user.create({ data: { email: `minloop_${suffix}@test.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `MinloopOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `MinloopProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    // Create 3 separate jobs for 3 steps to avoid CostLedger dedupe (since it keys on jobId+attempt)
    const job1 = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, type: 'NOVEL_ANALYSIS', status: 'RUNNING', attempts: 1 } });
    const job2 = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, type: 'NOVEL_ANALYSIS', status: 'RUNNING', attempts: 1 } });
    const job3 = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, type: 'CE07_MEMORY_UPDATE', status: 'RUNNING', attempts: 1 } });

    // Character & Scene for Memory
    const sceneId = randomUUID();
    const charId = randomUUID();

    const baseContext = {
        projectId: project.id,
        organizationId: org.id,
        userId: user.id,
        // jobId will be overridden for each step
        traceId: `trace_minloop_${suffix}`,
        attempt: 1
    };

    try {
        console.log("=== Step 1: Dialogue Optimization ===");
        const rawDialogue = `I gonna cry so hard. [${suffix}]`;
        console.log("Input:", rawDialogue);

        const diaInput: EngineInvokeInput = {
            payload: { dialogue: rawDialogue, persona: 'polite' }, // Polite persona might flag 'cry' if mocked? No, 'gonna' -> 'going to'
            context: { ...baseContext, jobId: job1.id },
            engineKey: 'dialogue_optimization',
            jobType: 'NOVEL_ANALYSIS'
        };
        const diaRes = await diaAdapter.invoke(diaInput);
        console.log("DIA Res:", JSON.stringify(diaRes.output));

        const optimizedText = diaRes.output.optimized;
        const ooc = diaRes.output.ooc_flags;
        if (!optimizedText.includes("going to")) throw new Error("Optimization failed");

        console.log("=== Step 2: Emotion Analysis ===");
        // Unique text for cache miss
        const emoText = `${optimizedText} [${suffix}]`;
        const emoInput: EngineInvokeInput = {
            payload: { text: emoText },
            context: { ...baseContext, jobId: job2.id }, // Job 2
            engineKey: 'emotion_analysis',
            jobType: 'NOVEL_ANALYSIS'
        };
        const emoRes = await emoAdapter.invoke(emoInput);
        console.log("EMO Res:", JSON.stringify(emoRes.output));

        const emotion = emoRes.output.primary;
        // "cry" -> sad
        if (emotion !== 'sadness') throw new Error(`Expected sadness, got ${emotion}`);

        console.log("=== Step 3: Memory Update ===");
        const memInput: EngineInvokeInput = {
            payload: {
                characterId: charId,
                sceneId: sceneId,
                memoryType: 'emotion',
                content: `Experienced ${emotion} due to: ${optimizedText}`,
                projectId: project.id
            },
            context: { ...baseContext, jobId: job3.id }, // Job 3
            engineKey: 'ce07_memory_update',
            jobType: 'CE07_MEMORY_UPDATE'
        };
        const memRes = await memAdapter.invoke(memInput);
        console.log("MEM Res:", JSON.stringify(memRes.output));

        if (memRes.output.status !== 'PASS') throw new Error("Memory update failed");

        // Verify Verification Logic
        // 1. Audit Logs (3 entries)
        // Dialogue/Emotion log traceId in details. CE07 logs projectId in details (and top-level traceId which is lost if not in schema).
        // Safest to OR the conditions.
        const logs = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { details: { path: ['traceId'], equals: baseContext.traceId } },
                    { details: { path: ['projectId'], equals: project.id } }
                ]
            }
        });
        // Deduplicate logs by ID in case of overlap
        const uniqueLogIds = new Set(logs.map(l => l.id));
        console.log(`Audit Logs: ${uniqueLogIds.size}`);
        if (uniqueLogIds.size !== 3) {
            console.log("Logs found:", JSON.stringify(logs, null, 2));
            throw new Error(`Expected 3 unique audit logs, got ${uniqueLogIds.size}`);
        }

        // 2. Cost Ledger (DIA=1, EMO=1, MEM=0 -> Total 2)
        // Sum costs for all 3 jobs
        const costs1 = await prisma.costLedger.findMany({ where: { jobId: job1.id } });
        const costs2 = await prisma.costLedger.findMany({ where: { jobId: job2.id } });
        const costs3 = await prisma.costLedger.findMany({ where: { jobId: job3.id } });

        const totalCost = costs1.reduce((a, c) => a + c.costAmount, 0) +
            costs2.reduce((a, c) => a + c.costAmount, 0) +
            costs3.reduce((a, c) => a + c.costAmount, 0);

        console.log(`Total Cost: ${totalCost}`);
        if (totalCost !== 2) throw new Error(`Expected total cost 2, got ${totalCost}`);

        // Cleanup
        await prisma.auditLog.deleteMany({ where: { id: { in: logs.map(l => l.id) } } });
        await prisma.costLedger.deleteMany({ where: { OR: [{ jobId: job1.id }, { jobId: job2.id }, { jobId: job3.id }] } });
        await prisma.characterMemory.deleteMany({ where: { characterId: charId } });
        await prisma.sceneMemory.deleteMany({ where: { sceneId: sceneId } });
        await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.organization.delete({ where: { id: org.id } });
        await prisma.user.delete({ where: { id: user.id } });

        await prisma.$disconnect();
        redis.onModuleDestroy();

        console.log("✅ Text Minloop verified");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
