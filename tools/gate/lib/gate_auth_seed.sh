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

export ENGINE_MODE=${ENGINE_MODE:-test}
export VALID_API_KEY_ID API_SECRET ORG_ID USER_ID

# 3. Seed Database with Sequential Integrity
log "Seeding Stable DB Hierarchy via ORM (init_api_key.ts)..."

# Initialized above via init_api_key.ts
log "DB Seeding Complete. ORG_ID=$ORG_ID"

# EXPORT CREDENTIALS TO STDOUT FOR CAPTURE
echo "API_KEY=$VALID_API_KEY_ID"
echo "API_SECRET=$API_SECRET"
echo "ORG_ID=$ORG_ID"

# 4. Export Common IDs (Seeded by init_api_key.ts or here)
export PROJ_ID="00000000-0000-0000-0000-000000000001"
export SEASON_ID="00000000-0000-0000-0000-000000000001"
export EPISODE_ID="00000000-0000-0000-0000-000000000001"
export SCENE_ID="00000000-0000-0000-0000-000000000001"

# Ensure Season, Episode and Scene exist (Project is seeded by init_api_key.ts)
# Season: id, projectId, index, title
psql "$DATABASE_URL" -c "INSERT INTO seasons (id, \"projectId\", \"index\", title, \"updatedAt\") VALUES ('$SEASON_ID', '$PROJ_ID', 1, 'Smoke Season', NOW()) ON CONFLICT (id) DO NOTHING;" > /dev/null

# Episode: id, projectId, seasonId, index, name
psql "$DATABASE_URL" -c "INSERT INTO episodes (id, \"projectId\", \"seasonId\", \"index\", name) VALUES ('$EPISODE_ID', '$PROJ_ID', '$SEASON_ID', 1, 'Smoke Episode') ON CONFLICT (id) DO NOTHING;" > /dev/null

# Scene: id, episodeId, project_id, scene_index
psql "$DATABASE_URL" -c "INSERT INTO scenes (id, \"episodeId\", \"project_id\", \"scene_index\", \"updated_at\") VALUES ('$SCENE_ID', '$EPISODE_ID', '$PROJ_ID', 1, NOW()) ON CONFLICT (id) DO NOTHING;" > /dev/null

log "Seeded Common IDs: PROJ=$PROJ_ID SEASON=$SEASON_ID EP=$EPISODE_ID SCENE=$SCENE_ID"
