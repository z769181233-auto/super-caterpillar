#!/usr/bin/env bash
set -euo pipefail

EVI_DIR="${1:-}"
if [[ -z "${EVI_DIR}" ]]; then
  echo "Usage: gate_core_mvp.sh <evidence_dir>"
  exit 2
fi

OUT="${EVI_DIR}/output"
MP4="${OUT}/scene.mp4"

echo "--- [GATE-CORE-MVP] Starting Core REAL Verification ---"

test -f "$MP4" || { echo "❌ [FAIL] scene.mp4 missing: $MP4"; exit 2; }

# 获取体积
SIZE=$(stat -f%z "$MP4" 2>/dev/null || stat -c%s "$MP4")
if [[ "$SIZE" -lt 200000 ]]; then
  echo "❌ [FAIL] scene.mp4 too small: ${SIZE} bytes (<200KB)"
  exit 2
fi
echo "✅ [PASS] scene.mp4 size: ${SIZE} bytes"

# ffprobe 验证
command -v ffprobe >/dev/null 2>&1 || { echo "❌ [FAIL] ffprobe not found"; exit 2; }
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$MP4")
python3 - <<PY
d=float("$DUR")
if d < 3.0:
    print(f"❌ [FAIL] duration too short: {d}s")
    exit(1)
print(f"✅ [PASS] duration: {d}s")
PY

# 裁片必须恰好 4 张
CROP_DIR="${OUT}/crops"
if [ ! -d "$CROP_DIR" ]; then
    echo "❌ [FAIL] crops dir missing: $CROP_DIR"
    exit 2
fi

CROP_COUNT=$(ls -1 "$CROP_DIR"/*_200.png 2>/dev/null | wc -l | tr -d ' ')
if [[ "$CROP_COUNT" -ne 4 ]]; then
  echo "❌ [FAIL] crop count must be exactly 4, got $CROP_COUNT"
  ls -la "$CROP_DIR" || true
  exit 2
fi
echo "✅ [PASS] crops count=4"

# 报告口径必须 PASS/FAIL
REPORT=$(ls -1 "${OUT}"/shot_gate_report_*.json 2>/dev/null | head -n 1 || true)
if [ ! -f "$REPORT" ]; then
    echo "❌ [FAIL] shot_gate_report missing in $OUT"
    exit 2
fi

node -e "
const fs=require('fs');
const p=process.argv[1];
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const v=j?.verdict?.status || j?.verdict || j?.status;
if (v !== 'PASS' && v !== 'FAIL') {
  console.error('❌ [FAIL] report verdict must be PASS/FAIL, got:', v);
  process.exit(2);
}
console.log('✅ [PASS] report verdict:', v);
" "$REPORT"

echo "✅ [TRIPLE PASS] Core REAL verification complete."
