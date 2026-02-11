#!/bin/bash
# tools/gate/lib/gate_auth_seed.sh (STABILIZED)
set -euo pipefail

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [SEED] $1" >&2
}

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL not set."
  exit 1
fi

# 1. Initialize API Key (Get Valid Key/Secret)
log "Initializing API Credentials..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1) || { log "Init Failed"; echo "$INIT_OUT"; exit 1; }
VALID_API_KEY_ID=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2 | tr -d '\r')
API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2 | tr -d '\r')
ORG_ID=$(echo "$INIT_OUT" | grep "ORG_ID=" | cut -d= -f2 | tr -d '\r')
USER_ID="gate_user_p25_stable"
USER_EMAIL="gate_p25@caterpillar.com"
TS_SEED=$(date +%s)

export VALID_API_KEY_ID API_SECRET ORG_ID USER_ID

# 3. Seed Database with Sequential Integrity
log "Seeding Stable DB Hierarchy via ORM (init_api_key.ts)..."

# Initialized above via init_api_key.ts
log "DB Seeding Complete. ORG_ID=$ORG_ID"

# EXPORT CREDENTIALS TO STDOUT FOR CAPTURE
echo "API_KEY=$VALID_API_KEY_ID"
echo "API_SECRET=$API_SECRET"
echo "ORG_ID=$ORG_ID"
