#!/bin/bash
set -e

# G4-QA Runner: Qualitative Audit Patch
# Usage: ./tools/gate/manual/audit_g4_qa.sh <evidence_dir>

EVI_DIR="$1"
if [ -z "$EVI_DIR" ]; then
    echo "Usage: $0 <evidence_dir>"
    exit 1
fi

echo "=== G4 Industrial QA Audit Patch Started ==="
mkdir -p "$EVI_DIR/qa_visual_sheet"

# 1) Qualitative Gates
echo "[1/3] Running Qualitative Gates..."
node tools/gate/gates/gate_qa_visual_audit.js \
    "$EVI_DIR/preview_real_R2.mp4" \
    "$EVI_DIR/E0001.render_plan.json" \
    "$EVI_DIR/frame_manifest_R2.json" \
    "$EVI_DIR/qa_gate_report.json"

# 2) Visual Evidence Sheets
echo "[2/3] Generating Visual Sheets..."
chmod +x tools/gate/manual/generate_visual_sheets.sh
./tools/gate/manual/generate_visual_sheets.sh \
    "$EVI_DIR/preview_real_R2.mp4" \
    "$EVI_DIR/E0001.render_plan.json" \
    "$EVI_DIR/qa_visual_sheet"

# 3) EVIDENCE_INDEX_QA.json
echo "[3/3] Finalizing EVIDENCE_INDEX_QA.json..."
cat <<EOF > "$EVI_DIR/EVIDENCE_INDEX_QA.json"
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "auditType": "QUALITATIVE_QA_PATCH",
  "baseEvidenceDir": "$EVI_DIR",
  "artifacts": {
    "qa_gate_report.json": "$(shasum -a 256 "$EVI_DIR/qa_gate_report.json" | awk '{print $1}')",
    "contact_sheet.png": "$(shasum -a 256 "$EVI_DIR/qa_visual_sheet/contact_sheet.png" | awk '{print $1}')",
    "shot_firstframes_sheet.png": "$(shasum -a 256 "$EVI_DIR/qa_visual_sheet/shot_firstframes_sheet.png" | awk '{print $1}')"
  },
  "verdict": {
    "overlay_ratio_pass": $(jq '.assertions.overlay.passed' "$EVI_DIR/qa_gate_report.json"),
    "diversity_pass": $(jq '.assertions.diversity.passed' "$EVI_DIR/qa_gate_report.json"),
    "parallax_motion_pass": $(jq '.assertions.parallax.passed' "$EVI_DIR/qa_gate_report.json")
  }
}
EOF

echo "=== ✅ G4-QA AUDIT COMPLETED ==="
echo "Report: $EVI_DIR/EVIDENCE_INDEX_QA.json"
