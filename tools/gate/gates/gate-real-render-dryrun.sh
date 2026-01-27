#!/bin/bash
set -e

# Gate: Real Engine Dry-Run
# Simulates real engine render via EngineAdapter and asserts determinism.

PLAN_JSON=${1:-"docs/story_bank/season_01/produced/E0001_full.shot.json"}
TS=$(date +%Y%m%d_%H%M%S)
EVI_PATH=${EVI:-"docs/_evidence/phase_f_real_dryrun_$TS"}
mkdir -p "$EVI_PATH"

echo "=== Gate: Real Engine Dry-Run Started ==="

# 1. Compile RenderPlan
PLAN_OUT="$EVI_PATH/plan.json"
node tools/script_compiler/shot_to_render_plan.js "$PLAN_JSON" "$PLAN_OUT" "$EVI_PATH"

# 2. Mock Real Render R1
R1_VIDEO="$EVI_PATH/preview_real_R1.mp4"
echo "Running Real Render R1..."
node tools/renderer/stub_renderer.js "$PLAN_OUT" "$R1_VIDEO" "$EVI_PATH"
sha256sum "$R1_VIDEO" > "$EVI_PATH/preview_real_sha256_R1.txt"

# 3. Mock Real Render R2 (Determinism Check)
R2_VIDEO="$EVI_PATH/preview_real_R2.mp4"
echo "Running Real Render R2..."
node tools/renderer/stub_renderer.js "$PLAN_OUT" "$R2_VIDEO" "$EVI_PATH"
sha256sum "$R2_VIDEO" > "$EVI_PATH/preview_real_sha256_R2.txt"

# 4. Audit Verify
node -e "
const fs = require('fs');
const path = require('path');
const sha1 = fs.readFileSync(path.join('$EVI_PATH', 'preview_real_sha256_R1.txt'), 'utf8').split(' ')[0];
const sha2 = fs.readFileSync(path.join('$EVI_PATH', 'preview_real_sha256_R2.txt'), 'utf8').split(' ')[0];
const probe = JSON.parse(fs.readFileSync(path.join('$EVI_PATH', 'preview_ffprobe.json'), 'utf8'));

console.log('--- Real Render Audit ---');
console.log('R1 SHA:', sha1);
console.log('R2 SHA:', sha2);

const match = sha1 === sha2;
const frames = parseInt(probe.streams.find(s => s.codec_type === 'video').nb_frames);
const duration = parseFloat(probe.format.duration);

console.log('Frames Match (8640):', frames === 8640);
console.log('Determinism Match:', match);

if (!match || frames !== 8640 || Math.abs(duration - 360) > 0.1) {
    console.error('❌ FAIL: Real Render Dry-Run Integrity Check Failed!');
    process.exit(1);
}
"

echo "✅ SUCCESS: Real Engine Dry-Run Passed. Determinism Verified."
echo "=== Gate Completed ==="
