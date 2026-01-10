#!/usr/bin/env bash
set -euo pipefail

# Recover EVID
HP_EVID="docs/_evidence/HEALTH_PURGE_LATEST"
REAL_PATH=$(python3 -c "import os; print(os.path.realpath('$HP_EVID'))")
echo "[HP_EVID]=$HP_EVID (-> $REAL_PATH)"

# 1) Generate Full Manifest
echo "Generating Manifest..."
node tools/health/gen_deadcode_manifest.mjs \
  --in "$HP_EVID/ts_prune.log" \
  --out "$HP_EVID/deadcode_manifest_batch3.json"

# 2) Select Batch 3 (Next 30 from the fresh manifest)
echo "Selecting Batch 3..."
node tools/health/select_manifest_batch.mjs \
  --in "$HP_EVID/deadcode_manifest_batch3.json" \
  --out "$HP_EVID/deadcode_batch_3.json" \
  --limit 30

# 3) Purge
echo "Purging..."
npx tsx tools/health/purge_deadcode_batch.ts \
  --in "$HP_EVID/deadcode_batch_3.json" \
  --report "$HP_EVID/deadcode_batch_3.report.json"

echo "Done."
cat "$HP_EVID/deadcode_batch_3.report.json"
