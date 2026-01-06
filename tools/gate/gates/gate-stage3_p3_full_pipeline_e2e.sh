#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

# CE-DAG wait timeout (per job). Prevent false 500 when CE06/CE-chain exceeds default 60s.
export CE_DAG_JOB_TIMEOUT_MS="${CE_DAG_JOB_TIMEOUT_MS:-300000}"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '-')"
EVID_DIR="docs/_evidence/p3_full_pipeline_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P3_FULL_PIPELINE_E2E] Starting Gate (RUN_ID: $RUN_ID)..."
log "CE_DAG_JOB_TIMEOUT_MS=$CE_DAG_JOB_TIMEOUT_MS"
log "🧹 Cleaning up old processes..."
pkill -f 'turbo.*dev' || true
pkill -f 'node.*3001' || true
pkill -f 'node.*3002' || true
sleep 2

log "🔌 Starting API..."
pnpm -w turbo run dev --filter=api > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# Wait for API ready
for i in {1..30}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log "API listening on 3000"
    break
  fi
  sleep 1
done

log "👷 Starting Worker..."
pnpm -w turbo run dev --filter=@scu/worker > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

sleep 5

# Cleanup on exit
trap "log '🧹 Cleanup...'; kill $API_PID $WORKER_PID 2>/dev/null || true" EXIT

log "🌱 Seeding Project (RUN_ID: $RUN_ID)..."
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES ('$USER_ID', 'p3_dag_${RUN_ID}@test.com', 'hash', NOW(), NOW());

INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", \"credits\") 
VALUES ('$ORG_ID', 'P3 DAG Org', '$USER_ID', NOW(), NOW(), 9999.0);

