#!/bin/bash
set -e

# ==============================================================================
# Gate: Stage 3 P2 Visual Metrics (CE03/CE04 End-to-End Verification)
# Hardpass Version: Starts its own API/Worker to ensure consistent environment.
# ==============================================================================

# 1. Load Environment & Tools
source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../common/run_with_timeout.sh"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '-')"
EVID_DIR="docs/_evidence/p2_visual_metrics_${TS}"
mkdir -p "$EVID_DIR"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

API_URL="http://localhost:3001"
WORKER_API_KEY="${WORKER_API_KEY:-ak_worker_dev_0000000000000000}"

log "🚀 [P2_VISUAL] Starting Gate Verification (RUN_ID: $RUN_ID)..."

# 2. Cleanup & Start Services
log "🧹 Cleaning up old processes..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "apps/workers/dist/apps/workers/src/main.js" || true
lsof -t -i :3001 | xargs kill -9 2>/dev/null || true

log "🔌 Starting API..."
export STRIPE_SECRET_KEY="sk_test_mock_start_key"
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!

wait_for_port() {
  local port=$1
  local pid=$2
  local name=$3
  local timeout=60
  local start=$(date +%s)
  while true; do
    if ! kill -0 $pid 2>/dev/null; then log "FATAL: $name died."; exit 1; fi
    if lsof -iTCP:$port -sTCP:LISTEN -P -n >/dev/null 2>&1; then log "$name listening on $port"; return 0; fi
    if [ $(( $(date +%s) - start )) -ge $timeout ]; then log "Timeout waiting for $name"; exit 1; fi
    sleep 1
  done
}

wait_for_port 3001 $API_PID "API"

log "👷 Starting Worker..."
export WORKER_CAPS="CE03_VISUAL_DENSITY,CE04_VISUAL_ENRICHMENT"
export API_URL="http://127.0.0.1:3001"
node apps/workers/dist/apps/workers/src/main.js > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 5
if ! kill -0 $WORKER_PID 2>/dev/null; then log "FATAL: Worker died."; cat "$EVID_DIR/worker.log"; exit 1; fi

# 3. Seed Data (RUN_ID scoped to avoid pollution)
PROJECT_NAME="P2_Visual_Gate_${TS}"
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"
log "🌱 Seeding Project: $PROJECT_NAME (RUN_ID: $RUN_ID)"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES ('$USER_ID', 'p2_gate_${RUN_ID}@test.com', 'hash', NOW(), NOW());

INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", \"credits\")
VALUES ('$ORG_ID', 'P2 Gate Org ${RUN_ID}', '$USER_ID', NOW(), NOW(), 1000);

INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", \"createdAt\", \"updatedAt\")
VALUES ('$PROJ_ID', '$PROJECT_NAME', '$USER_ID', '$ORG_ID', NOW(), NOW());

INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\")
VALUES ('$SEASON_ID', '$PROJ_ID', 0, 'S1', NOW(), NOW());

INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name)
VALUES ('$EPISODE_ID', '$SEASON_ID', '$PROJ_ID', 0, 'Ep1');

