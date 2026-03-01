#!/usr/bin/env bash
set -euo pipefail

echo "[GATE-D] Verifying Canon Guard authenticity..."

# 1. 禁止 Mock/Random
if rg -i "simulate|mock|random|tail" packages/canon-guard/index.ts; then
  echo "❌ FAIL: Canon Guard contains simulation or mock logic."
  exit 2
fi

# 2. 检查关键输出断言
if ! grep -q "shot_gate_report_" apps/workers/src/processors/shot-render.processor.ts; then
  echo "❌ FAIL: Processor missing gate report generation."
  exit 2
fi

if ! grep -q "genCrops200" packages/canon-guard/index.ts; then
  echo "❌ FAIL: Canon Guard missing crop generation logic."
  exit 1
fi

echo "✅ PASS: Canon Guard verified as Real/Industrial."
