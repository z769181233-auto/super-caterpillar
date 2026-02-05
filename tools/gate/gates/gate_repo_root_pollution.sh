#!/usr/bin/env bash
set -euo pipefail
# Stability Gate: Repo Root Pollution Check
# Fail if any *.log or *.pid exists at repo root (prevents IDE overload + process chaos)

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Find pollution HITS, excluding standard ignore files
HITS="$(find . -maxdepth 1 \( -name "*.log" -o -name "*.pid" \) ! -name ".cursorignore" ! -name ".gitignore" -print 2>/dev/null | sed 's|^\./||' || true)"

if [[ -n "${HITS:-}" ]]; then
  echo "❌ FAIL: repo root pollution detected (*.log/*.pid). Move logs to logs/ and pids to .data/pids/"
  echo "$HITS"
  exit 1
fi

echo "✅ PASS: repo root is clean (no *.log/*.pid)."
