#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need_env(){ [ -n "${!1:-}" ] || die "Missing required env: $1"; }

EVI="${1:?usage: drill_incident_sim.sh <evidence_dir>}"
mkdir -p "$EVI"

need_env P8_INCIDENT_INJECT_CMD
need_env P8_INCIDENT_OBSERVE_CMD
need_env P8_INCIDENT_RECOVER_CMD

sha_tool(){ command -v sha256sum >/dev/null 2>&1 && echo "sha256sum" || echo "shasum -a 256"; }

cmd_sha() { printf "%s" "$1" | $(sha_tool) | awk '{print $1}'; }

echo "INJECT_CMD_SHA256=$(cmd_sha "$P8_INCIDENT_INJECT_CMD")" > "$EVI/p8_2_inputs.txt"
echo "OBSERVE_CMD_SHA256=$(cmd_sha "$P8_INCIDENT_OBSERVE_CMD")" >> "$EVI/p8_2_inputs.txt"
echo "RECOVER_CMD_SHA256=$(cmd_sha "$P8_INCIDENT_RECOVER_CMD")" >> "$EVI/p8_2_inputs.txt"

log "[P8-2] baseline observe"
bash -lc "$P8_INCIDENT_OBSERVE_CMD" 2>&1 | tee "$EVI/p8_2_observe_baseline.log"

log "[P8-2] inject incident"
bash -lc "$P8_INCIDENT_INJECT_CMD" 2>&1 | tee "$EVI/p8_2_inject.log"

log "[P8-2] wait alert (observe loop)"
timeout_sec="${P8_INCIDENT_TIMEOUT_SEC:-180}"
interval_sec="${P8_INCIDENT_INTERVAL_SEC:-3}"
start="$(date +%s)"
triggered="0"
while true; do
  out="$(bash -lc "$P8_INCIDENT_OBSERVE_CMD" 2>&1 || true)"
  echo "$out" >> "$EVI/p8_2_observe_loop.log"
  if echo "$out" | grep -Eqi '(ALERT[_ ]?TRIGGERED|SEVERITY[:= ]P0|SEVERITY[:= ]P1)'; then
    triggered="1"; break
  fi
  now="$(date +%s)"
  [ $((now - start)) -lt "$timeout_sec" ] || break
  sleep "$interval_sec"
done

[ "$triggered" = "1" ] || die "incident alert not triggered within timeout"

log "[P8-2] recover"
bash -lc "$P8_INCIDENT_RECOVER_CMD" 2>&1 | tee "$EVI/p8_2_recover.log"

cat > "$EVI/p8_2_incident_audit.json" <<JSON
{
  "gate": "P8-2",
  "name": "incident drill",
  "status": "PASS",
  "artifacts": {
    "inputs": "p8_2_inputs.txt",
    "baseline": "p8_2_observe_baseline.log",
    "inject": "p8_2_inject.log",
    "observe_loop": "p8_2_observe_loop.log",
    "recover": "p8_2_recover.log"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

log "[P8-2] PASS"
