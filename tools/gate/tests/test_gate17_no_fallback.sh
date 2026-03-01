#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
FILE="$ROOT/tools/gate/run_launch_gates.sh"

echo "=== Negative Test: Gate17 must NOT contain artifact fallback ==="

# 任何出现这些关键词都视为违规 fallback
if grep -nE 'FOUND_MP4=|Fallback/Auto-detect|find "\$TEMP_DIR".*\.mp4|copying to \$REAL_MP4|cp "\$FOUND_MP4" "\$REAL_MP4"' "$FILE" >/dev/null; then
  echo "❌ FAIL: fallback logic detected in Gate 17"
  grep -nE 'FOUND_MP4=|Fallback/Auto-detect|find "\$TEMP_DIR".*\.mp4|copying to \$REAL_MP4|cp "\$FOUND_MP4" "\$REAL_MP4"' "$FILE" || true
  exit 1
fi

echo "✅ PASS: no fallback logic detected"
