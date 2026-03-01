#!/usr/bin/env bash
set -euo pipefail

log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }
need_env(){ [ -n "${!1:-}" ] || die "Missing required env: $1"; }

sha_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then
    echo "sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    echo "shasum -a 256"
  else
    die "Missing checksum tool: sha256sum or shasum"
  fi
}

# Run a command string WITHOUT printing raw content (avoid leaking secrets).
run_cmd() {
  local label="$1"
  local cmd="$2"
  local sha; sha="$(printf "%s" "$cmd" | $(sha_cmd) | awk '{print $1}')"
  log "[$label] cmd_sha256=$sha"
  bash -lc "$cmd"
}

http_healthcheck() {
  local url="$1"
  local label="$2"
  local timeout_sec="${P7_HEALTH_TIMEOUT_SEC:-180}"
  local interval_sec="${P7_HEALTH_INTERVAL_SEC:-3}"

  need curl

  log "[$label] healthcheck url=$url timeout=${timeout_sec}s interval=${interval_sec}s"
  local start; start="$(date +%s)"
  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "[$label] PASS"
      return 0
    fi
    local now; now="$(date +%s)"
    if [ $((now - start)) -ge "$timeout_sec" ]; then
      die "[$label] FAIL: healthcheck timeout"
    fi
    sleep "$interval_sec"
  done
}
