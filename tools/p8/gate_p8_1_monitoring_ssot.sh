#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

EVI="${1:?usage: gate_p8_1_monitoring_ssot.sh <evidence_dir>}"
mkdir -p "$EVI"

[ -f docs/_specs/MONITORING_SSOT.json ] || die "missing docs/_specs/MONITORING_SSOT.json"

PLAN_JSON="$EVI/p8_1_alert_plan.json"
bash tools/ops/configure_alerts.sh "$PLAN_JSON" 2>&1 | tee "$EVI/p8_1_configure_alerts.log"

# Strict validity checks
test -s "$PLAN_JSON" || die "empty alert plan"
node -e "JSON.parse(require('fs').readFileSync('$PLAN_JSON','utf8'))" >/dev/null 2>&1 || die "invalid JSON plan"

cat > "$EVI/p8_1_monitoring_audit.json" <<JSON
{
  "gate": "P8-1",
  "name": "production monitoring ssot",
  "status": "PASS",
  "mode": "${P8_MONITORING_MODE:-plan}",
  "artifacts": {
    "ssot": "docs/_specs/MONITORING_SSOT.json",
    "plan": "p8_1_alert_plan.json",
    "log": "p8_1_configure_alerts.log"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

log "[P8-1] PASS"
