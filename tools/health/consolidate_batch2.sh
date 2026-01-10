#!/usr/bin/env bash
set -euo pipefail

LATEST_HEALTH="$(ls -1dt docs/_evidence/HEALTH_20* | head -n 1)"
LATEST_PURGE="$(ls -1dt docs/_evidence/HEALTH_PURGE_20* | head -n 1)"
# Ensure we get the very latest
echo "Detected Purge: $LATEST_PURGE"

echo "Health: $LATEST_HEALTH"
echo "Purge: $LATEST_PURGE"

if [ -f "$LATEST_HEALTH/HEALTH_INDEX.json" ]; then
    cp "$LATEST_HEALTH/HEALTH_INDEX.json" "$LATEST_PURGE/HEALTH_INDEX.json"
fi

# Update Symlink
rm -f docs/_evidence/HEALTH_PURGE_LATEST
ln -s "$(basename "$LATEST_PURGE")" docs/_evidence/HEALTH_PURGE_LATEST

echo "--- METRICS ---"
cat "$LATEST_PURGE/HEALTH_INDEX.json"

echo "--- REPORT HEAD ---"
if [ -f "$LATEST_PURGE/console_batch_2.report.json" ]; then
    head -n 20 "$LATEST_PURGE/console_batch_2.report.json"
else
    echo "Report not found."
fi
