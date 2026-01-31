import { RedisService } from '../../apps/api/src/redis/redis.service';
import { ShotPreviewFastAdapter } from '../../apps/api/src/engines/adapters/shot_preview.fast.adapter';
import { ShotRenderRouterAdapter } from '../../apps/api/src/engines/adapters/shot-render.router.adapter';
import { performance } from 'perf_hooks';

// Stub Router to avoid DI complexity
const routerStub = {
    invoke: async (input: any) => {
        // Simulate latency
        await new Promise(r => setTimeout(r, 500));
        return {
            status: 'SUCCESS',
            output: {
                status: 'success',
                url: 'http://mock/image.png'
            }
        };
    },
    name: 'shot_render_router'
} as unknown as ShotRenderRouterAdapter;

async function main() {
    console.log("Initializing Redis...");
    const redis = new RedisService();
    await redis.onModuleInit();

    const adapter = new ShotPreviewFastAdapter(redis, routerStub);

    const input = {
        payload: { prompt: "Test Preview " + Date.now() },
        context: {},
        engineKey: 'shot_preview',
        jobType: 'shot_render'
    };

    console.log("--- Run 1 (Expect Render) ---");
    const t0 = performance.now();
    const res1 = await adapter.invoke(input);
    const t1 = performance.now();
    console.log(JSON.stringify(res1, null, 2));
    console.log(`Duration 1: ${Math.round(t1 - t0)}ms`);

    console.log("--- Run 2 (Expect Cache) ---");
    const t2 = performance.now();
    const res2 = await adapter.invoke(input);
    const t3 = performance.now();
    console.log(JSON.stringify(res2, null, 2));
    console.log(`Duration 2: ${Math.round(t3 - t2)}ms`);

    await redis.onModuleDestroy();

    // Verify logic
    let exitCode = 0;

    // Check Run 1
    if (res1.output.source !== 'render') {
        console.error("FAIL: Run 1 source should be 'render', got " + res1.output.source);
        exitCode = 1;
    }

    // Check Run 2
    if (res2.output.source !== 'cache') {
        console.error("FAIL: Run 2 source should be 'cache', got " + res2.output.source);
        exitCode = 1;
    }

    // Performance assertion
    if ((t3 - t2) > (t1 - t0)) {
        console.warn("WARN: Cache run was slower than Render run? (Redis latency vs Fake sleep)");
    }

    if (exitCode === 0) console.log("✅ Runner Logic Verification Passed");
    process.exit(exitCode);
}

main().catch(console.error);
