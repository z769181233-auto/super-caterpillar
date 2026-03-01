#!/bin/bash
set -e

# G4/E2: Real Render Transition Verification (End-to-End)
# Usage: ./verify_e0001_sample.sh

TS=$(date +%Y%m%d_%H%M%S)
EVI_DIR="docs/_evidence/phase_g4_real_e0001_$TS"
STORY_SOURCE="docs/story_bank/season_novel_01/E0001.story.json"

echo "=== G4 Real Render Verification Started ==="
echo "Story: $STORY_SOURCE"
echo "Evidence: $EVI_DIR"

mkdir -p "$EVI_DIR"

if [ ! -f "$STORY_SOURCE" ]; then
    echo "❌ FAIL: StorySpec not found: $STORY_SOURCE"
    exit 1
fi

# 1. Story -> Shot Skeleton
echo "[1/6] Generating Shot Skeleton..."
node tools/script_compiler/story_to_shot_skeleton.js "$STORY_SOURCE" "$EVI_DIR/E0001_skeleton.shot.json"

# 2. Writer Agent (Skeleton -> Full)
echo "[2/6] Running Writer Agent..."
node tools/novel_ingest/simple_writer_stub.js "$EVI_DIR/E0001_skeleton.shot.json" "$EVI_DIR/E0001_full.shot.json"

# 3. Gates: Lint & Scorecard
echo "[3/6] Executing P0/P1 Gates..."
export EVI="$EVI_DIR"
node tools/script_gates/p0_lint.js "$EVI_DIR/E0001_full.shot.json" "$EVI_DIR"
node tools/script_gates/p1_scorecard.js "$EVI_DIR/E0001_full.shot.json" "$EVI_DIR"

# 4. Render Plan & Cost Audit
echo "[4/6] Compiling Render Plan & Auditing Cost..."
node tools/script_compiler/shot_to_render_plan.js "$EVI_DIR/E0001_full.shot.json" "$EVI_DIR/E0001.render_plan.json" "$EVI_DIR"
bash tools/gate/gates/gate-cost-budget.sh "$EVI_DIR/cost_estimate.json" docs/budgets/season_01_budget.json

# 5. Asset Integrity Gate (Real Pack Check)
echo "[5/6] Verifying Asset Integrity (0 Missing Assertion)..."
node tools/gate/gates/gate_asset_integrity.js "$EVI_DIR/E0001.render_plan.json"
mv asset_binding_report.json "$EVI_DIR/"

# 6. Real Rendering (Two runs for Determinism)
echo "[6/6] Executing Real Engine Render (R1 & R2)..."
node tools/renderer/unreal_executor.js "$EVI_DIR/E0001.render_plan.json" "$EVI_DIR/preview_real_R1.mp4" "$EVI_DIR"
node tools/renderer/unreal_executor.js "$EVI_DIR/E0001.render_plan.json" "$EVI_DIR/preview_real_R2.mp4" "$EVI_DIR"

# Final Assertions
echo "Running Real-Render Assertions..."
node tools/gate/gates/gate_real_render_assert.js "$EVI_DIR/preview_real_R1.mp4" "$EVI_DIR/real_render_assert_report.json"
node tools/gate/gates/gate_real_render_determinism.js \
    "$EVI_DIR/render_frame_manifest.json" \
    "$EVI_DIR/render_frame_manifest.json" \
    "$EVI_DIR/preview_real_R1.mp4" \
    "$EVI_DIR/preview_real_R2.mp4"
mv render_determinism_report.json "$EVI_DIR/"

echo "=== G4 Verification PASSED ==="
echo "Report: $EVI_DIR/real_render_assert_report.json"
echo "Preview: $EVI_DIR/preview_real_R1.mp4"
