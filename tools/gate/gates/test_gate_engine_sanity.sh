#!/usr/bin/env bash
# test_gate_engine_sanity.sh
# 测试 gate_engine_sanity.sh 的辅助脚本
# 用于在本地快速验证 Gate 逻辑

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATE_SCRIPT="$PROJECT_ROOT/tools/gate/gates/gate_engine_sanity.sh"

echo "========================================="
echo "Testing gate_engine_sanity.sh"
echo "========================================="
echo ""

# --- Test Case 1: Mock Output (应该 FAIL，因为文件太小) ---
echo "[Test 1] Mock Output (Expected: FAIL - File too small)"
MOCK_FILE="$PROJECT_ROOT/.data/storage/temp/gates/mock_shot_render.png"

if [ -f "$MOCK_FILE" ]; then
    OUTPUT_FILE="$MOCK_FILE" \
    EXPECTED_MIN_SIZE=102400 \
    bash "$GATE_SCRIPT" && echo "✅ Test 1 Unexpectedly PASSED" || echo "✅ Test 1 Failed as Expected (Mock is too small)"
else
    echo "⚠️  Mock file not found, skipping Test 1"
fi

echo ""
echo "========================================="

# --- Test Case 2: Real Video (需要用户提供) ---
echo "[Test 2] Real Video (User-provided)"
echo "To test with a real video:"
echo ""
echo "  OUTPUT_FILE=/path/to/real/video.mp4 \\"
echo "  EXPECTED_MIN_SIZE=102400 \\"
echo "  EXPECTED_DURATION=5 \\"
echo "  EXPECTED_FPS=24 \\"
echo "  bash $GATE_SCRIPT"
echo ""
echo "========================================="
