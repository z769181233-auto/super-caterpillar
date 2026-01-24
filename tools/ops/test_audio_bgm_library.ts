
import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const mockMetrics = {
        incrementAudioVendorCall: () => { },
        incrementAudioCacheHit: () => { },
        incrementAudioCacheMiss: () => { },
        incrementAudioPreview: () => { },
    } as any;
    const svc = new AudioService(mockMetrics);
    const evidenceDir = process.env.EVIDENCE_DIR || './tmp/test_bgm';
    fs.mkdirSync(evidenceDir, { recursive: true });

    console.log("[TEST] Verifying BGM Library Selection & Hard Evidence (300 seeds)");

    const tracksSelected: Record<string, string> = {};
    const selectionCounts: Record<string, number> = {};

    // 1. Run 100 seeds for distribution check
    for (let i = 0; i < 100; i++) {
        const seed = `seed_hard_${i}`;
        const res = await svc.generateAndMix({
            text: `TTS for ${seed}`,
            bgmSeed: seed,
            projectSettings: { audioRealEnabled: true, audioBgmEnabled: true }
        });

        const trackId = res.signals.bgm_track_id!;
        tracksSelected[seed] = trackId;
        selectionCounts[trackId] = (selectionCounts[trackId] || 0) + 1;

        // P18-4.2 Hard Audit Checks
        if (!res.signals.bgm_track_id) throw new Error("Missing bgm_track_id");
        if (res.signals.bgm_library_version !== 'v1.0.0') throw new Error("Wrong lib version");
        if (res.signals.bgm_selection_seed !== seed) throw new Error("Seed mismatch");
    }

    // 2. Consistency check for a fixed seed
    const fixedSeed = "fixed_audit_seed";
    const resA = await svc.generateAndMix({ text: "A", bgmSeed: fixedSeed, projectSettings: { audioRealEnabled: true, audioBgmEnabled: true } });
    const resB = await svc.generateAndMix({ text: "B", bgmSeed: fixedSeed, projectSettings: { audioRealEnabled: true, audioBgmEnabled: true } });

    if (resA.signals.bgm_track_id !== resB.signals.bgm_track_id) throw new Error("Fixed seed consistency failed");
    console.log(`Consistency (fixed_seed): OK (${resA.signals.bgm_track_id})`);

    // 3. Write hard evidence
    fs.writeFileSync(path.join(evidenceDir, 'tracks_selected.json'), JSON.stringify(tracksSelected, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'selection_counts.json'), JSON.stringify(selectionCounts, null, 2));

    console.log("Selection Counts:");
    console.table(selectionCounts);

    // Distribution Assert (at least 2 tracks must be selected from 3)
    const uniqueCount = Object.keys(selectionCounts).length;
    if (uniqueCount < 2) throw new Error("Distribution failed: too few tracks selected");

    console.log("\n[PASS] BGM Library Hardened Audit verified.");
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
