#!/usr/bin/env bash
set -euo pipefail

# Config
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-dev-worker-key}"
API_SECRET="${API_SECRET:-dev-worker-secret}"
EVIDENCE_DIR="docs/_evidence/GATE_P2_EPISODE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[FATAL] missing cmd: $1"; exit 10; }; }
require_cmd curl
require_cmd jq
require_cmd node

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[FATAL] DATABASE_URL is not set."
  exit 11
fi

# Helper: HMAC Headers
hmac_headers() {
  local method="$1"
  local path="$2"
  local body="$3"
  local ts="$(date +%s)"
  local nonce="$(openssl rand -hex 16)"
  
  node -e "
    const crypto = require('crypto');
    const msg = '${API_KEY}${nonce}${ts}${body}';
    const sig = crypto.createHmac('sha256', '${API_SECRET}').update(msg).digest('hex');
    console.log('X-Api-Key: ${API_KEY}');
    console.log('X-Nonce: ${nonce}');
    console.log('X-Timestamp: ${ts}');
    console.log('X-Signature: ' + sig);
  "
}

echo "🚀 [Gate-P2] START: Episode Assembly E2E Verification"

# 1. Trigger Stage 1 Pipeline
echo "[STEP 1] Triggering Stage 1 Pipeline..."
PAYLOAD='{"novelText":"Gateway to the Galaxy: Episode Test"}'
HEADERS="$(hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$PAYLOAD")"

# Convert headers to curl array
CURL_ARGS=()
while IFS= read -r line; do CURL_ARGS+=(-H "$line"); done <<< "$HEADERS"

RESPONSE=$(curl -s -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS[@]}" \
  -d "$PAYLOAD")

echo "$RESPONSE" > "$EVIDENCE_DIR/01_trigger_response.json"
JOB_ID=$(echo "$RESPONSE" | jq -r '.data.jobId // .jobId // empty')

if [[ -z "$JOB_ID" ]]; then
  echo "[FATAL] Failed to trigger pipeline. Response: $RESPONSE"
  exit 1
fi
echo "[OK] Pipeline Job ID: $JOB_ID"

# 2. Wait for Project & Episode Creation
echo "[STEP 2] Waiting for Project and Episode creation..."
sleep 5
PROJECT_ID=$(psql "$DATABASE_URL" -At -c "SELECT \"projectId\" FROM shot_jobs WHERE id='$JOB_ID'")

if [[ -z "$PROJECT_ID" ]]; then
  echo "[FATAL] Could not determine ProjectID from Job $JOB_ID"
  exit 2
fi
echo "[OK] Project ID: $PROJECT_ID"

# Wait for Episode ID
EPISODE_ID=""
for i in {1..30}; do
  EPISODE_ID=$(psql "$DATABASE_URL" -At -c "SELECT id FROM episodes WHERE \"projectId\"='$PROJECT_ID' LIMIT 1")
  if [[ -n "$EPISODE_ID" ]]; then break; fi
  echo "Waiting for episode... ($i/30)"
  sleep 2
done

if [[ -z "$EPISODE_ID" ]]; then
  echo "[FATAL] Timeout waiting for episode creation."
  exit 3
fi
echo "[OK] Episode ID: $EPISODE_ID"

