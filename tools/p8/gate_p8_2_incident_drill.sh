#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

EVI="${1:?usage: gate_p8_2_incident_drill.sh <evidence_dir>}"
mkdir -p "$EVI"

bash tools/ops/drill_incident_sim.sh "$EVI" 2>&1 | tee "$EVI/p8_2_drill_driver.log"

test -f "$EVI/p8_2_incident_audit.json" || die "missing p8_2_incident_audit.json"
log "[P8-2] PASS"
