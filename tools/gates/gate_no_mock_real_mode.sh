#!/usr/bin/env bash
set -euo pipefail

REAL="tools/production/p3prime_core_mvp_runner_real.ts"
DISP="tools/production/p3prime_core_mvp_runner.ts"

test -f "$REAL" || { echo "[GATE-NO-MOCK] FAIL: missing $REAL"; exit 2; }
test -f "$DISP" || { echo "[GATE-NO-MOCK] FAIL: missing $DISP"; exit 2; }

echo "[GATE-NO-MOCK] Auditing $REAL for forbidden keywords..."

# 1) real runner 禁止关键词 (mock, dummy, simulate)
if grep -Ei "(mock|dummy|simulate)" "$REAL"; then
  echo "[GATE-NO-MOCK] FAIL: forbidden keywords (mock/dummy/simulate) found in real runner"
  exit 2
fi

# 2) dispatcher 禁止静态引入 dev (必须动态 import)
echo "[GATE-NO-MOCK] Auditing $DISP for static dev imports..."
if grep -n "from[[:space:]]\+[\"']\.\/p3prime_core_mvp_runner_dev[\"']" "$DISP"; then
  echo "[GATE-NO-MOCK] FAIL: dev runner imported statically in dispatcher"
  exit 2
fi

echo "[GATE-NO-MOCK] PASS"
