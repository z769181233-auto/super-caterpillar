#!/bin/bash
set -e

# P0-RP: RenderPlan Resolve Gate
# Verifies that a ShotSpec can be compiled into a valid RenderPlan

TARGET_JSON=${1:-"docs/story_bank/season_01/produced/E0001_full.shot.json"}
EVI_PATH=${EVI:-"docs/_evidence/phase_e_renderplan_$(date +%Y%m%d_%H%M%S)"}
mkdir -p "$EVI_PATH"

PLAN_OUT="$EVI_PATH/$(basename "$TARGET_JSON" .json).render_plan.json"
REPORT_OUT="$EVI_PATH/resolve_report.json"

echo "=== P0-RP: RenderPlan Resolve Gate Started ==="
echo "Target: $TARGET_JSON"

# 1. Run Compiler
if ! node tools/script_compiler/shot_to_render_plan.js "$TARGET_JSON" "$PLAN_OUT"; then
    echo "❌ Compiler Failed!"
    exit 1
fi

# 2. Run Validation Snippet
node -e "
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync('$PLAN_OUT', 'utf8'));
const spec = JSON.parse(fs.readFileSync('$TARGET_JSON', 'utf8'));

const totalShots = plan.renderShots.length;
const stubCount = plan.renderShots.filter(s => s.templateId === 'STUB_TEMPLATE').length;
const hitRate = (totalShots - stubCount) / totalShots;

const planSec = plan.totalFrames / 24;
const specSec = spec.episodeMeta.durationSec;
const drift = Math.abs(planSec - specSec);

const report = {
    shotCount: totalShots,
    stubCount: stubCount,
    templateHitRate: hitRate,
    durationSpec: specSec,
    durationPlan: planSec,
    driftSec: drift,
    passed: hitRate === 1.0 && drift <= 5
};

fs.writeFileSync('$REPORT_OUT', JSON.stringify(report, null, 2));

if (!report.passed) {
    console.error('❌ P0-RP FAILED: hitRate=' + hitRate + ', drift=' + drift);
    process.exit(1);
} else {
    console.log('✅ P0-RP PASSED: All templates resolved, drift=' + drift + 's');
}
"

echo "Report saved to $REPORT_OUT"
echo "=== P0-RP Completed ==="
