#!/usr/bin/env bash
# gate-lint_budget.sh
# 强制 Lint 警告数不增长基线门禁

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[$GATE_NAME] $*"; }
GATE_NAME="LINT_BUDGET"

BASELINE=664
log "Checking Lint Warnings against Baseline ($BASELINE)..."

# 执行 lint 并提取问题数
set +e
LINT_OUTPUT=$(pnpm -w run lint 2>&1)
set -e

# 解析报告中的摘要行，例如 "✖ 656 problems (0 errors, 656 warnings)"
WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -oE "[0-9]+ warnings" | head -1 | awk '{print $1}')

if [ -z "$WARNING_COUNT" ]; then
    # 若无 warnings 文本，检查是否全部 PASS
    if echo "$LINT_OUTPUT" | grep -q "Done"; then
        WARNING_COUNT=0
    else
        log "❌ FAIL: Could not parse lint output."
        echo "$LINT_OUTPUT"
        exit 1
    fi
fi

log "Current Warnings: $WARNING_COUNT"

if [ "$WARNING_COUNT" -gt "$BASELINE" ]; then
    log "❌ FAIL: Lint warning budget exceeded! (Current: $WARNING_COUNT > Baseline: $BASELINE)"
    log "Please fix lint warnings to bring the count back within budget."
    exit 1
fi

log "✅ PASS: Lint warning budget maintained."
