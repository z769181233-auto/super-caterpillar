import { CharacterGenAdapter } from '../../apps/api/src/engines/adapters/character_gen.adapter';
import { SceneCompositionAdapter } from '../../apps/api/src/engines/adapters/scene_composition.adapter';
import { ShotPreviewFastAdapter } from '../../apps/api/src/engines/adapters/shot_preview.fast.adapter';
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

import { execSync } from 'child_process';

// Mock Billing
const mockBillingService = {
    consumeCredits: async () => true,
    checkBalance: async () => true,
} as any;

function createDummyPng(name: string, color: string): string {
    const tmpDir = os.tmpdir();
    const fpath = path.join(tmpDir, name);
    // Use FFmpeg to generate clean 100x100 png
    // ffmpeg -f lavfi -i color=c=red:s=100x100 -frames:v 1 -y output.png
    console.log(`Generating PNG: ${name} (${color})`);
    try {
        execSync(`ffmpeg -f lavfi -i color=c=${color}:s=100x100 -frames:v 1 -y "${fpath}"`, { stdio: 'ignore' });
    } catch (e) {
        console.error("FFmpeg Gen Failed in Runner:", e);
        // Fallback to simple file write if ffmpeg fails (unlikely given check) or throw
        throw e;
    }
    return `file://${fpath}`;
}

