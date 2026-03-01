#!/usr/bin/env bash
set -euo pipefail

# Find latest health index source
LATEST_HEALTH="$(ls -1dt docs/_evidence/HEALTH_20* | head -n 1)"
echo "Source Dir: $LATEST_HEALTH"

# Find latest purge dir (target)
HP_EVID="docs/_evidence/HEALTH_PURGE_LATEST"
REAL_PATH=$(readlink -f "$HP_EVID" || echo "$HP_EVID") # Fallback
echo "Target Dir: $HP_EVID (-> $REAL_PATH)"

# Copy
if [ -f "$LATEST_HEALTH/HEALTH_INDEX.json" ]; then
    cp "$LATEST_HEALTH/HEALTH_INDEX.json" "$HP_EVID/HEALTH_INDEX.final.json"
    echo "Restored HEALTH_INDEX.final.json"
else
    echo "ERROR: Source HEALTH_INDEX.json not found in $LATEST_HEALTH"
    exit 1
fi

# Verify
ls -l "$HP_EVID/HEALTH_INDEX.final.json"
cat "$HP_EVID/HEALTH_INDEX.final.json"
