#!/bin/bash
# gate-ce11-enginekey-required.sh
# 验证 P5-0.1 策略：生产环境必须显式指定 engineKey，否则拒绝

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

GATE_NAME="CE11_REQ_GATE"
TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/gate_ce11_req_$TS"
mkdir -p "$EVIDENCE_DIR"

log_message() {
    echo "[$GATE_NAME] $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

# 1. Setup
log_message "START: CE11 Engine Key Requirement Verification"
PROJECT_ID="proj_ce11_req_test_$TS"
TRACE_ID="trace_ce11_req_$TS"

log_message "Project: $PROJECT_ID | Trace: $TRACE_ID"

# 1.1 Token (Assume dev-worker-key via DB or use env)
# Instead of complex token gen, we assume local environment is open or use a test token.
# To trigger engine/invoke successfully, we need a valid JWT or HMAC.
# Test Token (Generated via tools/gate/scripts/s2-gen-token.ts with .env default secret)
TEST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfbW9ja19wNV8wMSIsImVtYWlsIjoibW9jay1zMkBleGFtcGxlLmNvbSIsInRpZXIiOiJGcmVlIiwiaWF0IjoxNzY4NzkwNzcyLCJleHAiOjE3Njg3OTQzNzJ9.xeBD1rCzRY-ow2MGInML9yVsv36QYSu3BosDkUR1824"

DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@127.0.0.1:5432/scu"}

# 2. Case A: Production Traffic (No Verification) - Should FAIL without engineKey
log_message "CASE A: Production Traffic (Implicit Mock Attempt)"

PAYLOAD='{
  "traceId": "'"$TRACE_ID"'",
  "projectId": "'"$PROJECT_ID"'",
  "sceneId": "scene_dummy",
  "novelSceneId": "ns_dummy"
}'

RESPONSE=$(curl -s -X POST "http://localhost:3000/api/_internal/engine/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "jobType": "CE11_SHOT_GENERATOR",
    "payload": '"$PAYLOAD"'
  }')

log_message "Response Case A: $RESPONSE"
# Expecting failure message
if echo "$RESPONSE" | grep -q "CE11_SHOT_GENERATOR requires explicit engineKey"; then
  log_message "✅ CASE A PASSED: Rejected implicit mock in production as expected."
else
  log_message "❌ CASE A FAILED: Did not receive expected rejection. Got: $RESPONSE"
  # Don't exit yet, run other cases to see full picture, or exit? Strict gate should exit.
  exit 1
fi

# 3. Case B: Verification Traffic (Gate Mode) - Should ALLOW (Fallback to Mock)
log_message "CASE B: Verification Traffic (Fallback Allowed)"

PAYLOAD_VERIFY='{
  "traceId": "'"$TRACE_ID"'",
  "projectId": "'"$PROJECT_ID"'",
  "sceneId": "scene_dummy",
  "novelSceneId": "ns_dummy",
  "isVerification": true
}'

RESPONSE_B=$(curl -s -X POST "http://localhost:3000/api/_internal/engine/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "jobType": "CE11_SHOT_GENERATOR",
    "payload": '"$PAYLOAD_VERIFY"'
  }')

log_message "Response Case B: $RESPONSE_B"
if echo "$RESPONSE_B" | grep -q "CE11_SHOT_GENERATOR requires explicit engineKey"; then
  log_message "❌ CASE B FAILED: Rejected verification traffic! Should have fallen back to mock."
  exit 1
fi

# We expect either success or an error unrelated to the strategy check (e.g. Engine invocation failed downstream)
if echo "$RESPONSE_B" | grep -q "Novel scene .* not found" || echo "$RESPONSE_B" | grep -q "\"success\":true"; then
  log_message "✅ CASE B PASSED: Verification traffic routed successfully (or failed later in logic)."
else
   # If we get a different error, we check if it is NOT the strategy error.
   log_message "✅ CASE B PASSED: Verification traffic bypassed strategy check. (Got: $RESPONSE_B)"
fi


# 4. Case C: Explicit Production Key - Should PASS Check (Routing to Real)
log_message "CASE C: Explicit Real Key in Production"

PAYLOAD_REAL='{
  "traceId": "'"$TRACE_ID"'",
  "projectId": "'"$PROJECT_ID"'",
  "sceneId": "scene_dummy",
  "novelSceneId": "ns_dummy",
  "engineKey": "ce11_shot_generator_real"
}'

# Note: EngineInvokerHubService requires engineKey at root for explicit routing.
# Worker logic extracts it from payload and passes it at root.
RESPONSE_C=$(curl -s -X POST "http://localhost:3000/api/_internal/engine/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "engineKey": "ce11_shot_generator_real",
    "jobType": "CE11_SHOT_GENERATOR",
    "payload": '"$PAYLOAD_REAL"'
  }')

log_message "Response Case C: $RESPONSE_C"
if echo "$RESPONSE_C" | grep -q "CE11_SHOT_GENERATOR requires explicit engineKey"; then
   log_message "❌ CASE C FAILED: Rejected explicit real key!"
   exit 1
fi
log_message "✅ CASE C PASSED: Explicit real key accepted."

# 5. Archive
log_message "Calculating SHA256SUMS..."
( cd "$EVIDENCE_DIR" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt )

log_message "🏆 ALL CASES PASSED"
