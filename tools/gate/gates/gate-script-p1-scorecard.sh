#!/bin/bash
set -euo pipefail

# Script P1 Scorecard Gate
# Usage: ./gate-script-p1-scorecard.sh [shot_spec.json]

# Setup EVI dir if not exists (for local runs)
if [ -z "${EVI:-}" ]; then
    export EVI="docs/_evidence/manual_run_score_$(date +%s)"
    mkdir -p "$EVI"
fi

echo "Running Script P1 Scorecard..."
echo "Evidence Dir: $EVI"

node tools/script_gates/p1_scorecard.js "$@"
