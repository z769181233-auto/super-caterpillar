#!/bin/bash
# gate-ce11_timeline_preview.sh
# Purpose: E2E Verification for CE11 Timeline Preview (Commercial Grade)
# Features: No Eval, Fail-fast, Self-Start, Unique IDs, Nonce Replay Check, Audit Log Check, API Polling.

set -euo pipefail

# Setup Env
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$GATE_DIR/../../.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="$PROJECT_ROOT/docs/_evidence/ce11_final_closure_${TS}"
mkdir -p "$EVIDENCE_DIR"

source "$PROJECT_ROOT/.env.local" || true

API_URL="http://localhost:${PORT:-3000}"
export DATABASE_URL="${DATABASE_URL:-}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://localhost:3001}"
API_SECRET="${API_SECRET_KEY:-}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$EVIDENCE_DIR/gate.log"
}

log "Starting Gate: CE11 Timeline Preview (Commercial Grade)"

# --- Cleanup Trap ---
cleanup() {
    if [ -n "${API_PID:-}" ]; then
        log "Cleaning up API process $API_PID..."
        kill "$API_PID" || true
    fi
}
trap cleanup EXIT

# --- E. Dependencies & Fail-Fast ---
if [ -z "${DATABASE_URL}" ]; then
  log "ERROR: DATABASE_URL missing."
  exit 22
fi
if ! command -v psql >/dev/null 2>&1; then
  log "ERROR: psql not found."
  exit 22
fi
if [ -z "${API_SECRET}" ]; then
  log "ERROR: API_SECRET_KEY must be set."
  exit 22
fi

# --- A. API Self-Start ---
API_PID=""
if ! curl -s "$API_URL/health" > /dev/null; then
  log "API not running at $API_URL. Starting API in background..."
  LOG_FILE_API="$EVIDENCE_DIR/api.log"
  export PORT="${PORT:-3000}"
  cd "$PROJECT_ROOT"
  
  if [ -f "apps/api/dist/main.js" ]; then
    log "Using built artifact: apps/api/dist/main.js"
    export NODE_ENV=production
    node apps/api/dist/main.js > "$LOG_FILE_API" 2>&1 &
  else
    log "Build artifact not found, falling back to ts-node..."
    npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register --transpile-only apps/api/src/main.ts > "$LOG_FILE_API" 2>&1 &
  fi
  API_PID=$!
  log "API started with PID: $API_PID. Waiting for health check..."

  for i in {1..40}; do
    if curl -s "$API_URL/health" > /dev/null; then
      log "API is UP."
      break
    fi
    sleep 2
  done

  if ! curl -s "$API_URL/health" > /dev/null; then
    log "Failed to start API. Check logs at $LOG_FILE_API"
    tail -n 60 "$LOG_FILE_API" | tee -a "$EVIDENCE_DIR/gate.log"
    exit 1
  fi
fi

# 1. Prepare Dummy Data
RUNTIME_DIR="$PROJECT_ROOT/.runtime"
mkdir -p "$RUNTIME_DIR/test_ce11"
# Create dummy MP4 if ffmpeg exists
if command -v ffmpeg &> /dev/null; then
    DUMMY_MP4="$RUNTIME_DIR/test_ce11/dummy_source.mp4"
    if [ ! -f "$DUMMY_MP4" ]; then
        ffmpeg -f lavfi -i color=c=black:s=640x360:r=24 -t 1 -c:v libx264 -pix_fmt yuv420p "$DUMMY_MP4" -y > /dev/null 2>&1 || true
    fi
fi

# 2. Get Valid API Key
VALID_API_KEY_ID=$(psql "$DATABASE_URL" -t -c "SELECT key FROM \"api_keys\" WHERE status = 'ACTIVE' LIMIT 1" | tr -d '[:space:]')
if [ -z "$VALID_API_KEY_ID" ]; then
    log "Error: No active API Key found for test. Please seed DB."
    exit 1
fi
log "Using API Key: ${VALID_API_KEY_ID:0:4}..."

