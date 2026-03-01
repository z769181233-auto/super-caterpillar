#!/usr/bin/env bash
# start_api.sh
set -euo pipefail

# P0: Clear corrupted REPO_ROOT
unset REPO_ROOT
unset GATE_MODE


set -a
if [ -f .env.local ]; then
  source .env.local
fi
set +a
unset GATE_MODE


export REPO_ROOT="$(pwd)"

cd apps/api
export PORT=3000
# P1: Log to file for debugging
npx ts-node src/main.ts > ../../api.log 2>&1
