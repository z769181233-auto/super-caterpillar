#!/bin/bash
# tools/gates/gate_runtime_canonical_assert.sh
# 🛡️ 运行时口径司法级阻断器

set -e

LOG_FILE="output/train_style_v2_fresh.log"
GATE_LOG="docs/_evidence/retrain_p2a_v2/runtime/gate_runtime_canonical_assert.log"
mkdir -p docs/_evidence/retrain_p2a_v2/runtime

echo "[$(date)] --- 启动运行时口径门禁校验 ---" | tee "$GATE_LOG"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ [FAIL] 未发现训练日志: $LOG_FILE" | tee -a "$GATE_LOG"
    exit 1
fi

# 1. 检查 CUDA 污染
if grep -Ei "device_type of 'cuda'|CUDA is not available" "$LOG_FILE" > /dev/null; then
    echo "❌ [FAIL] 发现 CUDA 路径污染或警告！" | tee -a "$GATE_LOG"
    grep -Ei "device_type of 'cuda'|CUDA is not available" "$LOG_FILE" | tee -a "$GATE_LOG"
    exit 1
fi

# 2. 检查默认参数漂移
if grep -i "had defaults used instead" "$LOG_FILE" > /dev/null; then
    echo "❌ [FAIL] 发现 accelerate 默认参数漂移警告！" | tee -a "$GATE_LOG"
    grep -i "had defaults used instead" "$LOG_FILE" | tee -a "$GATE_LOG"
    exit 1
fi

# 3. 检查必备口证
if ! grep "ACCELERATE_CANONICAL=TRUE" "$LOG_FILE" > /dev/null; then
    echo "❌ [FAIL] 未发现 ACCELERATE_CANONICAL=TRUE 存证字段！" | tee -a "$GATE_LOG"
    exit 1
fi

if ! grep "DEVICE_TYPE=" "$LOG_FILE" > /dev/null; then
    echo "❌ [FAIL] 未发现 DEVICE_TYPE 存证字段！" | tee -a "$GATE_LOG"
    exit 1
fi

echo "✅ [PASS] 运行时口径完全纯净，存证字段完整。" | tee -a "$GATE_LOG"
echo "RUNTIME_CANONICAL=PASS" | tee -a "$GATE_LOG"
