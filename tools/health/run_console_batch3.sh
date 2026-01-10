#!/usr/bin/env bash
set -euo pipefail

# Recover EVID
HP_EVID="docs/_evidence/HEALTH_PURGE_LATEST"
REAL_PATH=$(python3 -c "import os; print(os.path.realpath('$HP_EVID'))")
echo "[HP_EVID]=$HP_EVID (-> $REAL_PATH)"

# 1) Generate Tail Manifest
echo "Generating Tail Manifest..."
rg -n "console\.log" apps packages \
  --glob "!**/*.spec.*" \
  --glob "!**/*.test.*" \
  --glob "!**/__tests__/**" \
  --glob "!**/dist/**" \
  --glob "!**/build/**" \
  --glob "!**/.next/**" \
  > "$HP_EVID/console_manifest_tail.txt" || true

COUNT=$(wc -l < "$HP_EVID/console_manifest_tail.txt")
echo "Tail Count: $COUNT"

# 2) Execute Codemod (Process all remaining, limit 600 covering restored state)
echo "Executing Restoration Sweep..."
npx tsx tools/health/codemods/replace_console_log.ts \
  --manifest "$HP_EVID/console_manifest_tail.txt" \
  --limit 600 \
  --out "$HP_EVID/console_batch_3.report.json"

echo "Report:"
cat "$HP_EVID/console_batch_3.report.json"
