#!/bin/bash
IFS=$'
	'
set -e

# Gate: Render Preview E2E - V2 Industrial Sealing
# Verifies full pipeline and asserts video metadata compliance.

TARGET_JSON=${1:-"docs/story_bank/season_01/produced/E0001_full.shot.json"}
TS=$(date +%Y%m%d_%H%M%S)
EVI_PATH=${EVI:-"docs/_evidence/phase_e_preview_$TS"}
mkdir -p "$EVI_PATH"

PLAN_OUT="$EVI_PATH/plan.json"

echo "=== Gate: Render Preview E2E Started ==="
echo "Target: $TARGET_JSON"

# 1. Compile RenderPlan (PLAN-1/2)
echo "Step 1: Compiling RenderPlan..."
node tools/script_compiler/shot_to_render_plan.js "$TARGET_JSON" "$PLAN_OUT" "$EVI_PATH"

# 2. Run Stub Renderer (PLAN-3)
PREVIEW_MP4="$EVI_PATH/preview.mp4"
echo "Step 2: Running Stub Renderer..."
node tools/renderer/stub_renderer.js "$PLAN_OUT" "$PREVIEW_MP4" "$EVI_PATH"

# 3. Assert Video Metadata (PLAN-3)
echo "Step 3: Auditing Video Metadata..."
node -e "
const fs = require('fs');
const path = require('path');
const probe = JSON.parse(fs.readFileSync(path.join('$EVI_PATH', 'preview_ffprobe.json'), 'utf8'));
const spec = JSON.parse(fs.readFileSync('$TARGET_JSON', 'utf8'));

const duration = parseFloat(probe.format.duration);
const targetDuration = spec.episodeMeta.durationSec;
const drift = Math.abs(duration - targetDuration);

const videoStream = probe.streams.find(s => s.codec_type === 'video');
const rFrameRate = videoStream.r_frame_rate; // e.g. \"24/1\"

console.log('--- Video Audit ---');
console.log('Duration:', duration.toFixed(3) + 's (Spec: ' + targetDuration + 's)');
console.log('Drift:', drift.toFixed(3) + 's');
console.log('Frame Rate:', rFrameRate);

const passed = drift <= 0.1 && (rFrameRate === '24/1' || rFrameRate === '24');

if (!passed) {
    if (drift > 0.1) console.error('❌ FAIL: Video duration drift exceeds 0.1s tolerance.');
    if (rFrameRate !== '24/1' && rFrameRate !== '24') console.error('❌ FAIL: FPS mismatch. Expected 24, got ' + rFrameRate);
    process.exit(1);
}
console.log('✅ Video Audit PASSED.');
"

# 4. Success Artifacts
sha256sum "$PREVIEW_MP4" > "$EVI_PATH/preview_sha256.txt"
echo "✅ Render Preview E2E Passed."
echo "Final Evidence at: $EVI_PATH"
echo "=== E2E Completed ==="
