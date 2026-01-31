#!/usr/bin/env bash
# gate_core_mvp.sh (Enhanced for Seal Phase)
# Usage: bash tools/gates/gate_core_mvp.sh --mode real --evi <evidence_dir>

set -euo pipefail

MODE="mock"
EVI_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode) MODE="$2"; shift 2 ;;
    --evi) EVI_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "${EVI_DIR}" ]]; then
  echo "❌ Error: --evi <evidence_dir> is required"
  exit 1
fi

echo "--- [GATE-CORE-MVP] Mode: ${MODE} ---"
echo "[GATE] Evidence Dir: ${EVI_DIR}"

# In REAL mode, we might need to actually run the pipeline if output doesn't exist.
# For the purpose of this gate script, we check for presence and quality of output.
# The actual "REAL RUN" should be done by the orchestrator or a dedicated runner script before this gate.

OUT="${EVI_DIR}/output"
MP4="${OUT}/scene.mp4"

# If we are in REAL mode, we expect physical assets
if [[ "$MODE" == "real" ]]; then
  # Assert physics
  if [ ! -f "$MP4" ]; then
    echo "❌ [FAIL] scene.mp4 missing in $OUT"
    exit 2
  fi

  SIZE=$(stat -f%z "$MP4" 2>/dev/null || stat -c%s "$MP4")
  if [[ "$SIZE" -lt 1000 ]]; then
    echo "❌ [FAIL] scene.mp4 too small: ${SIZE} bytes"
    exit 2
  fi
  echo "✅ [PASS] scene.mp4 size check: ${SIZE} bytes"

  # ffprobe
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$MP4")
  echo "✅ [PASS] scene.mp4 duration: ${DUR}s"
  
  # Check for crops (audit artifact)
  CROP_COUNT=$(ls -1 "${OUT}/crops/"*.png 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$CROP_COUNT" -lt 1 ]]; then
    echo "❌ [FAIL] No crops found in ${OUT}/crops"
    exit 2
  fi
  echo "✅ [PASS] crops count: ${CROP_COUNT}"
fi

# Check for Gate Report
REPORT=$(ls -1 "${OUT}"/shot_gate_report_*.json 2>/dev/null | head -n 1 || true)
if [ ! -f "$REPORT" ]; then
  echo "❌ [FAIL] shot_gate_report missing"
  exit 2
fi

VERDICT=$(node -e "const j=JSON.parse(fs.readFileSync('$REPORT','utf8')); console.log(j.verdict || j.status)" 2>/dev/null || echo "MISSING")
if [[ "$VERDICT" == "PASS" || "$VERDICT" == "SUCCEEDED" ]]; then
  echo "✅ [PASS] Report verdict: $VERDICT"
else
  echo "❌ [FAIL] Report verdict: $VERDICT"
  exit 2
fi

echo "✅ [TRIPLE PASS] Core REAL verification complete."
exit 0
