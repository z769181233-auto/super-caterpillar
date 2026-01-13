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
# --- Cleanup Trap ---
cleanup() {
    if [ -n "${API_PID:-}" ]; then
        log "Cleaning up API process $API_PID..."
        kill "$API_PID" || true
    fi
    if [ -n "${WORKER_PID:-}" ]; then
        log "Cleaning up Worker process $WORKER_PID..."
        kill "$WORKER_PID" || true
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
WORKER_PID=""
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

# 2. Shared Auth & Seeding
# Sources: VALID_API_KEY_ID, API_SECRET, ORG_ID, PROJ_ID, SHOT_ID_1 etc.
source tools/gate/lib/gate_auth_seed.sh
PROJECT_ID="$PROJ_ID"

# 3. Start Worker (With Valid Auth)
log "Starting Worker..."
LOG_FILE_WORKER="$EVIDENCE_DIR/worker.log"
export API_URL="$API_URL"
# Ensure 'ce11_timeline_preview' is supported
export WORKER_SUPPORTED_ENGINES="pipeline_timeline_compose,timeline_render,pipeline_orchestrator,ce11,ce11_timeline_preview"
export STAGE3_ENGINE_MODE=REPLAY
export WORKER_API_KEY="$VALID_API_KEY_ID"
export WORKER_API_SECRET="${API_SECRET_KEY:-$API_SECRET}"

npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$LOG_FILE_WORKER" 2>&1 &
WORKER_PID=$!
log "Worker started with PID: $WORKER_PID."
sleep 5

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

# 4. Engine Registration & Asset Prep (Specific to this test)
GATE_UID="$(date +%s)_$RANDOM"
# Register Engine (TIMELINE_PREVIEW)
psql "$DATABASE_URL" -c "INSERT INTO \"engines\" (id, \"engineKey\", \"adapterName\", \"adapterType\", mode, config, enabled, code, \"isActive\", name, type, \"createdAt\", \"updatedAt\") VALUES ('eng_preview_${GATE_UID}', 'ce11_timeline_preview', 'preview', 'real', 'http', '{}', true, 'ce11_timeline_preview', true, 'Timeline Preview Gate', 'TIMELINE_PREVIEW', NOW(), NOW()) ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, mode = EXCLUDED.mode, enabled = true, \"isActive\" = true;" > /dev/null

log "Seeding Assets and Timeline JSON..."

# 6. Source Assets (SHOT level)
DUMMY_ASSET_ID="asset_gate_ce11_${GATE_UID}"
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

# 8. Poll for Completion (Strict Fail-Fast)
log "Waiting for Job completion (Strict Fail-Fast)..."
JOB_STATUS_URL="/api/jobs/$JOB_ID"
MAX_RETRIES=60 # 2s * 60 = 120s timeout

for ((i=1; i<=MAX_RETRIES; i++)); do
    # Generate HMAC Headers for GET request
    # Note: GET request has empty body, so body hash is empty string
    POLL_HEADERS_RAW=$(generate_hmac_headers_lines "GET" "$JOB_STATUS_URL" "")
    CURL_HEADERS_POLL=()
    while IFS= read -r line; do
        CURL_HEADERS_POLL+=(-H "$line")
    done <<< "$POLL_HEADERS_RAW"

    RESP_POLL="$EVIDENCE_DIR/poll_${i}.json"
    HTTP_CODE_POLL="$(curl -s -o "$RESP_POLL" -w "%{http_code}" \
      -X GET "$API_URL$JOB_STATUS_URL" \
      "${CURL_HEADERS_POLL[@]}")"

    if [ "$HTTP_CODE_POLL" != "200" ]; then
        log "WARN: Poll $i failed with $HTTP_CODE_POLL"
        cat "$RESP_POLL" >> "$EVIDENCE_DIR/gate.log"
    else
        # Extract Status
        JOB_STATUS=$(node -e "try{const o=JSON.parse(require('fs').readFileSync('$RESP_POLL','utf8'));console.log(o.status||'');}catch(e){}")
        log "Poll $i: $JOB_STATUS"

        if [ "$JOB_STATUS" == "SUCCEEDED" ]; then
            log "Job SUCCEEDED."
            # Extract Result Asset
            cat "$RESP_POLL" | tee "$EVIDENCE_DIR/final_job.json"
            break
        elif [ "$JOB_STATUS" == "FAILED" ]; then
            log "FAILURE: Job Failed."
            cat "$RESP_POLL" | tee -a "$EVIDENCE_DIR/gate.log"
            # Dump Worker Log
            log "--- WORKER LOG TAIL ---"
            tail -n 50 "$LOG_FILE_WORKER" | tee -a "$EVIDENCE_DIR/gate.log"
            exit 42
        fi
    fi
    sleep 2
done

if [ "$JOB_STATUS" != "SUCCEEDED" ]; then
    log "FAILURE: Timeout waiting for Job SUCCEEDED."
    log "--- WORKER LOG TAIL ---"
    tail -n 100 "$LOG_FILE_WORKER" | tee -a "$EVIDENCE_DIR/gate.log"
    exit 42
fi

# 9. Verify Asset (Result Asset via API or DB)
log "Verifying generated Asset..."
# Use DB for absolute truth check (Hard Seal)
ASSET_KEY=$(psql "$DATABASE_URL" -t -c "SELECT \"storageKey\" FROM assets WHERE \"ownerId\"='$SCENE_ID' AND \"ownerType\"='SCENE' ORDER BY \"createdAt\" DESC LIMIT 1" | tr -d '[:space:]')

if [ -z "$ASSET_KEY" ]; then
    log "FAILURE: No Result Asset found for Scene $SCENE_ID in DB."
    exit 42
fi

log "Asset Generated: $ASSET_KEY"
log "SUCCESS: CE11 Timeline Preview Commercial Closure Passed (HARD)."
