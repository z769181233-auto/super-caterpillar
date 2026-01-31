#!/bin/bash
IFS=$'
	'
set -e

# Gate: Sample SSOT Path Enforcement
# Ensures there is only ONE true sample script path in the repo.

SSOT_SAMPLE_PATH="docs/story_bank/season_01/produced/E0001_full.shot.json"
echo "=== Gate: Sample SSOT Path Enforcement Started ==="
echo "SSOT_SAMPLE_PATH=$SSOT_SAMPLE_PATH"

# 1. Count duplicates (Global search for E0001_full.shot.json, ignoring evidence and deprecated)
# Use find to search, excluding common ignored directories
DUPLICATE_SAMPLES=$(find . -name "E0001_full.shot.json" -not -path "*/_evidence/*" -not -path "*/_deprecated_samples/*" -not -path "*/node_modules/*")
DUPLICATE_COUNT=$(echo "$DUPLICATE_SAMPLES" | grep -v "^$" | wc -l | xargs)

echo "Duplicate Samples Found:"
echo "$DUPLICATE_SAMPLES"
echo "duplicate_sample_count=$DUPLICATE_COUNT"

# 2. Strong Assertion
if [ "$DUPLICATE_COUNT" -gt 1 ]; then
    echo "❌ FAIL: Duplicate sample detected! Multiple E0001_full.shot.json files found outside evidence/deprecated folders."
    echo "Conflict paths:"
    echo "$DUPLICATE_SAMPLES"
    exit 1
fi

if [ "$DUPLICATE_COUNT" -eq 0 ]; then
    echo "❌ FAIL: SSOT Sample not found at expected path: $SSOT_SAMPLE_PATH"
    exit 1
fi

echo "✅ SUCCESS: SSOT path unique and verified."
echo "=== Gate Completed ==="