# 3. Wait for Scene Videos (TIMELINE_RENDER assets)
echo "[STEP 3] Waiting for Scene Videos generation..."
# We expect at least 1 scene video
SCENE_COUNT=0
for i in {1..60}; do
  # Check count of VIDEO assets for this episode's scenes
  # Note: Asset ownerId should be SceneID. Scene should belong to Episode.
  COUNT=$(psql "$DATABASE_URL" -At -c "
    SELECT COUNT(*) FROM assets a 
    JOIN scenes s ON a.\"ownerId\" = s.id 
    WHERE s.\"episodeId\" = '$EPISODE_ID' 
    AND a.type = 'VIDEO' 
    AND a.status = 'GENERATED';
  ")
  
  if [[ "$COUNT" -gt 0 ]]; then
    SCENE_COUNT=$COUNT
    echo "[OK] Found $COUNT scene videos."
    break
  fi
  echo "Waiting for scene videos... ($i/60)"
  sleep 5
done

if [[ "$SCENE_COUNT" -eq 0 ]]; then
  echo "[WARN] No scene videos generated. Pipeline might be slow or stuck. Proceeding anyway to test robustness (expect failure)."
  # exit 4 ? No, let's try to run EPISODE_RENDER to see it fail gracefully.
fi

# 4. Trigger EPISODE_RENDER Job
echo "[STEP 4] Triggering EPISODE_RENDER Job..."
EP_PAYLOAD="{\"projectId\":\"$PROJECT_ID\",\"episodeId\":\"$EPISODE_ID\"}"
EP_HEADERS="$(hmac_headers "POST" "/api/admin/jobs" "$EP_PAYLOAD")"
CURL_ARGS_EP=()
while IFS= read -r line; do CURL_ARGS_EP+=(-H "$line"); done <<< "$EP_HEADERS"

# Note: Admin create job endpoint is /api/admin/jobs/enqueue-test
# Body: { projectId, jobType, payload }

# EP_PAYLOAD already has projectId and episodeId
JOB_PAYLOAD="{\"projectId\":\"$PROJECT_ID\",\"jobType\":\"EPISODE_RENDER\",\"priority\":1000,\"payload\":$EP_PAYLOAD}"
JOB_HEADERS="$(hmac_headers "POST" "/api/admin/jobs/enqueue-test" "$JOB_PAYLOAD")"
CURL_ARGS_JOB=()
while IFS= read -r line; do CURL_ARGS_JOB+=(-H "$line"); done <<< "$JOB_HEADERS"

EP_JOB_RES=$(curl -s -X POST "$API_URL/api/admin/jobs/enqueue-test" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS_JOB[@]}" \
  -d "$JOB_PAYLOAD")

echo "$EP_JOB_RES" > "$EVIDENCE_DIR/04_episode_job_res.json"
EP_JOB_ID=$(echo "$EP_JOB_RES" | jq -r '.jobId // .data.jobId // .id')

if [[ -z "$EP_JOB_ID" || "$EP_JOB_ID" == "null" ]]; then
  echo "[FATAL] Failed to create EPISODE_RENDER job. Response: $EP_JOB_RES"
  exit 5
fi
echo "[OK] Episode Render Job ID: $EP_JOB_ID"

# 5. Wait for Completion
echo "[STEP 5] Waiting for Episode Render completion..."
for i in {1..60}; do
  STATUS=$(psql "$DATABASE_URL" -At -c "SELECT status FROM shot_jobs WHERE id='$EP_JOB_ID'")
  if [[ "$STATUS" == "SUCCEEDED" ]]; then
    echo "[OK] Job SUCCEEDED."
    break
  elif [[ "$STATUS" == "FAILED" ]]; then
    ERR=$(psql "$DATABASE_URL" -At -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$EP_JOB_ID'")
    echo "[FATAL] Job FAILED: $ERR"
    exit 6
  fi
  echo "Job Status: $STATUS ($i/30)"
  sleep 2
done

if [[ "$STATUS" != "SUCCEEDED" ]]; then
  echo "[FATAL] Timeout waiting for job completion."
  exit 7
fi

# 6. Verify Asset
echo "[STEP 6] Verifying Asset..."
# Workaround: Check Asset with ownerType=SCENE and ownerId=EpisodeID
ASSET_KEY=$(psql "$DATABASE_URL" -At -c "SELECT \"storageKey\" FROM assets WHERE \"ownerId\"='$EPISODE_ID' AND type='VIDEO' AND status='GENERATED'")

if [[ -z "$ASSET_KEY" ]]; then
  echo "[FATAL] Asset not found in DB."
  exit 8
fi

STORAGE_ROOT="${STORAGE_ROOT:-.data/storage}"
ABS_PATH="$STORAGE_ROOT/$ASSET_KEY"
if [[ ! -f "$ABS_PATH" ]]; then
  # Try relative to repo root if STORAGE_ROOT is relative
  if [[ -f "$(pwd)/$ABS_PATH" ]]; then
    ABS_PATH="$(pwd)/$ABS_PATH"
  else
    echo "[FATAL] File not found at $ABS_PATH"
    exit 9
  fi
fi

SIZE=$(wc -c < "$ABS_PATH")
if [[ "$SIZE" -lt 1000 ]]; then
  echo "[FATAL] File size too small: $SIZE bytes"
  exit 10
fi

echo "[SUCCESS] Episode Rendered! Path: $ABS_PATH Size: $SIZE bytes"
exit 0
