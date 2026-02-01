import { SceneCompositionAdapter } from '../../apps/api/src/engines/adapters/scene_composition.adapter';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { RedisService } from '../../apps/api/src/redis/redis.service';
import { EngineInvokeInput } from '@scu/shared-types';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Billing
const mockBillingService = {
    consumeCredits: async () => true,
    checkBalance: async () => true,
} as any;

function createDummyPng(name: string, color: string): string {
    const tmpDir = os.tmpdir();
    const fpath = path.join(tmpDir, name);
    // Use Base64 1x1 pngs
    // Red: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
    // Blue: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
    // Green: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=

    let base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; // Default Red
    if (color === 'blue') base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    if (color === 'green') base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    fs.writeFileSync(fpath, Buffer.from(base64, 'base64'));
    return `file://${fpath}`;
}

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
    const adapter = new SceneCompositionAdapter(redis, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const user = await prisma.user.create({ data: { email: `scene_runner_${suffix}@example.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `SceneOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `SceneProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    const task = await prisma.task.create({ data: { organizationId: org.id, projectId: project.id, type: 'CE_CORE_PIPELINE', status: 'RUNNING' } });
    const job = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, taskId: task.id, type: 'SHOT_RENDER', status: 'RUNNING', attempts: 1 } });

    // Prepare Assets
    const bgUrl = createDummyPng(`bg_${suffix}.png`, 'red');
    const charUrl = createDummyPng(`char_${suffix}.png`, 'blue');

    const baseInput: EngineInvokeInput = {
        payload: {
            background_url: bgUrl,
            elements: [
                { url: charUrl, x: 10, y: 10, scale: 1 } // Overlay 'char' on 'bg'
            ]
        },
        context: {
            projectId: project.id,
            organizationId: org.id,
            userId: user.id,
            jobId: job.id,
            traceId: `trace_${suffix}`,
            attempt: 1
        },
        engineKey: 'scene_composition',
        jobType: 'SCENE_COMPOSITION'
    };

    try {
        // --- Test 1: Composite (Expect Success + Cache Miss) ---
        console.log("--- Run 1: Composite (Expect PNG) ---");
        const t0 = performance.now();
        const res1 = await adapter.invoke(baseInput);
        const t1 = performance.now();
        console.log(JSON.stringify(res1, null, 2));
        console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

        if (res1.status !== 'SUCCESS') { console.error("FAIL: Run 1 failed"); process.exit(1); }
        if (!res1.output.url?.startsWith('file://')) { console.error("FAIL: Run 1 missing file:// URL"); process.exit(1); }
        if (res1.output.source !== 'render') { console.error("FAIL: Run 1 source != render"); process.exit(1); }
        if (!res1.output.url.endsWith('.png')) { console.error("FAIL: Output not png"); process.exit(1); }

        // --- Test 2: Cache HIT ---
        console.log("--- Run 2: Cache HIT ---");
        const t2 = performance.now();
        const res2 = await adapter.invoke(baseInput);
        const t3 = performance.now();
        console.log(JSON.stringify(res2, null, 2));
        console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

        if (res2.output.source !== 'cache') { console.error("FAIL: Run 2 source != cache"); process.exit(1); }
        if (res1.output.url !== res2.output.url) { console.error("FAIL: URL mismatch"); process.exit(1); }

        // Cleanup
        // Cleanup Audit & Cost
        const runLogs = await prisma.auditLog.findMany({
            where: {
                action: 'SCENE_COMPOSITION',
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

        console.log("✅ Scene Composition Logic Verified");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
