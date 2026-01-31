#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# Script P0 Lint Gate
# Usage: ./gate-script-p0-lint.sh [shot_spec.json]

# Setup EVI dir if not exists (for local runs)
if [ -z "${EVI:-}" ]; then
    export EVI="docs/_evidence/manual_run_$(date +%s)"
    mkdir -p "$EVI"
fi

echo "Running Script P0 Lint..."
echo "Evidence Dir: $EVI"

node tools/script_gates/p0_lint.js "$@"
