#!/usr/bin/env bash
set -euo pipefail

log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"; }

# Print only file:line to avoid leaking secrets
grep_hits_fileline() {
  local pattern="$1"; shift
  git grep -nE "$pattern" -- "$@" 2>/dev/null | awk -F: '{print $1 ":" $2}' || true
}

json_write() {
  # usage: json_write <path> <json-string>
  local path="$1"; shift
  node -e "require('fs').writeFileSync(process.argv[1], process.argv[2] + '\n')" "$path" "$1"
}
