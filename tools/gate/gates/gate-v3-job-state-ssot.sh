#!/bin/bash
IFS=$'
	'
# gate-v3-job-state-ssot.sh
# 校验 V3_JOB_STATE_SSOT.md 中的核心进度枚举是否符合生产规范

set -e

SSOT_FILE="docs/_specs/V3_JOB_STATE_SSOT.md"
EVIDENCE_DIR="docs/_evidence/gate_v3_job_state_ssot_$(date +%Y%m%d%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

echo "[GATE] Checking V3_JOB_STATE_SSOT.md consistency..."

# 定义预期的 10 个核心 Step ID
EXPECTED_STEPS=(
    "CE06_SCAN"
    "CE06_PARSING"
    "SCENE_PERSIST"
    "CE11_SHOT_GEN"
    "SHOT_PERSIST"
    "SHOT_RENDER"
    "TIMELINE_COMPOSE"
    "VIDEO_MERGE"
    "MEDIA_SECURITY"
    "PUBLISH_HLS"
)

MISSING=0
for STEP in "${EXPECTED_STEPS[@]}"; do
    if ! grep -q "\`$STEP\`" "$SSOT_FILE"; then
        echo "❌ Missing Step: $STEP"
        MISSING=$((MISSING + 1))
    else
        echo "✅ Found Step: $STEP"
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo "❌ SSOT Verification FAILED: $MISSING steps missing."
    exit 1
fi

# 检查状态是否为 ACTIVE (使用 -F 进行固定字符串匹配)
if ! grep -qF "> **状态**: ACTIVE" "$SSOT_FILE"; then
    echo "❌ SSOT Verification FAILED: Status is not ACTIVE."
    exit 1
fi

echo "✅ SSOT Verification PASSED: All 10 steps found and status is ACTIVE."
echo "Gate Pass" > "$EVIDENCE_DIR/PASS.txt"
sha256sum "$SSOT_FILE" > "$EVIDENCE_DIR/SSOT_HASH.txt"

echo "🏆 V3_JOB_STATE_SSOT GATE PASSED."
exit 0
