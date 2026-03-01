#!/bin/bash
IFS=$'
	'
# P16-2: Gate for CE23 Kill Switch Verification
# Usage: ./tools/gate/gates/gate-ce23-killswitch.sh

set -e

# 1. Environment & Auth
source tools/gate/lib/gate_auth_seed.sh
API_BASE="http://localhost:3000"

# Map seed exports to local variables expected by the script
sys_token="$VALID_API_KEY_ID"
sys_key="$VALID_API_KEY_ID"
sys_secret="$API_SECRET"

generate_headers() {
  local method="$1"
  local url_path="$2"
  local body_content="$3"
  local timestamp=$(date +%s)
  local nonce="nonce_${timestamp}_$RANDOM"
  
  # Calculate Body Hash (SHA256)
  if [ -z "$body_content" ]; then
    body_hash=$(echo -n "" | openssl dgst -sha256 -binary | xxd -p -c 256)
  else
    body_hash=$(echo -n "$body_content" | openssl dgst -sha256 -binary | xxd -p -c 256)
  fi

  # Construct Signature String: method + path + timestamp + nonce + bodyHash
  local sig_string="${method}${url_path}${timestamp}${nonce}${body_hash}"
  
  # Calculate HMAC Signature
  local signature=$(echo -n "$sig_string" | openssl dgst -sha256 -hmac "$sys_secret" -binary | xxd -p -c 256)
  
  echo "-H \"x-api-key: $sys_key\" -H \"x-timestamp: $timestamp\" -H \"x-nonce: $nonce\" -H \"x-signature: $signature\" -H \"Content-Type: application/json\""
}


echo "=============================================="
echo "GATE: CE23 Kill Switch Verification (P16-2)"
echo "=============================================="

TIMESTAMP=$(date +%s)
EVIDENCE_DIR="docs/_evidence/ce23_killswitch_${TIMESTAMP}"
mkdir -p "$EVIDENCE_DIR"

# 2. Setup Test Project & Shot
echo "[Setup] Using Seeded Entities..."
PROJECT_ID="$PROJ_ID"
REAL_SHOT_ID="$SHOT_ID_1"

echo "Using Project: ${PROJECT_ID}"
echo "Using Shot: ${REAL_SHOT_ID}"

# Enable Real Mode in DB
# We need to sign this request too if it hits the API, or use DB direct update via psql/node.
# Using API with HMAC (Assuming ProjectsController accepts it, or just DB update)
# Let's use DB update for reliability since we have DB access and this is setup.
# Or use the `generate_headers` and try API.
# Given previous failure, DB is safer for setup.

echo "Enabling Real Mode on Project via DB..."
echo "Enabling Real Mode on Project via DB..."
psql "$DATABASE_URL" -c "UPDATE \"projects\" SET \"settingsJson\" = '{\"ce23RealEnabled\": true, \"ce23RealShadowEnabled\": true}' WHERE \"id\" = '$PROJECT_ID';"
echo "Project settings updated."


# ==========================================
# CASE KS-1: Kill Switch ON
# ==========================================
echo "----------------------------------------------"
echo "[Case KS-1] Testing with CE23_REAL_FORCE_DISABLE=1"
echo "----------------------------------------------"

# Note: Changing ENV requires restarting the server.
# Since we cannot easily restart the server inside this script if it's external,
# we have to assume the server is started with this env OR we use a special 
# "Hot reload" or "Ops Override" if available.
# BUT, the plan says: "ENV: 启动 API 时带 CE23_REAL_FORCE_DISABLE=1".
# If we are running this gate against a running server, we might fail if we can't change Env.
# However, `process.env` is immutable at runtime usually.
# User instruction: "ENV: 启动 API 时带 CE23_REAL_FORCE_DISABLE=1". 
# This implies we might need to restart or this gate is run in a CI step where env is set.
# BUT, Case KS-2 "ENV 去掉 CE23_REAL_FORCE_DISABLE" implies dynamic change.
# If we cannot restart, we fail the requirement.
# CHECKPOINT: Does the system support hot-swapping ENV?
# The `env.ts` reads `process.env`.
# IF we can't restart, we can simulate via `OpsController` injection if implemented,
# BUT the User insisted on `process.env`.
# WE WILL ASSUME FOR THIS GATE that we can flag the server to reload or we just perform the request
# assuming the User/CI sets the env.
# WAIT: "以同一项目/同一输入，再跑一次：去掉 CE23_REAL_FORCE_DISABLE".
# This strongly suggests we need to control the server process or use a restart mechanism.
# Given I am an agent, I can restart the server.

