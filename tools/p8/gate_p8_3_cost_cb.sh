#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

EVI="${1:?usage: gate_p8_3_cost_cb.sh <evidence_dir>}"
mkdir -p "$EVI"

bash tools/ops/drill_cost_circuit_breaker.sh "$EVI" 2>&1 | tee "$EVI/p8_3_drill_driver.log"
test -f "$EVI/p8_3_cost_cb_audit.json" || die "missing p8_3_cost_cb_audit.json"
log "[P8-3] PASS"