# --- B. HMAC Helper (Supports Overrides) ---
generate_hmac_headers_lines() {
  local method=$1
  local path=$2
  local body=$3
  local nonce_override=${4:-}
  local ts_override=${5:-}

  BODY_CONTENT="$body" NONCE="$nonce_override" TIMESTAMP="$ts_override" node -e "
    const crypto = require('crypto');
    const apiKey = '$VALID_API_KEY_ID';
    const secret = '$API_SECRET';
    // Use override or generate
    const nonce = process.env.NONCE || crypto.randomBytes(8).toString('hex');
    const timestamp = process.env.TIMESTAMP || Math.floor(Date.now()/1000).toString();
    const body = process.env.BODY_CONTENT || '';
    
    // V1.1 Canonical
    const canonical = apiKey + nonce + timestamp + body; 
    const signature = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
    
    console.log('X-Api-Key: ' + apiKey);
    console.log('X-Nonce: ' + nonce);
    console.log('X-Timestamp: ' + timestamp);
    console.log('X-Signature: ' + signature);
    console.log('X-Hmac-Version: v1.1');
    process.stderr.write('NONCE=' + nonce + '\n');
    process.stderr.write('TIMESTAMP=' + timestamp + '\n');
    process.stderr.write('SIGNATURE=' + signature + '\n');
  " 2> "$EVIDENCE_DIR/hmac_meta.tmp"
}

# --- D. Unique DB Seeds ---
GATE_UID="$(date +%s)_$RANDOM"
PROJECT_ID="proj_gate_ce11_${GATE_UID}"
SHOT_ID="shot_gate_ce11_${GATE_UID}"
SCENE_ID="scene_gate_ce11_${GATE_UID}"
DUMMY_ASSET_ID="asset_gate_ce11_${GATE_UID}"

# Log IDs
printf "GATE_UID=%s\nPROJECT_ID=%s\nSCENE_ID=%s\nSHOT_ID=%s\nDUMMY_ASSET_ID=%s\n" \
  "$GATE_UID" "$PROJECT_ID" "$SCENE_ID" "$SHOT_ID" "$DUMMY_ASSET_ID" \
  | tee "$EVIDENCE_DIR/ids.txt"

log "Seeding Dummy Data..."
ORG_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM organizations LIMIT 1" | tr -d "[:space:]")
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users LIMIT 1" | tr -d "[:space:]")

SEASON_ID="season_gate_${GATE_UID}"
EPISODE_ID="episode_gate_${GATE_UID}"
SHOT_ID_1="$SHOT_ID"
SHOT_ID_2="shot_gate_ce11_2_${GATE_UID}"

# 0. Register Engine (TIMELINE_PREVIEW)
# Mode 'http' is required to pass Zero-Bypass check in PRODUCTION_MODE
# Code must match the engineKey for JobEngineBindingService to find it
psql "$DATABASE_URL" -c "INSERT INTO \"engines\" (id, \"engineKey\", \"adapterName\", \"adapterType\", mode, config, enabled, code, \"isActive\", name, type, \"createdAt\", \"updatedAt\") VALUES ('eng_preview_${GATE_UID}', 'ce11_timeline_preview', 'preview', 'real', 'http', '{}', true, 'ce11_timeline_preview', true, 'Timeline Preview Gate', 'TIMELINE_PREVIEW', NOW(), NOW()) ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, mode = EXCLUDED.mode, enabled = true, \"isActive\" = true;" > /dev/null

# 1. Project
psql "$DATABASE_URL" -c "INSERT INTO \"projects\" (id, name, \"ownerId\", \"organizationId\", \"updatedAt\") VALUES ('$PROJECT_ID', 'Gate Project $GATE_UID', '$USER_ID', '$ORG_ID', NOW());" > /dev/null
# 2. Season (Uses 'title' and requires 'index')
psql "$DATABASE_URL" -c "INSERT INTO \"seasons\" (id, \"projectId\", index, title, \"updatedAt\") VALUES ('$SEASON_ID', '$PROJECT_ID', 1, 'Gate Season', NOW());" > /dev/null
# 3. Episode (Uses 'name', requires 'index', NO updatedAt)
psql "$DATABASE_URL" -c "INSERT INTO \"episodes\" (id, \"seasonId\", \"projectId\", index, name) VALUES ('$EPISODE_ID', '$SEASON_ID', '$PROJECT_ID', 1, 'Gate Episode');" > /dev/null
# 4. Scene (Uses 'title', requires 'index' and 'summary', NO updatedAt)
psql "$DATABASE_URL" -c "INSERT INTO \"scenes\" (id, \"episodeId\", \"projectId\", index, title, summary) VALUES ('$SCENE_ID', '$EPISODE_ID', '$PROJECT_ID', 1, 'Gate Scene', 'Gate Scene Summary');" > /dev/null
# 5. Shots (Uses 'title', requires 'index' and 'type', NO updatedAt)
psql "$DATABASE_URL" -c "INSERT INTO \"shots\" (id, \"sceneId\", index, type, title) VALUES ('$SHOT_ID_1', '$SCENE_ID', 1, 'VIDEO', 'Shot 1');" > /dev/null
psql "$DATABASE_URL" -c "INSERT INTO \"shots\" (id, \"sceneId\", index, type, title) VALUES ('$SHOT_ID_2', '$SCENE_ID', 2, 'VIDEO', 'Shot 2');" > /dev/null

