#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Repo root (single source of truth)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "[FATAL] Not inside a git repo; cannot resolve repo root."
  exit 1
fi
cd "$ROOT"

# Common env (do not override if already set)
export NODE_ENV="${NODE_ENV:-test}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Evidence dir convention
export EVI_BASE="${EVI_BASE:-$ROOT/docs/_evidence}"
mkdir -p "$EVI_BASE"

# Export ROOT for child scripts
export GATE_ROOT="$ROOT"