INSERT INTO scenes (id, \"episodeId\", index, title, summary)
VALUES ('$SCENE_ID', '$EPISODE_ID', 0, 'Scene 1', 'A test scene summary.');

INSERT INTO shots (id, \"sceneId\", index, type, params, \"organizationId\")
VALUES ('$SHOT_ID', '$SCENE_ID', 0, 'DEFAULT', '{\"prompt\": \"Close up\"}', '$ORG_ID');

INSERT INTO novel_sources (id, \"projectId\", \"fileType\", \"rawText\", \"createdAt\", \"updatedAt\")
VALUES ('$SOURCE_ID', '$PROJ_ID', 'TEXT', 'Test Novel Content', NOW(), NOW());

INSERT INTO api_keys (id, key, \"ownerUserId\", \"ownerOrgId\", status, \"createdAt\", \"updatedAt\")
VALUES ('ak_${RUN_ID}', '$WORKER_API_KEY', '$USER_ID', '$ORG_ID', 'ACTIVE', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
('eng_ce03_global', 'ce03_visual_density', 'VisualDensityLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce03_visual_density', true, 'Visual Density', 'ANALYSIS'),
('eng_ce04_global', 'ce04_visual_enrichment', 'VisualEnrichmentLocalAdapter', 'LOCAL', '{}', true, NOW(), NOW(), 'ce04_visual_enrichment', true, 'Visual Enrichment', 'ANALYSIS')
ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, \"isActive\" = true;

INSERT INTO engine_versions (id, \"engineId\", \"versionName\", config, enabled, \"createdAt\", \"updatedAt\")
VALUES 
('ver_ce03_global', 'eng_ce03_global', '1.0.0', '{}', true, NOW(), NOW()),
('ver_ce04_global', 'eng_ce04_global', '1.0.0', '{}', true, NOW(), NOW())
ON CONFLICT (\"engineId\", \"versionName\") DO NOTHING;

"

log "✅ Data Seeded."

# 4. Create Jobs (extract traceId for precise binding)
log "🎬 Creating CE03 Job..."
CE03_PAYLOAD='{"structured_text": "[\"dark room bright red light\", \"blue color green shadow texture\"]", "metrics_config": {}}'
CE03_OUT=$(JOB_TYPE="CE03_VISUAL_DENSITY" SHOT_ID="$SHOT_ID" ORG_ID="$ORG_ID" USER_ID="$USER_ID" JOB_PAYLOAD="$CE03_PAYLOAD" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_trigger.ts 2>&1)
CE03_JOB_ID=$(echo "$CE03_OUT" | grep "JOB_ID=" | cut -d= -f2)
CE03_TRACE_ID=$(echo "$CE03_OUT" | grep "TRACE_ID=" | cut -d= -f2)

if [ -z "$CE03_JOB_ID" ]; then
    log "❌ Failed to create CE03 Job: $CE03_OUT"
    kill $API_PID $WORKER_PID; exit 1
fi
log "   Job ID: $CE03_JOB_ID (TraceID: $CE03_TRACE_ID)"

log "🎬 Creating CE04 Job..."
CE04_PAYLOAD='{"structured_text": "[\"dark room bright red light\", \"blue color green shadow texture\"]"}'
CE04_OUT=$(JOB_TYPE="CE04_VISUAL_ENRICHMENT" SHOT_ID="$SHOT_ID" ORG_ID="$ORG_ID" USER_ID="$USER_ID" JOB_PAYLOAD="$CE04_PAYLOAD" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_trigger.ts 2>&1)
CE04_JOB_ID=$(echo "$CE04_OUT" | grep "JOB_ID=" | cut -d= -f2)
CE04_TRACE_ID=$(echo "$CE04_OUT" | grep "TRACE_ID=" | cut -d= -f2)

if [ -z "$CE04_JOB_ID" ]; then
    log "❌ Failed to create CE04 Job: $CE04_OUT"
    kill $API_PID $WORKER_PID; exit 1
fi
log "   Job ID: $CE04_JOB_ID (TraceID: $CE04_TRACE_ID)"

# 5. Wait for Completion
log "⏳ Waiting for jobs..."
wait_for_job() {
    local job_id=$1
    local type=$2
    for i in {1..30}; do
        STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id='$job_id'" | xargs)
        log "   [$type] Status: $STATUS"
        if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi
        if [ "$STATUS" == "FAILED" ]; then
            log "❌ [$type] Job Failed!"
            psql -d scu -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$job_id'"
            return 1
        fi
        sleep 2
    done
    return 1
}
wait_for_job "$CE03_JOB_ID" "CE03" || { kill $API_PID $WORKER_PID; exit 1; }
wait_for_job "$CE04_JOB_ID" "CE04" || { kill $API_PID $WORKER_PID; exit 1; }
log "✅ Jobs Succeeded."

# 6. Verify Output Content via SQL (HARDENED: traceId binding + validity assertion)
log "🔍 Verifying DB with traceId binding..."

# CE03: Bind by projectId + traceId, assert > 0
CE03_SCORE=$(psql -d scu -t -c "SELECT qm.\"visualDensityScore\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"='$PROJ_ID' AND qm.engine='CE03' AND sj.id='$CE03_JOB_ID' AND sj.\"traceId\"='$CE03_TRACE_ID' LIMIT 1;" | xargs)
log "   [CE03] Density Score: $CE03_SCORE (TraceID: $CE03_TRACE_ID)"
if [ -n "$CE03_SCORE" ] && [ "$CE03_SCORE" != "null" ] && (( $(echo "$CE03_SCORE > 0" | bc -l) )); then
    log "✅ CE03 Valid (score: $CE03_SCORE > 0)"
else
    log "❌ CE03 Invalid: expected > 0, got '$CE03_SCORE'"
    psql -d scu -c "SELECT * FROM quality_metrics WHERE \"projectId\"='$PROJ_ID' AND engine='CE03';"
    exit 1
fi

# CE04: Bind by projectId + traceId, assert > 0
CE04_QUALITY=$(psql -d scu -t -c "SELECT qm.\"enrichmentQuality\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"='$PROJ_ID' AND qm.engine='CE04' AND sj.id='$CE04_JOB_ID' AND sj.\"traceId\"='$CE04_TRACE_ID' LIMIT 1;" | xargs)
log "   [CE04] Enrichment Quality: $CE04_QUALITY (TraceID: $CE04_TRACE_ID)"
if [ -n "$CE04_QUALITY" ] && [ "$CE04_QUALITY" != "null" ] && (( $(echo "$CE04_QUALITY > 0" | bc -l) )); then
    log "✅ CE04 Valid (quality: $CE04_QUALITY > 0)"
else
    log "❌ CE04 Invalid: expected > 0, got '$CE04_QUALITY'"
    psql -d scu -c "SELECT * FROM quality_metrics WHERE \"projectId\"='$PROJ_ID' AND engine='CE04';"
    exit 1
fi

# 7. Verify API (use RUN_ID scoped source)
log "🔍 Verifying API..."
sleep 2
INSIGHT_RESP=$(curl -s "$API_URL/api/audit-insight/novels/$SOURCE_ID/insight")
API_METRICS_COUNT=$(echo "$INSIGHT_RESP" | jq '.ce03_04 | length')
log "   Found $API_METRICS_COUNT visual metrics via API."
if [ "$API_METRICS_COUNT" -lt 2 ]; then
    log "❌ API missing metrics!"
    echo "$INSIGHT_RESP" | jq .
    kill $API_PID $WORKER_PID; exit 1
fi

# 8. Generate Evidence
log "📝 Generating Evidence..."
EVIDENCE_FILE="$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
cat > "$EVIDENCE_FILE" <<EOF
[P2 Visual Metrics Gate PASS - $(date)]
CE03_JOB_ID: $CE03_JOB_ID (SUCCEEDED)
CE04_JOB_ID: $CE04_JOB_ID (SUCCEEDED)
CE03_DENSITY_SCORE: $CE03_SCORE
CE04_ENRICHMENT_QUALITY: $CE04_QUALITY
API_VISIBLE_METRICS_COUNT: $API_METRICS_COUNT
EOF
log "✅ Evidence saved to: $EVIDENCE_FILE"

psql -d scu -c "SELECT id, type, status FROM shot_jobs WHERE id IN ('$CE03_JOB_ID', '$CE04_JOB_ID');" > "$EVID_DIR/sql_jobs_proof.txt"
echo "$INSIGHT_RESP" | jq . > "$EVID_DIR/api_insight_proof.json"

log "✅ Gate Passed. Evidence at $EVID_DIR"

# Cleanup
kill $API_PID $WORKER_PID || true
exit 0
