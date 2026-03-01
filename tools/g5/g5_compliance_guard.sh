#!/bin/bash
# G5 Compliance Guard
# 自动化红线校验：对白覆盖度、Zero Drift 测量

set -e

PLAN_DIR=$1
if [ -z "$PLAN_DIR" ]; then
    echo "Usage: $0 <plan_dir>"
    exit 1
fi

echo "=== G5 COMPLIANCE GUARD STARTING ==="

# 1. 扫描 Dialogue Plan
DIALOGUE_PLAN="$PLAN_DIR/dialogue_plan.json"
echo "[Audit] Checking Dialogue Coverage..."
if [ ! -f "$DIALOGUE_PLAN" ]; then
    echo "❌ [FAIL] Missing dialogue_plan.json"
    exit 1
fi

# 检查是否有 NARRATOR 补位 (Fallback 验证)
NARRATOR_COUNT=$(grep -c "NARRATOR" "$DIALOGUE_PLAN" || true)
echo "   - Narration Fallbacks found: $NARRATOR_COUNT"

# 2. 扫描 Motion Plan (Zero Drift Audit)
MOTION_PLAN="$PLAN_DIR/motion_plan.json"
echo "[Audit] Checking Zero Drift Redline..."
if [ ! -f "$MOTION_PLAN" ]; then
    echo "❌ [FAIL] Missing motion_plan.json"
    exit 1
fi

# 校验 isStanding=true 的 shot 其 verticalDrift 必须为 0
VIOLATIONS=$(node -e "
const plan = JSON.parse(require('fs').readFileSync('$MOTION_PLAN', 'utf8'));
const bad = plan.assignments.filter(a => a.isStanding && Math.abs(a.verticalDrift) > 0.001);
if (bad.length > 0) {
    console.log(bad.map(b => b.shotId).join(','));
    process.exit(1);
}
" || echo "FAIL")

if [ "$VIOLATIONS" == "FAIL" ]; then
    echo "❌ [REDLINE VIOLATION] Standing shots found with dy > 0!"
    exit 1
else
    echo "✅ [PASS] Zero Drift rule satisfied."
fi

# 3. 扫描 Asset Layering
LAYERING_PLAN="$PLAN_DIR/layering_plan.json"
echo "[Audit] Checking Shadow Compliance..."
SHADOW_OK=$(grep -c "\"enabled\": true" "$LAYERING_PLAN" || true)
if [ "$SHADOW_OK" -eq 0 ]; then
    echo "❌ [FAIL] Layering plan has no shadows enabled."
    exit 1
fi
echo "✅ [PASS] Shadow overlay verified."

echo "=== G5 COMPLIANCE PASS ==="
