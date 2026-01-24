#!/bin/bash
set -e

# P18-6.1: Partial Preview Gate
# Goal: Verify that preview mode produces shorter files and different SHAs.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_6_1_partial_preview_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-6.1 Partial Preview"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="p18_6_1_key"

cat > tools/ops/test_p18_6_1.ts <<EOF
import { AudioService } from '../../apps/api/src/audio/audio.service';
import { spawn } from 'child_process';

function getDuration(absPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const p = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            absPath
        ]);
        let out = '';
        p.stdout.on('data', d => out += d.toString());
        p.on('close', () => resolve(parseFloat(out)));
        p.on('error', reject);
    });
}

async function test() {
    const svc = new AudioService();
    const commonSeed = "preview_consistency_seed";

    console.log("--- GENERATING FULL ---");
    const longText = "This is a very long text to ensure the generated stub wav duration is significantly longer than three seconds for testing purposes. It needs to be long enough that deriveParams produces a duration greater than 3.0 seconds so we can verify preview capping works correctly.";
    const full = await svc.generateAndMix({
        text: longText,
        bgmSeed: commonSeed,
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    });
    const fullDur = await getDuration(full.mixed!.absPath);
    console.log("Full Duration: " + fullDur + "s");

    console.log("\n--- GENERATING PREVIEW ---");
    const preview = await svc.generateAndMix({
        text: longText,
        bgmSeed: commonSeed,
        preview: true,
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    });
    const previewDur = await getDuration(preview.mixed!.absPath);
    console.log("Preview Duration: " + previewDur + "s");

    if (previewDur > 3.1) throw new Error("Preview too long (capping failed)");
    if (previewDur >= fullDur) throw new Error("Preview duration should be shorter than full");
    if (full.mixed!.sha256 === preview.mixed!.sha256) throw new Error("SHAs should differ for preview");

    console.log("\n[PASS] P18-6.1 Partial Preview Verified.");
}
test().catch(e => { console.error(e); process.exit(1); });
EOF

npx ts-node -T tools/ops/test_p18_6_1.ts > "$EVIDENCE_DIR/stdout.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ GATE PASS: $EVIDENCE_DIR"
    cat "$EVIDENCE_DIR/stdout.log"
else
    echo "❌ GATE FAIL"
    cat "$EVIDENCE_DIR/stdout.log"
    exit 1
fi
rm tools/ops/test_p18_6_1.ts
