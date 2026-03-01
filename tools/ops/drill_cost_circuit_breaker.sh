#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need_env(){ [ -n "${!1:-}" ] || die "Missing required env: $1"; }

EVI="${1:?usage: drill_cost_circuit_breaker.sh <evidence_dir>}"
mkdir -p "$EVI"

need_env P8_COST_SPIKE_CMD
need_env P8_CB_STATUS_CMD
need_env P8_CB_RESET_CMD

sha_tool(){ command -v sha256sum >/dev/null 2>&1 && echo "sha256sum" || echo "shasum -a 256"; }
cmd_sha() { printf "%s" "$1" | $(sha_tool) | awk '{print $1}'; }

echo "SPIKE_CMD_SHA256=$(cmd_sha "$P8_COST_SPIKE_CMD")" > "$EVI/p8_3_inputs.txt"
echo "STATUS_CMD_SHA256=$(cmd_sha "$P8_CB_STATUS_CMD")" >> "$EVI/p8_3_inputs.txt"
echo "RESET_CMD_SHA256=$(cmd_sha "$P8_CB_RESET_CMD")" >> "$EVI/p8_3_inputs.txt"

log "[P8-3] baseline status"
bash -lc "$P8_CB_STATUS_CMD" 2>&1 | tee "$EVI/p8_3_status_baseline.log"

log "[P8-3] spike cost"
bash -lc "$P8_COST_SPIKE_CMD" 2>&1 | tee "$EVI/p8_3_spike.log"

log "[P8-3] wait circuit breaker trip"
timeout_sec="${P8_CB_TIMEOUT_SEC:-180}"
interval_sec="${P8_CB_INTERVAL_SEC:-3}"
start="$(date +%s)"
tripped="0"
while true; do
  out="$(bash -lc "$P8_CB_STATUS_CMD" 2>&1 || true)"
  echo "$out" >> "$EVI/p8_3_status_loop.log"
  if echo "$out" | grep -Eqi '(TRIPPED|CIRCUIT[_ ]?BREAKER[:= ]TRIPPED)'; then
    tripped="1"; break
  fi
  now="$(date +%s)"
  [ $((now - start)) -lt "$timeout_sec" ] || break
  sleep "$interval_sec"
done
[ "$tripped" = "1" ] || die "circuit breaker not tripped within timeout"

log "[P8-3] reset breaker"
bash -lc "$P8_CB_RESET_CMD" 2>&1 | tee "$EVI/p8_3_reset.log"

log "[P8-3] verify reset"
out2="$(bash -lc "$P8_CB_STATUS_CMD" 2>&1 || true)"
echo "$out2" > "$EVI/p8_3_status_after_reset.log"
echo "$out2" | grep -Eqi '(RESET|NORMAL|OK)' || die "breaker not reset (status not OK/NORMAL/RESET)"

cat > "$EVI/p8_3_cost_cb_audit.json" <<JSON
{
  "gate": "P8-3",
  "name": "cost circuit breaker drill",
  "status": "PASS",
  "artifacts": {
    "inputs": "p8_3_inputs.txt",
    "status_baseline": "p8_3_status_baseline.log",
    "spike": "p8_3_spike.log",
    "status_loop": "p8_3_status_loop.log",
    "reset": "p8_3_reset.log",
    "status_after_reset": "p8_3_status_after_reset.log"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

log "[P8-3] PASS"
