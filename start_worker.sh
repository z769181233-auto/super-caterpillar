#!/usr/bin/env bash
# start_worker.sh
set -euo pipefail

# P0: Clear corrupted REPO_ROOT (prevent truncation bugs)
unset REPO_ROOT

set -a
if [ -f .env.local ]; then
  source .env.local
fi
set +a

# Ensure a proper REPO_ROOT for the process
export REPO_ROOT="$(pwd)"

cd apps/workers
npx ts-node -r tsconfig-paths/register src/worker-app.ts "$@"
