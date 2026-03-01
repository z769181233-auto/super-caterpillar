#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

has_client() {
  [ -d "$ROOT/node_modules/.prisma/client" ] || [ -d "$ROOT/packages/database/src/generated/prisma" ]
}

# 1) quick check: generated client dir
if has_client; then
  exit 0
fi

echo "[ensure_prisma_generated] missing node_modules/.prisma/client"

# 2) locate schema (pick first match)
SCHEMA=""
if [ -f "$ROOT/prisma/schema.prisma" ]; then
  SCHEMA="$ROOT/prisma/schema.prisma"
elif [ -f "$ROOT/packages/database/prisma/schema.prisma" ]; then
  SCHEMA="$ROOT/packages/database/prisma/schema.prisma"
else
  SCHEMA="$(find "$ROOT" -name schema.prisma 2>/dev/null | head -n1 || true)"
fi

echo "[ensure_prisma_generated] schema=$SCHEMA"
if [ -z "$SCHEMA" ]; then
  echo "[ensure_prisma_generated] ERROR: schema.prisma not found" >&2
  exit 1
fi

# 3) run prisma generate (pin version)
run_generate() {
  echo "[ensure_prisma_generated] running: $*"
  "$@" || return 1
}

if command -v pnpm >/dev/null 2>&1; then
  if run_generate pnpm dlx prisma@5.22.0 generate --schema "$SCHEMA"; then
    :
  else
    echo "[ensure_prisma_generated] pnpm dlx failed" >&2
  fi
fi

if ! has_client; then
  if command -v npm >/dev/null 2>&1; then
    run_generate npm exec --yes prisma@5.22.0 prisma generate --schema "$SCHEMA" || true
  fi
fi

if ! has_client; then
  run_generate npx --yes prisma@5.22.0 generate --schema "$SCHEMA" || true
fi

# 4) verify
if ! has_client; then
  echo "[ensure_prisma_generated] ERROR: generate finished but client dir still missing" >&2
  exit 1
fi

echo "[ensure_prisma_generated] verifying prisma import via tools/smoke/_db/prisma..."
if ! node -e "require(require('path').join(process.cwd(), 'tools/smoke/_db/prisma')); console.log('ok')" >/dev/null 2>&1; then
  echo "[ensure_prisma_generated] ERROR: prisma import from tools/smoke/_db/prisma failed" >&2
  exit 1
fi

echo "[ensure_prisma_generated] ok"

