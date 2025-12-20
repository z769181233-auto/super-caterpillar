#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Stage7] Checking TEST_REPORT existence..."

REPORTS=$(ls docs/TEST_REPORT_*.md 2>/dev/null || true)

if [ -z "$REPORTS" ]; then
  echo "❌ No TEST_REPORT found under docs/"
  echo "❌ Every feature MUST include a test report."
  exit 1
fi

echo "✅ [Stage7] Test report(s) found:"
echo "$REPORTS"