# 6. Source Assets (SHOT level)
STORAGE_KEY_DUMMY="test_ce11/dummy_source.mp4"
DUMMY_ASSET_ID_1="$DUMMY_ASSET_ID"
DUMMY_ASSET_ID_2="asset_gate_ce11_2_${GATE_UID}"

psql "$DATABASE_URL" -c "INSERT INTO \"assets\" (id, \"projectId\", \"ownerId\", \"ownerType\", type, status, \"storageKey\", \"createdAt\") VALUES ('$DUMMY_ASSET_ID_1', '$PROJECT_ID', '$SHOT_ID_1', 'SHOT', 'VIDEO', 'GENERATED', '$STORAGE_KEY_DUMMY', NOW());" > /dev/null
psql "$DATABASE_URL" -c "INSERT INTO \"assets\" (id, \"projectId\", \"ownerId\", \"ownerType\", type, status, \"storageKey\", \"createdAt\") VALUES ('$DUMMY_ASSET_ID_2', '$PROJECT_ID', '$SHOT_ID_2', 'SHOT', 'VIDEO', 'GENERATED', '$STORAGE_KEY_DUMMY', NOW());" > /dev/null

# 7. Construct Timeline JSON
TIMELINE_JSON_RAW=$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "sceneId": "$SCENE_ID",
  "organizationId": "$ORG_ID",
  "episodeId": "$EPISODE_ID",
  "width": 640,
  "height": 360,
  "fps": 24,
  "shots": [
    {
      "shotId": "$SHOT_ID_1",
      "durationFrames": 24,
      "framesTxtStorageKey": "unused/mock.txt"
    },
    {
      "shotId": "$SHOT_ID_2",
      "durationFrames": 24,
      "framesTxtStorageKey": "unused/mock.txt"
    }
  ],
  "audio": { "tracks": [] }
}
EOF
)

# MINIFICATION IS CRITICAL: Server re-serializes as minified JSON for HMAC V1.1
TIMELINE_JSON=$(JSON="$TIMELINE_JSON_RAW" node -e "console.log(JSON.stringify(JSON.parse(process.env.JSON)))")

# 5. Call API (First Attempt)
log "Sending API Request (First Attempt)..."
TARGET_PATH="/api/timeline/preview"
RESP_BODY="$EVIDENCE_DIR/response_body.json"

HEADERS_CURL_RAW=$(generate_hmac_headers_lines "POST" "$TARGET_PATH" "$TIMELINE_JSON")
source "$EVIDENCE_DIR/hmac_meta.tmp"
NONCE_1=$NONCE
TS_1=$TIMESTAMP
SIG_1=$SIGNATURE

CURL_HEADERS=()
while IFS= read -r line; do
  CURL_HEADERS+=(-H "$line")
done <<< "$HEADERS_CURL_RAW"

HTTP_CODE="$(curl -s -o "$RESP_BODY" -w "%{http_code}" \
  -X POST "$API_URL$TARGET_PATH" \
  -H "Content-Type: application/json" \
  "${CURL_HEADERS[@]}" \
  -d "$TIMELINE_JSON")"

log "API Response: $HTTP_CODE"
if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
    log "API Failed. Body:"
    cat "$RESP_BODY" | tee -a "$EVIDENCE_DIR/gate.log"
    exit 1
fi

JOB_ID="$(node -e "try{const j=require('fs').readFileSync('$RESP_BODY','utf8');const o=JSON.parse(j);console.log(o.jobId||'');}catch(e){console.log('');}")"
if [ -z "$JOB_ID" ]; then
    log "FAIL: missing jobId in response."
    exit 1
fi
log "Created Preview Job: $JOB_ID"

