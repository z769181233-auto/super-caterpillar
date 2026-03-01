#!/usr/bin/env bash
set -euo pipefail

# Recover EVID
HP_EVID="docs/_evidence/HEALTH_PURGE_LATEST"
REAL_PATH=$(readlink -f "$HP_EVID" || echo "$HP_EVID")
echo "[HP_EVID]=$HP_EVID (-> $REAL_PATH)"

# 1) Generate Full Manifest
echo "Generating Manifest..."
node tools/health/gen_deadcode_manifest.mjs \
  --in "$HP_EVID/ts_prune.log" \
  --out "$HP_EVID/deadcode_manifest_batch2.json"

# 2) Select Batch 2 (Next 30? Or just "limit 30" from the fresh manifest?)
# Since previous batch was DELETED, the fresh manifest will not contain them.
# So "top 30" of the NEW manifest IS Batch 2.
echo "Selecting Batch 2..."
node tools/health/select_manifest_batch.mjs \
  --in "$HP_EVID/deadcode_manifest_batch2.json" \
  --out "$HP_EVID/deadcode_batch_2.json" \
  --limit 30

# 3) Purge
echo "Purging..."
npx tsx tools/health/purge_deadcode_batch.ts \
  --in "$HP_EVID/deadcode_batch_2.json" \
  --report "$HP_EVID/deadcode_batch_2.report.json"

echo "Done."
cat "$HP_EVID/deadcode_batch_2.report.json"
