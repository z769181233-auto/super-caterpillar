
import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';

async function test() {
    const mockMetrics = {
        incrementAudioVendorCall: () => { },
        incrementAudioCacheHit: () => { },
        incrementAudioCacheMiss: () => { },
        incrementAudioPreview: () => { },
    } as any;
    const svc = new AudioService(mockMetrics);

    console.log("[TEST] Verifying Multi-Library Routing");

    const cases = [
        { name: "Default Library", settings: {}, expectedLib: "bgm_lib_v1" },
        { name: "Lib V2 Routing", settings: { audioBgmLibraryId: "bgm_lib_v2_com" }, expectedLib: "bgm_lib_v2_com" },
        { name: "Invalid Lib Recovery", settings: { audioBgmLibraryId: "not_exist" }, expectedLib: "bgm_lib_v1" }
    ];

    for (const c of cases) {
        console.log(`\n--- ${c.name} ---`);
        const res = await svc.generateAndMix({
            text: "Multi Lib Test",
            bgmSeed: "static_seed",
            projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, ...c.settings }
        });

        console.log(`Selected Lib: ${res.signals.bgm_library_version} (ID: ${res.signals.bgm_track_id})`);

        // P18-5.2 Validation
        // v1 tracks start with bgm_00, v2 tracks start with bgm_20
        if (c.expectedLib === 'bgm_lib_v2_com') {
            if (!res.signals.bgm_track_id.startsWith('bgm_20')) throw new Error(`Routing to V2 failed, got ${res.signals.bgm_track_id}`);
            if (res.signals.bgm_library_version !== 'v2.0.0-exp') throw new Error("Wrong version for V2");
        } else {
            if (!res.signals.bgm_track_id.startsWith('bgm_00')) throw new Error(`Routing to V1 failed, got ${res.signals.bgm_track_id}`);
            if (res.signals.bgm_library_version !== 'v1.0.0') throw new Error("Wrong version for V1");
        }

        console.log(`Passed: ${c.name}`);
    }

    // Test Override
    console.log("\n--- ENV OVERRIDE TEST ---");
    process.env.AUDIO_BGM_LIBRARY_ID_OVERRIDE = 'bgm_lib_v2_com';
    const resOverride = await svc.generateAndMix({
        text: "Override Test",
        bgmSeed: "any",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'bgm_lib_v1' }
    });
    console.log(`Observed: ${resOverride.signals.bgm_track_id}`);
    if (!resOverride.signals.bgm_track_id.startsWith('bgm_20')) throw new Error("Override failed");
    console.log("Override: OK");

    console.log("\n[PASS] Multi-Library Routing verified.");
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