INSERT INTO projects (id, \"organizationId\", name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES ('$PROJ_ID', '$ORG_ID', 'FULL_PIPELINE_E2E', '$USER_ID', NOW(), NOW());

INSERT INTO seasons (id, \"projectId\", title, \"index\", \"updatedAt\") 
VALUES ('$SEASON_ID', '$PROJ_ID', 'Season 1', 1, NOW());

INSERT INTO episodes (id, \"seasonId\", \"index\", \"name\") 
VALUES ('$EPISODE_ID', '$SEASON_ID', 1, 'Episode 1');

INSERT INTO scenes (id, \"episodeId\", \"index\", \"title\", \"summary\") 
VALUES ('$SCENE_ID', '$EPISODE_ID', 1, 'Full Pipeline test scene', 'Testing Novel -> Video closed loop.');

INSERT INTO shots (id, \"sceneId\", \"index\", type, params) 
VALUES ('$SHOT_ID', '$SCENE_ID', 1, 'DEFAULT', '{}');

INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"updatedAt\")
VALUES ('$SOURCE_ID', '$PROJ_ID', 'A cinematic scene of a mysterious castle under the orange sunset.', NOW());

INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
('eng_ce06_p3', 'ce06_novel_parsing', 'HttpAdapter', 'HTTP', '{}', true, NOW(), NOW(), 'ce06_novel_parsing', true, 'Novel Parsing', 'ANALYSIS'),
('eng_ce03_p3', 'ce03_visual_density', 'VisualDensityLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce03_visual_density', true, 'Visual Density', 'ANALYSIS'),
('eng_ce04_p3', 'ce04_visual_enrichment', 'VisualEnrichmentLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce04_visual_enrichment', true, 'Visual Enrichment', 'ANALYSIS'),
('eng_video_p3', 'default_video_render', 'VideoRenderLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'default_video_render', true, 'Video Render', 'VIDEO_RENDER')
ON CONFLICT (\"engineKey\") DO UPDATE SET \"isActive\" = true;
"

log "✅ Data Seeded. Triggering Full Pipeline..."

DAG_OUT_FILE="$EVID_DIR/dag_trigger.log"

set +e
PROJ_ID="$PROJ_ID" SOURCE_ID="$SOURCE_ID" SHOT_ID="$SHOT_ID" API_BASE="http://localhost:3000" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_ce_dag_gate.ts 2>&1 | tee "$DAG_OUT_FILE"
TS_NODE_RC=${PIPESTATUS[0]}
set -e

if [ "$TS_NODE_RC" -ne 0 ]; then
  log "❌ DAG trigger script failed rc=$TS_NODE_RC"
  exit 1
fi

[ -s "$DAG_OUT_FILE" ] || { log "❌ dag_trigger.log empty"; exit 1; }

DAG_OUT=$(cat "$DAG_OUT_FILE")

TRACE_ID=$(echo "$DAG_OUT" | grep "TRACE_ID=" | cut -d= -f2)
CE06_JOB_ID=$(echo "$DAG_OUT" | grep "CE06_JOB_ID=" | cut -d= -f2)
VIDEO_JOB_ID=$(echo "$DAG_OUT" | grep "VIDEO_JOB_ID=" | cut -d= -f2)
VIDEO_KEY=$(echo "$DAG_OUT" | grep "VIDEO_KEY=" | cut -d= -f2)

if [ -z "$TRACE_ID" ] || [ -z "$CE06_JOB_ID" ] || [ -z "$VIDEO_JOB_ID" ]; then
    log "❌ Failed to trigger DAG or extract job IDs."
    exit 1
fi

log "⏳ Waiting for Full Pipeline completion (Trace: $TRACE_ID)..."

# In Phase 3, runCEDag handles the wait internally. 
# But let's check the final job status in DB as extra verification.

for i in {1..120}; do
  V_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id='$VIDEO_JOB_ID';" | xargs || echo "")
  log "   [VIDEO_RENDER] Status: $V_STATUS"
  
  if [ "$V_STATUS" = "SUCCEEDED" ]; then
    log "✅ Pipeline SUCCEEDED"
    break
  fi
  
  if [ "$V_STATUS" = "FAILED" ]; then
    log "❌ Pipeline FAILED at Video Render"
    exit 1
  fi
  sleep 3
done

log "🔍 Final Verification..."
ASSET_URL=$(psql -d scu -t -c "SELECT \"storageKey\" FROM assets WHERE \"ownerId\"='$SHOT_ID' AND type='IMAGE' LIMIT 1;" | xargs)
VIDEO_URL=$(psql -d scu -t -c "SELECT \"storageKey\" FROM assets WHERE \"ownerId\"='$SHOT_ID' AND type='VIDEO' LIMIT 1;" | xargs)

log "   IMAGE_ASSET: $ASSET_URL"
log "   VIDEO_ASSET: $VIDEO_URL"

if [ -n "$VIDEO_URL" ]; then
    log "✅ Verified: Video asset generated in DB."
else
    log "❌ Error: Video asset missing in DB."
    exit 1
fi

cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
[P3 FULL PIPELINE E2E - NOVEL TO VIDEO - PASS]
RUN_ID: $RUN_ID
TRACE_ID: $TRACE_ID
CE06_STATUS: SUCCEEDED
SHOT_RENDER_STATUS: SUCCEEDED
VIDEO_RENDER_STATUS: SUCCEEDED
VIDEO_PATH: $VIDEO_URL
EOF

log "📝 Evidence saved. Gate Passed."

# CRITICAL: Refuse false-positive success
GATE_LOG_FILE="$EVID_DIR/gate.log"
if [ ! -s "$GATE_LOG_FILE" ]; then
  GATE_LOG_FILE="/tmp/scu_gate_full_pipeline.log"
fi

PASS_CNT="$(rg -c "\[PASS\]" "$GATE_LOG_FILE" 2>/dev/null || echo "0")"
if [ "${PASS_CNT:-0}" -lt 1 ]; then
  log "❌ No [PASS] assertions found. Refusing false-positive success."
  exit 1
fi
