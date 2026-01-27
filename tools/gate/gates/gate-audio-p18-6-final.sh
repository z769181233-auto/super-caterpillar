#!/bin/bash
set -e

# P18-6 Final Gate
# Focus: Production Readiness, Auditing and Performance.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_6_final_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-6 Final Production Readiness"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="p18_final_key"

cat > tools/ops/test_p18_6_final.ts <<EOF
import { AudioService } from '../../apps/api/src/audio/audio.service';

// Mock OpsMetricsService
const mockMetrics = {
    incrementAudioPreview: () => {},
    incrementAudioVendorCall: () => {},
    incrementAudioCacheHit: () => {},
    incrementAudioCacheMiss: () => {}
} as any;

async function test() {
    const svc = new AudioService(mockMetrics);
    
    console.log("--- AUDIT & ROUTING CHECK ---");
    const res1 = await svc.generateAndMix({
        text: "Audit check",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'bgm_lib_v2_com' }
    });
    console.log("Lib Source: " + res1.signals.bgm_library_id_source);
    if (!res1.signals.bgm_library_id_requested) throw new Error("Missing requested signal");
    if (res1.signals.bgm_library_id_source !== 'project') throw new Error("Audit Source fail");

    console.log("\n--- PREVIEW & PERFORMANCE CHECK ---");
    const t0 = Date.now();
    const preview = await svc.generateAndMix({
        text: "Very long text that would usually take seconds to synthesize completely.",
        preview: true,
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    });
    const dPreview = Date.now() - t0;
    console.log("Preview Latency: " + dPreview + "ms");
    console.log("Preview Duration (mixed): " + (preview.voice.meta.durationMs / 1000) + "s");
    
    if (preview.voice.meta.durationMs > 3100) throw new Error("Preview capping failed in meta");

    console.log("\n--- CACHE HIT CHECK ---");
    const t1 = Date.now();
    await svc.generateAndMix({
        text: "Audit check",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'bgm_lib_v2_com' }
    });
    const dCache = Date.now() - t1;
    console.log("Cache Hit Latency: " + dCache + "ms");
    if (dCache > 250) throw new Error("Cache hit too slow");

    console.log("\n[PASS] P18-6 Production Readiness Verified.");
}
test().catch(e => { console.error(e); process.exit(1); });
EOF

npx ts-node -T tools/ops/test_p18_6_final.ts > "$EVIDENCE_DIR/stdout.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ GATE PASS: $EVIDENCE_DIR"
    cat "$EVIDENCE_DIR/stdout.log"
else
    echo "❌ GATE FAIL"
    cat "$EVIDENCE_DIR/stdout.log"
    exit 1
fi
rm tools/ops/test_p18_6_final.ts