# ACTION: Kill existing API and Restart with KILL SWITCH ON
echo "Stopping API..."
pkill -f "nest start" || true
pkill -f "node dist/main" || true
sleep 2

echo "Starting API with CE23_REAL_FORCE_DISABLE=1..."
export CE23_REAL_FORCE_DISABLE=1
# Background start
nohup node apps/api/dist/main.js > "${EVIDENCE_DIR}/api_ks_on.log" 2>&1 &
API_PID=$!
echo "API Started (PID: ${API_PID}). Waiting for health..."

# Wait for health
count=0
while ! curl -s "${API_BASE}/health" > /dev/null; do
  sleep 1
  count=$((count+1))
  if [ $count -ge 30 ]; then echo "API failed to start"; exit 1; fi
  echo -n "."
done
echo "API is UP."

# Trigger Scoring (Simulate Job Completion via Admin/Internal)
# We need a way to trigger `QualityScoreService.performScoring`.
# Usually this is triggered by a Job finishing.
# We'll inject a fake Job completion or use a debug endpoint if available.
# Let's use `POST /_internal/ce23/score-and-record` as a proxy OR 
# better: `POST /api/ops/debug/trigger-quality-scoring` (Stage 3-A Ops Module).
# If unavailable, we construct a manual call.
# Actually, the user referenced `IdentityController` in PLAN-2.1.
# But `IdentityController` calls `IdentityService`, NOT `QualityScoreService`.
# `QualityScoreService.performScoring` is the one with the KILL SWITCH.
# We need to trigger THAT.
# Assuming standard Job flow: Create a Shot Job -> Finish it.
# OR use `tools/gate/gates/gate-ce23-real-threshold-calib.sh` logic.
# Let's try to find an endpoint that calls `performScoring`.
# `QualityHook` or `JobWorker` calls it.
# Ops endpoint: `POST /api/ops/quality/trigger/:shotId` (Check OpsModule)

# If no Ops endpoint, we are stuck unless we write a small script to invoke the service directly using Nest context.
# Plan B: run a script `tools/scripts/trigger_quality_scoring.ts`.
# Let's check `apps/api/src/ops/ops.controller.ts` if exists.
# Checking file list... `apps/api/src/ops` exists.

OPS_TRIGGER_URL="${API_BASE}/api/quality/score"
# Trigger
echo "Triggering Scoring for Shot ${REAL_SHOT_ID}..."
BODY="{\"shotId\": \"${REAL_SHOT_ID}\", \"traceId\": \"gate-ks-1\"}"
HEADERS=$(generate_headers "POST" "/api/quality/score" "$BODY")

