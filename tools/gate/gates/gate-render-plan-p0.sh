#!/bin/bash
set -e

# Gate: RenderPlan P0 Industrial Audit
# Verifies compiler output, contract versioning, and frame continuity.

TARGET_JSON=${1:-"docs/story_bank/season_01/produced/E0001_full.shot.json"}
TS=$(date +%Y%m%d_%H%M%S)
EVI_PATH=${EVI:-"docs/_evidence/phase_e_renderplan_$TS"}
mkdir -p "$EVI_PATH"

PLAN_OUT="$EVI_PATH/$(basename "$TARGET_JSON" .json).render_plan.json"

echo "=== Gate: RenderPlan P0 Audit Started ==="
echo "Target: $TARGET_JSON"
echo "Evidence: $EVI_PATH"

# 1. Run Compiler (Generates all evidence)
if ! node tools/script_compiler/shot_to_render_plan.js "$TARGET_JSON" "$PLAN_OUT" "$EVI_PATH"; then
    echo "❌ Compiler Failed!"
    exit 1
fi

# 2. Hard Assertions on Evidence
node -e "
const fs = require('fs');
const path = require('path');
const resolveReport = JSON.parse(fs.readFileSync(path.join('$EVI_PATH', 'resolve_report.json'), 'utf8'));
const continuityReport = JSON.parse(fs.readFileSync(path.join('$EVI_PATH', 'frame_continuity_report.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync('$PLAN_OUT', 'utf8'));
const spec = JSON.parse(fs.readFileSync('$TARGET_JSON', 'utf8'));

console.log('--- Audit Verification ---');
console.log('Total Frames:', plan.totalFrames);
console.log('Template Hit Rate:', (resolveReport.templateHitRate * 100).toFixed(1) + '%');
console.log('Continuity Verified:', continuityReport.continuityVerified);

const drift = Math.abs((plan.totalFrames / 24) - spec.episodeMeta.durationSec);
console.log('Duration Drift:', drift.toFixed(2) + 's');

const passed = resolveReport.passed && 
               continuityReport.continuityVerified && 
               drift <= 0.1;

if (!passed) {
    if (!resolveReport.passed) console.error('❌ FAIL: Template resolution incomplete or logic failure.');
    if (!continuityReport.continuityVerified) console.error('❌ FAIL: Frame continuity broken: ' + (continuityReport.error || 'Unknown error'));
    if (drift > 0.1) console.error('❌ FAIL: Duration drift ' + drift.toFixed(2) + 's exceeds tolerance (0.1s)');
    process.exit(1);
}
console.log('✅ P0 Audit PASSED: Integrity verified.');
"

# 3. Final Artifact list
echo "Generated Evidence Files:"
ls -F "$EVI_PATH"

echo "=== Gate Completed ==="
