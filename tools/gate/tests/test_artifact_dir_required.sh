#!/usr/bin/env bash
# Week 3 负测：验证未设置 ARTIFACT_DIR 时 Gate 失败

set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "=== Negative Test: ARTIFACT_DIR Required ==="

# 强制 ENGINE_REAL=1（启用真引擎模式）
export ENGINE_REAL=1

# 刻意不设置 ARTIFACT_DIR
unset ARTIFACT_DIR || true

# 预期：启动 gates 直接失败（退出码非 0）
echo "Running run_launch_gates.sh without ARTIFACT_DIR..."
if bash tools/gate/run_launch_gates.sh 2>&1 | head -n 50; then
  echo ""
  echo "❌ FAIL: expected run_launch_gates.sh to fail when ARTIFACT_DIR missing"
  exit 1
else
  EXIT_CODE=$?
  echo ""
  echo "✅ OK: run_launch_gates.sh failed as expected (exit code: $EXIT_CODE)"
  echo "✅ Negative test PASSED: missing ARTIFACT_DIR correctly triggers failure"
  exit 0
fi
