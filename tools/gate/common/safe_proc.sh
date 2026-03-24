#!/usr/bin/env bash
set -euo pipefail

# [safe_proc] Security Enhanced Process Utility

kill_port() {
  local port="$1"
  local pids
  echo "[safe_proc] checking port $port..."
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    echo "[safe_proc] kill port $port pids: $pids"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null || true
    sleep 0.5
    # shellcheck disable=SC2086
    kill -KILL $pids 2>/dev/null || true
  fi
}

# ENV DEFAULTS
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORDR:-password}"
export PGHOST="${PGHOST:-127.0.0.1}"

# Load common bash libs if needed
kill_pidfile_if_repo_proc() {
  # only kill if command line contains repo root (avoid killing IDE node services)
  local pidfile="$1"
  local root="$2"
  [[ -f "$pidfile" ]] || return 0
  local pid cmd
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  [[ -n "${pid:-}" ]] || { rm -f "$pidfile" || true; return 0; }
  
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[safe_proc] removing stale pidfile $pidfile (pid $pid not running)"
    rm -f "$pidfile" || true
    return 0
  fi
  
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ -n "${cmd:-}" ]] && [[ "$cmd" == *"$root"* ]]; then
    echo "[safe_proc] kill pidfile $pidfile pid=$pid cmd=$cmd"
    kill -TERM "$pid" 2>/dev/null || true
    sleep 0.5
    kill -KILL "$pid" 2>/dev/null || true
  else
    echo "[safe_proc] skip pid=$pid (not repo proc or shell mismatch): $cmd"
  fi
  rm -f "$pidfile" || true
}

curl_fast() { curl -sS --max-time 3 "$@"; }

psql_fast() {
  local url="$1"
  local sql="$2"
  PGCONNECT_TIMEOUT=5 PGOPTIONS='-c statement_timeout=5000' psql "$url" -X -v ON_ERROR_STOP=1 -q -t -A -c "$sql"
}
