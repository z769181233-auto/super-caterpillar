#!/bin/bash
set -e

# P18-3.5: Audit Calibration Gate
# Goal: Verify provider keys and mixer_params structure.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_3_5_audit_calibration_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-3.5 Audit Calibration Patch"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="calibration_key"

# Use a temporary test script to check signals
cat > tools/ops/test_p18_3_5_calibration.ts <<EOF
import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';

async function test() {
    const svc = new AudioService();
    const res = await svc.generateAndMix({
        text: "Calibration Test",
        bgmSeed: "calibration_seed",
        projectSettings: { audioRealEnabled: true, audioBgmEnabled: true }
    });

    console.log("--- PROVIDER CHECK ---");
    console.log("VOICE_PROVIDER: " + res.voice.meta.provider);
    // @ts-ignore
    console.log("BGM_PROVIDER: " + res.signals.bgm_provider);

    console.log("--- MIXER PARAMS CHECK ---");
    console.log("DUCKING_ALGO: " + res.signals.mixer_params.ducking.algo);
    console.log("THRESHOLD: " + res.signals.mixer_params.ducking.threshold);
    
    if (res.signals.bgm_provider !== 'deterministic_bgm_v1') {
        console.error("FAIL: BGM Provider Key Mismatch");
        process.exit(1);
    }
    
    if (res.signals.mixer_params.ducking.algo !== 'sidechaincompress_v1') {
        console.error("FAIL: Mixer Params Structure Mismatch");
        process.exit(1);
    }

    console.log("[PASS] Audit Calibration Verified.");
}
test().catch(e => { console.error(e); process.exit(1); });
EOF

npx ts-node -T tools/ops/test_p18_3_5_calibration.ts > "$EVIDENCE_DIR/stdout.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ GATE PASS: $EVIDENCE_DIR"
    cat "$EVIDENCE_DIR/stdout.log"
else
    echo "❌ GATE FAIL"
    cat "$EVIDENCE_DIR/stdout.log"
    exit 1
fi
