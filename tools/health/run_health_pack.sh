#!/usr/bin/env bash
set -euo pipefail

EVID_ROOT="docs/_evidence"
TS=$(date +%Y%m%d_%H%M%S)
OUT="$EVID_ROOT/HEALTH_$TS"
mkdir -p "$OUT"

echo "== DEAD CODE =="
npx ts-prune > "$OUT/dead_code.log" || true

echo "== CONSOLE LOG =="
rg -n "console\.(log|warn|error|debug|info)\(" apps packages tools > "$OUT/console.log" || true

echo "== CIRCULAR DEPS =="
npx madge apps/api/src --circular > "$OUT/circular.log" || true

echo "== MODULE DEPTH =="
npx madge apps/api/src --json > "$OUT/madge.json"

node tools/health/compute_health_index.js "$OUT"

echo "$OUT"
