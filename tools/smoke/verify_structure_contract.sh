#!/usr/bin/env bash
set -euo pipefail

echo "[verify_structure_contract] START"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# 1) Ensure auth state (single source of truth)
echo "[verify_structure_contract] Ensuring auth state via ensure_auth_state.ts..."
pnpm -w exec tsx tools/smoke/ensure_auth_state.ts

if [ ! -f "tools/smoke/.auth_env" ]; then
  echo "[verify_structure_contract] FAIL: tools/smoke/.auth_env missing after ensure_auth_state.ts"
  exit 1
fi

# shellcheck disable=SC1091
source "tools/smoke/.auth_env"
: "${AUTH_COOKIE_HEADER:?AUTH_COOKIE_HEADER missing after sourcing .auth_env}"
export AUTH_COOKIE_HEADER

# 2) Seed demo structure (must be idempotent)
echo "[verify_structure_contract] Seeding demo structure..."
pnpm -w exec tsx tools/smoke/seed_demo_structure.ts

# 3) Read TEST_PROJECT_ID from .demo_env
if [ ! -f "tools/smoke/.demo_env" ]; then
  echo "[verify_structure_contract] FAIL: tools/smoke/.demo_env not found"
  exit 1
fi
# shellcheck disable=SC1091
source "tools/smoke/.demo_env"

if [ -z "${TEST_PROJECT_ID:-}" ]; then
  echo "[verify_structure_contract] FAIL: TEST_PROJECT_ID missing in .demo_env"
  exit 1
fi

# 4) Contract verify (hard gate)
# Since set -e is on, if this command fails (exit non-zero), the script will exit immediately with error.
echo "[verify_structure_contract] verify_structure_contract.ts project=$TEST_PROJECT_ID"
pnpm -w exec tsx tools/smoke/verify_structure_contract.ts "$TEST_PROJECT_ID"

echo "[verify_structure_contract] PASS"
