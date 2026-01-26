#!/bin/bash
set -euo pipefail

echo "=============================================="
echo "GATE: Orchestrator V2 Audio L3 Manifest Check"
echo "=============================================="

MANIFEST_PATH="docs/ORCH_V2_AUDIO_L3_MANIFEST.json"
EVI_ROOT="docs/_evidence/orch_v2_audio_l3_20260126_221019"

if [ ! -f "$MANIFEST_PATH" ]; then
    echo "❌ Manifest not found at $MANIFEST_PATH"
    exit 1
fi

echo "✅ Manifest found."

# Verify content matches evidence
# Re-run compare script to ensure consistency
echo "Verifying SHA256 consistency..."
node tools/gate/gates/compare_r1_r2.js

echo "✅ Manifest validation SUCCESS."
