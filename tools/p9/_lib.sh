#!/usr/bin/env bash
set -euo pipefail
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }
sha_tool(){
  if command -v sha256sum >/dev/null 2>&1; then echo "sha256sum";
  elif command -v shasum >/dev/null 2>&1; then echo "sha256sum"; # Normalize to stay consistent if possible, though user gave shasum -a 256 for mac
  else echo "shasum -a 256"; fi # Fallback
}
# Correction: user provided a robust sha_tool logic:
# if command -v sha256sum >/dev/null 2>&1; then echo "sha256sum";
# elif command -v shasum >/dev/null 2>&1; then echo "shasum -a 256";
# else die "Missing checksum tool: sha256sum or shasum"; fi

# Re-implementing exactly as user requested for stability:
sha_tool(){
  if command -v sha256sum >/dev/null 2>&1; then echo "sha256sum";
  elif command -v shasum >/dev/null 2>&1; then echo "shasum -a 256";
  else die "Missing checksum tool: sha256sum or shasum"; fi
}
