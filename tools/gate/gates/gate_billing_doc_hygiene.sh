#!/bin/bash
# P6-1-5 Documentation Hygiene Guard
# Purpose: Prevent legacy "1 char = 1 credit" or old char counts from reappearing in docs.

set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "Checking documentation hygiene for billing units..."

# 1) Scan for "1 char = 1 credit" variations
ERRORS=$(rg -n "1\s*字符\s*=\s*1\s*Credit|计费单位：1 字符 = 1 Credit" -S docs/ 2>/dev/null || true)
if [ ! -z "$ERRORS" ]; then
  echo "❌ FAIL: Legacy billing unit '1 char = 1 credit' found in docs:"
  echo "$ERRORS"
  exit 1
fi

# 2) Scan for legacy char counts in Expected/Actual
ERRORS=$(rg -n "Expected:\s*95123|Actual:\s*95123|\"actual_total\"\s*:\s*95123" -S docs/ 2>/dev/null || true)
if [ ! -z "$ERRORS" ]; then
  echo "❌ FAIL: Legacy character counts (95123) found in reconciliation docs:"
  echo "$ERRORS"
  exit 1
fi

echo "✅ PASS: Documentation hygiene is clear."