# 6. Verify Security: Nonce Replay
log "Verifying Nonce Replay Protection (Expect 401/4004)..."
REPLAY_RESP="$EVIDENCE_DIR/replay_body.json"
REPLAY_HEADERS_RAW=$(generate_hmac_headers_lines "POST" "$TARGET_PATH" "$TIMELINE_JSON" "$NONCE_1" "$TS_1")
CURL_HEADERS_REPLAY=()
while IFS= read -r line; do
  CURL_HEADERS_REPLAY+=(-H "$line")
done <<< "$REPLAY_HEADERS_RAW"

HTTP_CODE_REPLAY="$(curl -s -o "$REPLAY_RESP" -w "%{http_code}" \
  -X POST "$API_URL$TARGET_PATH" \
  -H "Content-Type: application/json" \
  "${CURL_HEADERS_REPLAY[@]}" \
  -d "$TIMELINE_JSON")"

log "Replay Response Code: $HTTP_CODE_REPLAY"
REPLAY_BODY=$(cat "$REPLAY_RESP")
if [ "$HTTP_CODE_REPLAY" == "200" ] || [ "$HTTP_CODE_REPLAY" == "201" ]; then
    log "FAIL: Replay request was NOT rejected."
    exit 1
else
    # Check for 4004 in body (Spec V1.1 Compliance)
    REPLAY_CODE=$(node -e "try{const o=JSON.parse(require('fs').readFileSync('$REPLAY_RESP','utf8'));console.log(o.code||'');}catch(e){console.log('');}")
    if [ "$REPLAY_CODE" == "4004" ]; then
        log "PASS: Replay request rejected with code 4004 (Spec V1.1 compliant)."
    else
        log "FAIL: Replay rejection code mismatch. Expected 4004, Actual: $REPLAY_CODE. Body: $REPLAY_BODY"
        exit 1
    fi
fi

# 7. Verify Audit Log
log "Verifying Audit Log Entry..."
AUDIT_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM audit_logs WHERE details::text LIKE '%$SIG_1%'" | tr -d '[:space:]')
if [ "$AUDIT_CHECK" == "0" ]; then
    log "FAIL: Audit log not found for Signature $SIG_1"
    exit 1
else
    log "PASS: Audit log found (Target Signature $SIG_1 confirmed)."
fi

# 8. Wait for Job (API Polling)
log "Waiting for Job completion (API Polling: GET /api/jobs/:id)..."
JOB_STATUS="PENDING"
for i in {1..30}; do
    GET_PATH="/api/jobs/$JOB_ID"
    HEADERS_GET_RAW=$(generate_hmac_headers_lines "GET" "$GET_PATH" "")
    CURL_HEADERS_GET=()
    while IFS= read -r line; do
      CURL_HEADERS_GET+=(-H "$line")
    done <<< "$HEADERS_GET_RAW"

    JOB_RESP="$EVIDENCE_DIR/job_status_$i.json"
    HTTP_CODE_GET="$(curl -s -o "$JOB_RESP" -w "%{http_code}" \
      -X GET "$API_URL$GET_PATH" \
      "${CURL_HEADERS_GET[@]}")"
    
    if [ "$HTTP_CODE_GET" == "200" ]; then
        JOB_STATUS="$(node -e "try{const j=require('fs').readFileSync('$JOB_RESP','utf8');console.log(JSON.parse(j).data.status);}catch(e){console.log('ERROR');}")"
    else
        log "API Polling Error: $HTTP_CODE_GET"
    fi
    
    log "Job Status: $JOB_STATUS"
    if [ "$JOB_STATUS" == "SUCCEEDED" ]; then break; fi
    if [ "$JOB_STATUS" == "FAILED" ]; then log "Job Failed!"; exit 1; fi
    sleep 2
done

if [ "$JOB_STATUS" != "SUCCEEDED" ]; then log "Timeout waiting for job."; exit 1; fi

# 9. Verify Asset (Result Asset is SCENE level)
log "Verifying generated Asset (ownerType=SCENE, ownerId=$SCENE_ID)..."
ASSET_KEY=$(psql "$DATABASE_URL" -t -c "SELECT \"storageKey\" FROM assets WHERE \"ownerId\"='$SCENE_ID' AND \"ownerType\"='SCENE' ORDER BY \"createdAt\" DESC LIMIT 1" | tr -d '[:space:]')

if [ -z "$ASSET_KEY" ]; then
    log "FAILURE: No Result Asset found for Scene $SCENE_ID"
    exit 1
fi

log "Asset Generated: $ASSET_KEY"
log "SUCCESS: CE11 Timeline Preview Commercial Closure Passed."
