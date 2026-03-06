#!/usr/bin/env bash
set -euo pipefail

# P6-2 Error Matrix Gateway (HARDENED)
# Goals: Verify financial consistency and error attribution under fault injection.

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODE="${1:-run}"   # run|dry
TS="$(date +%Y%m%d_%H%M%S)"
EVI="docs/_evidence/p6_2_error_matrix_${TS}"
mkdir -p "$EVI"

echo "[P6-2] EVI=$EVI" | tee "$EVI/EVI.txt"

# ---- timeouts (avoid hanging) ----
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-3}"
# statement_timeout via PGOPTIONS (psql respects it)
export PGOPTIONS="${PGOPTIONS:--c statement_timeout=60000}"

CURL_CONN_TIMEOUT="${CURL_CONN_TIMEOUT:-2}"
CURL_MAX_TIME="${CURL_MAX_TIME:-5}"

run() {
  local name="$1"; shift
  echo "=== [P6-2] $name ===" | tee -a "$EVI/steps.log"
  if [[ "$MODE" == "dry" ]]; then
    echo "[DRY] 执行: $*" | tee -a "$EVI/steps.log"
    return 0
  fi
  echo "Executing: $*" | tee -a "$EVI/steps.log"
  ( "$@" ) > "$EVI/${name}.log" 2>&1 || {
    echo "❌ $name FAILED (logs: $EVI/${name}.log)" | tee -a "$EVI/steps.log"
    return 1
  }
}

ledger_sum_posted() {
  # Prefer DATABASE_URL; fallback to typical local
  local db="${DATABASE_URL:-postgresql://postgres:password@localhost:5433/scu}"
  # sum(amount) might be null
  psql "$db" -X -q -t -c "SELECT COALESCE(SUM(amount),0) FROM billing_ledgers WHERE status='POSTED';" | tr -d '[:space:]'
}

kill_by_pidfile() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local pid
  pid="$(cat "$f" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] || return 0
  if ps -p "$pid" >/dev/null 2>&1; then
    # only kill node-like processes to avoid collateral damage
    local cmd
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if echo "$cmd" | grep -qE "(node|pnpm|tsx|nest)"; then
      kill -9 "$pid" 2>/dev/null || true
      echo "[P6-2] KILLED pid=$pid file=$f cmd=$cmd" | tee -a "$EVI/kill.log"
    else
      echo "[P6-2] SKIP pid=$pid file=$f cmd=$cmd" | tee -a "$EVI/kill.log"
    fi
  fi
  rm -f "$f" 2>/dev/null || true
}

kill_listen_port() {
  local port="$1"
  # macOS lsof is usually available
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | tr ' ' '\n' | while read -r p; do
      kill -9 "$p" 2>/dev/null || true
      echo "[P6-2] KILLED port=$port pid=$p" | tee -a "$EVI/kill.log"
    done
  fi
}

snapshot() {
  local name="$1"
  {
    echo "ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "git_sha=$(git rev-parse HEAD)"
    echo "posted_sum=$(ledger_sum_posted)"
  } > "$EVI/${name}.txt" || true
}

# 0) 红线检查
run "GATE_ROOT_POLLUTION" bash tools/gate/gates/gate_repo_root_pollution.sh
run "GATE_BILLING_DOC_HYGIENE" bash tools/gate/gates/gate_billing_doc_hygiene.sh

# CASE01: Baseline
snapshot "CASE01_before"
run "CASE01_CE06_SMOKE" bash tools/gate/gates/gate_ce06_smoke_v1.sh
snapshot "CASE01_after"

# CASE02: Duplicate Billing
snapshot "CASE02_before"
run "CASE02_BILLING_NEGATIVE" bash tools/gate/gates/gate_billing_negative.sh
snapshot "CASE02_after"

# CASE03: Security Failure (REAL)
# Use existing security negative gate (auth/HMAC failure) instead of /health.
snapshot "CASE03_before"
run "CASE03_SECURITY_NEGATIVE" bash tools/gate/gates/gate_security_negative.sh
snapshot "CASE03_after"

# CASE04: Worker Recovery (Kill & Restart)
if [[ "$MODE" != "dry" ]]; then
  echo "Testing CASE04 (Worker Recovery)..." | tee -a "$EVI/steps.log"

  # Prefer PID files if present
  if [[ -d ".data/pids" ]]; then
    for f in .data/pids/*.pid; do
      kill_by_pidfile "$f" || true
    done
  fi

  # Port-based fallback (API/Worker/ComfyUI typical ports)
  kill_listen_port 3000 || true
  kill_listen_port 3001 || true
  kill_listen_port 8188 || true

  sleep 1
fi

# Restart and verify
run "CASE04_RESTART_SERVICES" bash start_audit_services.sh
# wait health (avoid hang)
if [[ "$MODE" != "dry" ]]; then
  curl -sS --connect-timeout "$CURL_CONN_TIMEOUT" --max-time "$CURL_MAX_TIME" http://127.0.0.1:3000/api/health > "$EVI/CASE04_health.json" || true
fi

snapshot "CASE04_before"
run "CASE04_CE06_SMOKE_AFTER_RESTART" bash tools/gate/gates/gate_ce06_smoke_v1.sh
run "CASE04_RECONCILE_STRICT" bash tools/gate/gates/gate_billing_reconciliation.sh
snapshot "CASE04_after"

# Seal Evidence
( cd "$EVI" && shasum -a 256 * > CHECKSUMS )
echo "[P6-2] DONE. Evidence archived in $EVI" | tee -a "$EVI/steps.log"
