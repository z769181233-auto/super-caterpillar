#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Stage8] Checking TEST_REPORT naming convention..."

INVALID=$(ls docs/TEST_REPORT_*.md 2>/dev/null | grep -vE '^docs/TEST_REPORT_STAGE[0-9]+_[A-Z0-9_]+_[0-9]{8}\.md$' || true)

if [ -n "$INVALID" ]; then
  echo "❌ Invalid TEST_REPORT naming detected:"
  echo "$INVALID"
  exit 1
fi

echo "✅ [Stage8] TEST_REPORT naming OK"

