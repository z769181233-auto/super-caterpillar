#!/usr/bin/env bash
# Usage: run_with_timeout <seconds> <command...>
run_with_timeout() {
  local timeout_sec="$1"
  shift
  ( "$@" ) &
  local pid=$!
  (
    sleep "$timeout_sec"
    if kill -0 "$pid" 2>/dev/null; then
      echo "[TIMEOUT] Command '$*' timed out after ${timeout_sec}s. Killing PID $pid."
      # Kill process tree
      pkill -P "$pid" || true
      kill -9 "$pid" 2>/dev/null || true
    fi
  ) &
  local killer_pid=$!
  wait "$pid" 2>/dev/null
  local rc=$?
  kill "$killer_pid" 2>/dev/null || true
  wait "$killer_pid" 2>/dev/null || true
  return "$rc"
}