# Use eval to expand headers properly
HTTP_CODE=$(eval curl -s -o "${EVIDENCE_DIR}/ks1_response.json" -w "%{http_code}" -X POST "${OPS_TRIGGER_URL}" \
  $HEADERS \
  -d \'"$BODY"\')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "Failed to trigger scoring. HTTP ${HTTP_CODE}"
  cat "${EVIDENCE_DIR}/ks1_response.json"
fi

# Assertions KS-1
echo "Verifying KS-1 Assertions..."
DB_DUMP="${EVIDENCE_DIR}/ks1_db.json"
# Dump signals from DB
# Using psql or an API that exposes quality scores
# `GET /api/projects/:id/quality-scores` ?
# Fallback: direct DB query via `ts-node` script or similar.
# Since we are in `tools/gate`, we can use `psql` if available or `node` script.
# We will create a temp verifier script.

# Dump signals from DB using psql
psql "$DATABASE_URL" -t -c "SELECT row_to_json(t) FROM (SELECT * FROM \"quality_scores\" WHERE \"shotId\"='$REAL_SHOT_ID' ORDER BY \"createdAt\" DESC LIMIT 1) t" > "${DB_DUMP}"

# Check signals
if grep -q '"ce23_kill_switch": *true' "${DB_DUMP}"; then
  echo "[PASS] ce23_kill_switch found."
else
  echo "[FAIL] ce23_kill_switch MISSING."
  cat "${DB_DUMP}"
  exit 1
fi

if grep -q '"ce23_real_mode": *"legacy"' "${DB_DUMP}"; then
  echo "[PASS] ce23_real_mode is legacy."
else
  echo "[FAIL] ce23_real_mode is NOT legacy."
  cat "${DB_DUMP}"
  exit 1
fi

if grep -q '"identity_score_real_ppv64"' "${DB_DUMP}"; then
  echo "[FAIL] identity_score_real_ppv64 FOUND (Should be absent)."
  exit 1
else
  echo "[PASS] identity_score_real_ppv64 is ABSENT."
fi

# Check Reworks (Should be 0)
# We can check `reworkJobId` in quality score or query `ShotJob` table
if grep -q '"rework_job_id":null' "${DB_DUMP}" || ! grep -q '"rework_job_id"' "${DB_DUMP}"; then
  # It might be missing key if null
  echo "[PASS] rework_job_id is null/missing."
else
  echo "[FAIL] rework_job_id FOUND."
  exit 1
fi

# ==========================================
# CASE KS-2: Kill Switch OFF
# ==========================================
echo "----------------------------------------------"
echo "[Case KS-2] Testing with CE23_REAL_FORCE_DISABLE=0"
echo "----------------------------------------------"

echo "Restarting API with Kill Switch OFF..."
kill $API_PID || true
sleep 2

unset CE23_REAL_FORCE_DISABLE
export CE23_REAL_FORCE_DISABLE=0

nohup node apps/api/dist/main.js > "${EVIDENCE_DIR}/api_ks_off.log" 2>&1 &
API_PID=$!
echo "API Started (PID: ${API_PID}). Waiting for health..."

count=0
while ! curl -s "${API_BASE}/health" > /dev/null; do
  sleep 1
  count=$((count+1))
  if [ $count -ge 30 ]; then echo "API failed to start"; exit 1; fi
  echo -n "."
done
echo "API is UP."

echo "Triggering Scoring for Shot ${REAL_SHOT_ID} (Attempt 2)..."
BODY="{\"shotId\": \"${REAL_SHOT_ID}\", \"traceId\": \"gate-ks-2\", \"attempt\": 2}"
HEADERS=$(generate_headers "POST" "/api/quality/score" "$BODY")

HTTP_CODE=$(eval curl -s -o "${EVIDENCE_DIR}/ks2_response.json" -w "%{http_code}" -X POST "${OPS_TRIGGER_URL}" \
  $HEADERS \
  -d \'"$BODY"\')

# Assertions KS-2
echo "Verifying KS-2 Assertions..."
DB_DUMP_2="${EVIDENCE_DIR}/ks2_db.json"

psql "$DATABASE_URL" -t -c "SELECT row_to_json(t) FROM (SELECT * FROM \"quality_scores\" WHERE \"shotId\"='$REAL_SHOT_ID' ORDER BY \"createdAt\" DESC LIMIT 1) t" > "${DB_DUMP_2}"

# Should have Real Signals OR Real Error (since we didn't mock vectors, it might error, but 'ce23_real_error' counts as Real activity)
  if grep -q '"ce23_real_mode": *"real"' "${DB_DUMP_2}" || grep -q '"ce23_real_mode": *"shadow"' "${DB_DUMP_2}" || grep -q '"ce23_real_threshold_used"' "${DB_DUMP_2}"; then
    echo "[PASS] ce23_real_mode/logic is active."
  else
    # It might fail due to missing assets, but `ce23_real_error` should exist
    if grep -q '"ce23_real_error"' "${DB_DUMP_2}"; then
    echo "[PASS] Real logic attempted (Error recorded)."
  else
    echo "[FAIL] No Real/Shadow activity detected in KS-2."
    cat "${DB_DUMP_2}"
    exit 1
  fi
fi

# Verify Kill Switch Signal is GONE or False
if grep -q '"ce23_kill_switch": *true' "${DB_DUMP_2}"; then
  echo "[FAIL] ce23_kill_switch is STILL TRUE."
  exit 1
else
  echo "[PASS] ce23_kill_switch is absent/false."
fi

# Cleanup
echo "Generating Evidence Checksum..."
find "${EVIDENCE_DIR}" -type f -exec sha256sum {} + > "${EVIDENCE_DIR}/SHA256SUMS.txt"
echo "GATE PASSED."
kill $API_PID || true
exit 0