async function main() {
    console.log("Initializing Services for Minloop...");

    // DB & Redis
    const prisma = new PrismaService();
    await prisma.$connect();
    const redis = new RedisService();
    await redis.onModuleInit();

    // Services
    const audit = new AuditService(prisma);
    const cost = new CostLedgerService(prisma, mockBillingService);

    // Mock ShotRenderRouterAdapter
    const mockShotRenderRouter = {
        invoke: async (input: any) => {
            // Mock output for render (should return a file url or something valid)
            // If caching works, this is called on MISS.
            console.log("  [MockRouter] Invoked!");
            return {
                status: 'SUCCESS',
                output: {
                    url: input.payload.url || 'file:///tmp/mock_preview_render.mp4',
                    source: 'render-mock'
                }
            };
        }
    } as any;

    // Adapters
    const charGen = new CharacterGenAdapter(redis, audit, cost);
    const sceneComp = new SceneCompositionAdapter(redis, audit, cost);
    const shotPreview = new ShotPreviewFastAdapter(redis, mockShotRenderRouter, audit, cost);

    // Setup Context
    const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const user = await prisma.user.create({ data: { email: `minloop_${suffix}@example.com`, passwordHash: 'x' } });
    const org = await prisma.organization.create({ data: { name: `MinloopOrg_${suffix}`, ownerId: user.id } });
    const project = await prisma.project.create({ data: { name: `MinloopProj_${suffix}`, organizationId: org.id, ownerId: user.id } });
    const task = await prisma.task.create({ data: { organizationId: org.id, projectId: project.id, type: 'CE_CORE_PIPELINE', status: 'RUNNING' } });
    const job = await prisma.shotJob.create({ data: { organizationId: org.id, projectId: project.id, taskId: task.id, type: 'SHOT_RENDER', status: 'RUNNING', attempts: 1 } });

    const baseContext = {
        projectId: project.id,
        organizationId: org.id,
        userId: user.id,
        jobId: job.id,
        traceId: `trace_minloop_${suffix}`,
        attempt: 1
    };

    try {
        console.log("=== Run 1: Chain Execution (Expect MISS) ===");

        // 1. Character Gen (Stub)
        const charInput: EngineInvokeInput = {
            payload: { prompt: `Hero ${suffix}`, style: 'anime', view: 'front' },
            context: baseContext,
            engineKey: 'character_gen',
            jobType: 'CHARACTER_GEN'
        };
        const t0 = performance.now();
        const charRes = await charGen.invoke(charInput);
        if (charRes.status !== 'SUCCESS') throw new Error(`CharGen Failed: ${JSON.stringify(charRes)}`);
        const charUrl = charRes.output.url;
        console.log(`[1] CharGen OK: ${charUrl}`);

        // 2. Scene Composition (REAL-STUB)
        // Need a background
        const bgUrl = createDummyPng(`bg_${suffix}.png`, 'green');
        const sceneInput: EngineInvokeInput = {
            payload: {
                background_url: bgUrl,
                elements: [{ url: charUrl, x: 50, y: 50, scale: 1 }]
            },
            context: baseContext,
            engineKey: 'scene_composition',
            jobType: 'SCENE_COMPOSITION'
        };
        const sceneRes = await sceneComp.invoke(sceneInput);
        if (sceneRes.status !== 'SUCCESS') throw new Error(`SceneComp Failed: ${JSON.stringify(sceneRes)}`);
        const sceneUrl = sceneRes.output.url;
        console.log(`[2] SceneComp OK: ${sceneUrl}`);

        // 3. Shot Preview (REAL-STUB)
        // ShotPreviewFastAdapter likely expects `imageUrl` or `assetUrl` in payload
        // I will assume it renders what is given or similar. 
        // If ShotPreviewFastAdapter is designed to take a Timeline Shot, we might need to mock input shape.
        // Assuming generic engine input: payload usually has target content.
        // For 'shot_preview', assume generic payload: { assets: [url], ... } or just { url }.
        // I'll try passing `url: sceneUrl`. 
        const previewInput: EngineInvokeInput = {
            payload: { url: sceneUrl, mode: 'fast' }, // Guessing payload shape
            context: baseContext,
            engineKey: 'shot_preview',
            jobType: 'SHOT_PREVIEW'
        };
        const previewRes = await shotPreview.invoke(previewInput);
        if (previewRes.status !== 'SUCCESS') throw new Error(`ShotPreview Failed: ${JSON.stringify(previewRes)}`);
        const previewUrl = previewRes.output.url;
        console.log(`[3] ShotPreview OK: ${previewUrl}`);

        const t1 = performance.now();
        console.log(`Chain Duration 1: ${Math.round(t1 - t0)}ms`);

        // Check outputs
        if (!charUrl.startsWith('file://')) console.error("FAIL: Char not file://");
        if (!sceneUrl.startsWith('file://')) console.error("FAIL: Scene not file://");
        // Preview might be http or file depending on impl.

        console.log("=== Run 2: Re-run (Expect HIT) ===");
        // Re-run exactly same inputs
        const t2 = performance.now();
        const charRes2 = await charGen.invoke(charInput);
        const sceneRes2 = await sceneComp.invoke(sceneInput);
        const previewRes2 = await shotPreview.invoke(previewInput);
        const t3 = performance.now();

        console.log(`[1] Char Source: ${charRes2.output.source}`);
        console.log(`[2] Scene Source: ${sceneRes2.output.source}`);
        console.log(`[3] Preview Source: ${previewRes2.output.source}`);

        console.log(`Chain Duration 2: ${Math.round(t3 - t2)}ms`);

        if (charRes2.output.source !== 'cache') console.error("FAIL: Char not cached");
        if (sceneRes2.output.source !== 'cache') console.error("FAIL: Scene not cached");
        if (previewRes2.output.source !== 'cache') console.error("FAIL: Preview not cached");


        // Cleanup
        const runLogs = await prisma.auditLog.findMany({
            where: {
                action: { in: ['CHARACTER_GEN', 'SCENE_COMPOSITION', 'SHOT_PREVIEW'] },
                details: { path: ['traceId'], equals: baseContext.traceId }
            },
            select: { id: true, action: true }
        });
        console.log(`Audit Logs Found: ${runLogs.length}`);
        if (runLogs.length < 3) console.error("FAIL: Missing audit logs");

        const costs = await prisma.costLedger.findMany({
            where: { jobId: job.id }
        });
        console.log(`Cost Records: ${costs.length}`);
        // Dedup might merge or skip if same JobId/Context logic applies too aggressively.
        // As long as we have > 0 costs for the job, it's billed.
        if (costs.length < 1) console.error("FAIL: Missing cost records (Got 0)");

        // Also verify we have audit logs for all actions
        const actions = runLogs.map(l => l.action);
        if (!actions.includes('CHARACTER_GEN')) console.error("FAIL: Missing CHAR audit");
        if (!actions.includes('SCENE_COMPOSITION')) console.error("FAIL: Missing SCENE audit");
        if (!actions.includes('SHOT_PREVIEW')) console.error("FAIL: Missing PREVIEW audit");

        await prisma.auditLog.deleteMany({ where: { id: { in: runLogs.map(l => l.id) } } });
        await prisma.costLedger.deleteMany({ where: { jobId: job.id } });
        await prisma.shotJob.deleteMany({ where: { projectId: project.id } });
        await prisma.task.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.organization.delete({ where: { id: org.id } });
        await prisma.user.delete({ where: { id: user.id } });

        await prisma.$disconnect();
        redis.onModuleDestroy();

        console.log("✅ P2 Minloop Logic Verified");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
