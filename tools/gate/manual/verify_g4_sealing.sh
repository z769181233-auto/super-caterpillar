#!/bin/bash
set -e

# PLAN-G4-REAL-FIX: Industrial Sealing Runner (13-Artifact Package)
# Usage: ./tools/gate/manual/verify_g4_sealing.sh

TS=$(date +%Y%m%d_%H%M%S)
EVI_BASE="docs/_evidence/phase_g4_real_e0001_final_$TS"
STORY_SOURCE="docs/story_bank/season_novel_01/E0001.story.json"

echo "=== G4 Industrial REAL-FIX Sealing Started ==="
echo "Evidence Dir: $EVI_BASE"
mkdir -p "$EVI_BASE"

# 1) Plan Generation
echo "[1/4] Compiling Industrial Render Plan..."
node tools/script_compiler/story_to_shot_skeleton.js "$STORY_SOURCE" "$EVI_BASE/E0001_skeleton.shot.json"
node tools/novel_ingest/simple_writer_stub.js "$EVI_BASE/E0001_skeleton.shot.json" "$EVI_BASE/E0001_full.shot.json"
node tools/script_compiler/shot_to_render_plan.js "$EVI_BASE/E0001_full.shot.json" "$EVI_BASE/E0001.render_plan.json" "$EVI_BASE"

# 2) Assets & Skeleton Pre-Audit
echo "[2/4] Executing Industrial Pre-Audits..."
node tools/gate/gates/gate_asset_integrity.js "$EVI_BASE/E0001.render_plan.json"
mv asset_binding_report.json "$EVI_BASE/"

# 3) Dual 2.5D Real Rendering
echo "[3/4] Executing Industrial 2.5D Rendering (R1 & R2)..."
node tools/renderer/unreal_executor.js "$EVI_BASE/E0001.render_plan.json" "$EVI_BASE/preview_real_R1.mp4" "$EVI_BASE" "R1"
node tools/renderer/unreal_executor.js "$EVI_BASE/E0001.render_plan.json" "$EVI_BASE/preview_real_R2.mp4" "$EVI_BASE" "R2"

# 4) The Hard Redlines (CI Gates)
echo "[4/4] Executing Final Redline Gates..."

# A. Frame Count (Alignment)
node tools/gate/gates/gate_real_render_framecount.js "$EVI_BASE/preview_real_R1.mp4" 351 "$EVI_BASE/framecount_report.json"

# B. Motion Intensity (Non-Static)
node tools/gate/gates/gate_real_render_motion.js "$EVI_BASE/preview_real_R1.mp4" "$EVI_BASE/motion_assert_report.json"

# C. Shot Change Coverage
node tools/gate/gates/gate_real_render_shotchange.js "$EVI_BASE/frame_manifest_R1.json" "$EVI_BASE/shot_change_report.json"

# D. Determinism (R1=R2)
node tools/gate/gates/gate_real_render_determinism.js \
    "$EVI_BASE/frame_manifest_R1.json" \
    "$EVI_BASE/frame_manifest_R2.json" \
    "$EVI_BASE/preview_real_R1.mp4" \
    "$EVI_BASE/preview_real_R2.mp4"
mv determinism_report.json "$EVI_BASE/"

# --- GENERATE EVIDENCE_INDEX.json (13 Artifacts) ---
echo "Locking 13-artifact Evidence Index..."
cat <<EOF > "$EVI_BASE/EVIDENCE_INDEX.json"
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "novel": "表姑娘又又又又跑了",
  "episode": "E0001",
  "compliance": "PLAN-G4-REAL-FIX",
  "artifacts": {
    "preview_real_R1.mp4": "$(shasum -a 256 "$EVI_BASE/preview_real_R1.mp4" | awk '{print $1}')",
    "preview_real_R2.mp4": "$(shasum -a 256 "$EVI_BASE/preview_real_R2.mp4" | awk '{print $1}')",
    "preview_ffprobe_R1.json": "$(shasum -a 256 "$EVI_BASE/preview_ffprobe_R1.json" | awk '{print $1}')",
    "preview_ffprobe_R2.json": "$(shasum -a 256 "$EVI_BASE/preview_ffprobe_R2.json" | awk '{print $1}')",
    "resolve_report.json": "$(shasum -a 256 "$EVI_BASE/resolve_report.json" | awk '{print $1}')",
    "asset_binding_report.json": "$(shasum -a 256 "$EVI_BASE/asset_binding_report.json" | awk '{print $1}')",
    "frame_continuity_report.json": "$(shasum -a 256 "$EVI_BASE/frame_continuity_report.json" | awk '{print $1}')",
    "framecount_report.json": "$(shasum -a 256 "$EVI_BASE/framecount_report.json" | awk '{print $1}')",
    "motion_assert_report.json": "$(shasum -a 256 "$EVI_BASE/motion_assert_report.json" | awk '{print $1}')",
    "shot_change_report.json": "$(shasum -a 256 "$EVI_BASE/shot_change_report.json" | awk '{print $1}')",
    "frame_manifest_R1.json": "$(shasum -a 256 "$EVI_BASE/frame_manifest_R1.json" | awk '{print $1}')",
    "frame_manifest_R2.json": "$(shasum -a 256 "$EVI_BASE/frame_manifest_R2.json" | awk '{print $1}')",
    "EVIDENCE_INDEX.json": "SELF"
  },
  "verdict": {
    "0_stub": $(jq '.stubCount == 0' "$EVI_BASE/resolve_report.json"),
    "hit_rate": $(jq '.templateHitRate == 1.0' "$EVI_BASE/resolve_report.json"),
    "frame_match": $(jq '.status == "PASS"' "$EVI_BASE/framecount_report.json"),
    "motion_pass": $(jq '.status == "PASS"' "$EVI_BASE/motion_assert_report.json"),
    "determinism": $(jq '.frameMatched' "$EVI_BASE/determinism_report.json")
  }
}
EOF

# Final ZIP Export
echo "[5/5] Exporting Final Industrial Package..."
ZIP_NAME="G4_Sealing_E0001_Final_$(date +%H%M).zip"
zip -j "$ZIP_NAME" "$EVI_BASE"/*

echo "=== ✅ G4 INDUSTRIAL SEALING SUCCESS ==="
echo "Evidence Box: $EVI_BASE"
echo "Delivery Zip: brain/$ZIP_NAME"
