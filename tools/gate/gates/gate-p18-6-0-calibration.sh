#!/bin/bash
IFS=$'
	'
set -e

# P18-6.0: Audit Calibration Gate
# Goal: Verify strongly typed routing and source auditing.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_6_0_audit_calibration_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-6.0 Audit Calibration"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="p18_6_0_key"

# Temporary test script
cat > tools/ops/test_p18_6_0.ts <<EOF
import { AudioService } from '../../apps/api/src/audio/audio.service';

async function test() {
    const svc = new AudioService();
    
    console.log("--- CASE: Project Routing (Valid) ---");
    const res1 = await svc.generateAndMix({
        text: "Project Test",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'bgm_lib_v2_com' }
    });
    console.log("Track: " + res1.signals.bgm_track_id);
    console.log("Requested: " + res1.signals.bgm_library_id_requested);
    console.log("Actual: " + res1.signals.bgm_library_id);
    console.log("Source: " + res1.signals.bgm_library_id_source);
    if (res1.signals.bgm_library_id_source !== 'project') throw new Error("Source should be project");

    console.log("\n--- CASE: Fallback (Invalid) ---");
    const res2 = await svc.generateAndMix({
        text: "Fallback Test",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'invalid_lib' }
    });
    console.log("Requested: " + res2.signals.bgm_library_id_requested);
    console.log("Actual: " + res2.signals.bgm_library_id);
    console.log("Source: " + res2.signals.bgm_library_id_source);
    if (res2.signals.bgm_library_id_source !== 'fallback') throw new Error("Source should be fallback");
    if (res2.signals.bgm_library_id !== 'bgm_lib_v1') throw new Error("Should fallback to v1");

    console.log("\n--- CASE: Override (Env) ---");
    process.env.AUDIO_BGM_LIBRARY_ID_OVERRIDE = 'bgm_lib_v2_com';
    const res3 = await svc.generateAndMix({
        text: "Override Test",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true, audioBgmLibraryId: 'bgm_lib_v1' }
    });
    console.log("Requested: " + res3.signals.bgm_library_id_requested);
    if (res3.signals.bgm_library_id !== 'bgm_lib_v2_com') throw new Error("Override failed");

    console.log("\n[PASS] P18-6.0 Audit Calibration Verified.");
}
test().catch(e => { console.error(e); process.exit(1); });
EOF

npx ts-node -T tools/ops/test_p18_6_0.ts > "$EVIDENCE_DIR/stdout.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ GATE PASS: $EVIDENCE_DIR"
    cat "$EVIDENCE_DIR/stdout.log"
else
    echo "❌ GATE FAIL"
    cat "$EVIDENCE_DIR/stdout.log"
    exit 1
fi
rm tools/ops/test_p18_6_0.ts
