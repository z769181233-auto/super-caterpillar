
import { runShotRenderSDXL } from './sdxl.adapter';

async function test() {
    console.log("=== Testing No-Fallback Logic ===");

    // Case 1: Replicate without Token
    process.env.SHOT_RENDER_PROVIDER = 'replicate';
    delete process.env.REPLICATE_API_TOKEN;

    try {
        await runShotRenderSDXL({
            shotId: 'test',
            prompt: 'test',
            width: 1024,
            height: 1024,
            seed: 123,
            negative_prompt: 'bad quality',
            traceId: 'trace-1'
        });
        console.error("❌ Case 1 FAILED: Replicate did not throw exception for missing token.");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes('SHOT_RENDER_NO_FALLBACK')) {
            console.log("✅ Case 1 Passed: Replicate rejected missing token.");
        } else {
            console.error("❌ Case 1 FAILED: Wrong error message:", e.message);
            process.exit(1);
        }
    }

    // Case 2: Unknown Provider
    process.env.SHOT_RENDER_PROVIDER = 'unknown_provider_xyz';
    try {
        await runShotRenderSDXL({
            shotId: 'test',
            prompt: 'test',
            width: 1024,
            height: 1024,
            seed: 123,
            negative_prompt: 'bad quality',
            traceId: 'trace-2'
        });
        console.error("❌ Case 2 FAILED: Unknown provider did not throw exception.");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes('SHOT_RENDER_NO_FALLBACK')) {
            console.log("✅ Case 2 Passed: Unknown provider rejected.");
        } else {
            console.error("❌ Case 2 FAILED: Wrong error message:", e.message);
            process.exit(1);
        }
    }

    console.log("✅ ALL FALLBACK TESTS PASSED");
}

test();
