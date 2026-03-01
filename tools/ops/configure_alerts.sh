#!/usr/bin/env bash
set -euo pipefail

log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }
need_env(){ [ -n "${!1:-}" ] || die "Missing required env: $1"; }

MODE="${P8_MONITORING_MODE:-plan}" # plan|apply
SSOT="docs/_specs/MONITORING_SSOT.json"
OUT="${1:?usage: configure_alerts.sh <output_json>}"

need node
[ -f "$SSOT" ] || die "missing $SSOT"

node - <<'NODE' "$SSOT" "$OUT"
const fs = require("fs");
const ssot = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = {
  kind: "monitoring_alert_plan",
  generated_at: new Date().toISOString(),
  ssot_version: ssot.version,
  alerts: [],
};
for (const svc of ssot.services || []) {
  for (const slo of (svc.slos || [])) {
    out.alerts.push({
      service: svc.name,
      sli: slo.sli,
      target: slo.target,
      severity: slo.severity,
      window_sec: slo.window_sec,
    });
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\n");
NODE

log "[P8-1] plan generated: $OUT"

if [ "$MODE" = "apply" ]; then
  # 0-config barrier: apply requires env command; do not echo raw cmd
  need_env P8_ALERTS_APPLY_CMD
  log "[P8-1] applying via cmd_sha256 only"
  sha="$(printf "%s" "$P8_ALERTS_APPLY_CMD" | (command -v sha256sum >/dev/null 2>&1 && sha256sum || shasum -a 256) | awk '{print $1}')"
  log "[P8-1] apply_cmd_sha256=$sha"
  bash -lc "$P8_ALERTS_APPLY_CMD"
  log "[P8-1] apply PASS"
fi
