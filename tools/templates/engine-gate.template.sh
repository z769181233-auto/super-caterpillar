#!/usr/bin/env bash
set -euo pipefail
# Gate Template
# usage: gate-<engine>.sh <evidence_dir>

EVI="${1:?usage: gate.sh <evidence_dir>}"
mkdir -p "$EVI"

# TODO: write assertions + evidence outputs
echo '{"status":"PASS"}' > "$EVI/gate_report.json"
