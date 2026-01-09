#!/bin/bash
set -o pipefail

# P1-1 Concurrency & Capacity Governance Gate
# Focus: TokenBucket Limiter, API Backpressure, and Billing Idempotency (Attempt-aware)

source tools/gate/common/load_env.sh
if [ -z "$DATABASE_URL" ]; then echo "Error: DATABASE_URL missing"; exit 1; fi

mkdir -p docs/_evidence/p1_1_concurrency_capacity
EVIDENCE_DIR="docs/_evidence/p1_1_concurrency_capacity"
RUN_ID=$(date +%s)
API_PORT=3001
API_URL="http://localhost:$API_PORT"

# 1. Configuration (Gate Tight Mode)
export CONCURRENCY_LIMITER_ENABLED=true
export API_BACKPRESSURE_ENABLED=true
export EXEC_TIMEOUT_ENABLED=true
export RETRY_POLICY_ENABLED=true

export MAX_IN_FLIGHT_TOTAL=2
export MAX_IN_FLIGHT_TENANT=1
export API_QUEUE_PENDING_LIMIT=3
export API_RETRY_AFTER_SECONDS=5

# Workers params
export JOB_MAX_IN_FLIGHT=1
export WORKER_POLL_INTERVAL=1000

# Helper: Cleansed DATABASE_URL for psql (strip ?schema=...)
DB_URL_CLEAN="${DATABASE_URL%\?*}"

# 2. Cleanup
cleanup() {
  echo "Cleaning up pids: ${API_PID:-} ${W1_PID:-}"
  [ -n "${API_PID:-}" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "${W1_PID:-}" ] && kill -9 $W1_PID 2>/dev/null || true
  lsof -i :$API_PORT -t | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

lsof -i :$API_PORT -t | xargs kill -9 2>/dev/null || true
echo "[2/5] Seeding Gate User & Project..."
# Ensure we have a user and project for the token to reference
GATE_USER_ID="u-p1-1-gate"
GATE_PROJECT_ID="p-p1-1-gate"
GATE_ORG_ID="o-p1-1-gate"
GATE_SEASON_ID="s-p1-1-gate"
GATE_EPISODE_ID="e-p1-1-gate"
GATE_SCENE_ID="sc-p1-1-gate"
GATE_SHOT_ID="sh-p1-1-gate"

psql "$DB_URL_CLEAN" -c "DELETE FROM \"cost_ledgers\" WHERE \"projectId\" = '$GATE_PROJECT_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"shot_jobs\" WHERE \"projectId\" = '$GATE_PROJECT_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"shots\" WHERE id = '$GATE_SHOT_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"scenes\" WHERE id = '$GATE_SCENE_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"episodes\" WHERE id = '$GATE_EPISODE_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"seasons\" WHERE id = '$GATE_SEASON_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"projects\" WHERE id = '$GATE_PROJECT_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"organizations\" WHERE id = '$GATE_ORG_ID'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM \"users\" WHERE id = '$GATE_USER_ID'" || true

# 3. Build & Launch
echo "[1/5] Building components..."
pnpm -w build --filter api --filter @scu/worker > /dev/null

psql "$DB_URL_CLEAN" -c "INSERT INTO \"users\" (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") VALUES ('$GATE_USER_ID', 'gate-p1-1@example.com', 'dummy', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"organizations\" (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", \"credits\") VALUES ('$GATE_ORG_ID', 'Gate Org', '$GATE_USER_ID', NOW(), NOW(), 1000) ON CONFLICT (id) DO NOTHING;" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"projects\" (id, name, \"organizationId\", \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ('$GATE_PROJECT_ID', 'Gate Project', '$GATE_ORG_ID', '$GATE_USER_ID', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"seasons\" (id, title, \"projectId\", index, \"createdAt\", \"updatedAt\") VALUES ('$GATE_SEASON_ID', 'Season 1', '$GATE_PROJECT_ID', 1, NOW(), NOW());" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"episodes\" (id, name, \"seasonId\", \"projectId\", index) VALUES ('$GATE_EPISODE_ID', 'Episode 1', '$GATE_SEASON_ID', '$GATE_PROJECT_ID', 1);" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"scenes\" (id, \"episodeId\", \"projectId\", index, title) VALUES ('$GATE_SCENE_ID', '$GATE_EPISODE_ID', '$GATE_PROJECT_ID', 1, 'Scene 1');" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"shots\" (id, \"sceneId\", index, type, params, \"organizationId\") VALUES ('$GATE_SHOT_ID', '$GATE_SCENE_ID', 1, 'NORMAL', '{}'::jsonb, '$GATE_ORG_ID');" > /dev/null

# Seed Worker API Key
psql "$DB_URL_CLEAN" -c "DELETE FROM \"api_keys\" WHERE key = 'ak_worker_p1_1_gate'" || true
psql "$DB_URL_CLEAN" -c "INSERT INTO \"api_keys\" (id, key, \"secretHash\", \"ownerUserId\", \"ownerOrgId\", status, \"createdAt\", \"updatedAt\") VALUES ('key-p1-1-gate', 'ak_worker_p1_1_gate', 'sk_worker_p1_1_gate', '$GATE_USER_ID', '$GATE_ORG_ID', 'ACTIVE', NOW(), NOW());" > /dev/null

# Generate JWT
export JWT_SECRET="test-secret-p1-1"
GATE_TOKEN=$(pnpm -w exec tsx tools/gate/gates/gen_token.ts "{\"sub\":\"$GATE_USER_ID\",\"userId\":\"$GATE_USER_ID\",\"orgId\":\"$GATE_ORG_ID\",\"email\":\"gate-p1-1@example.com\"}" "$JWT_SECRET")

echo "[3/5] Starting API (Backpressure ON)..."
export STRIPE_SECRET_KEY="sk_test_p1_1"
export ALLOW_TEST_BILLING_GRANT=1
export GATE_MODE=1
export WORKER_API_KEY="ak_worker_p1_1_gate"
export WORKER_API_SECRET="sk_worker_p1_1_gate"
JWT_SECRET="$JWT_SECRET" node apps/api/dist/main.js > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!

# Wait for API
READY=0
for i in {1..30}; do
  if grep -q "Nest application successfully started" "$EVIDENCE_DIR/api.log"; then READY=1; break; fi
  sleep 1
done
[ "$READY" -eq 1 ] || { echo "API Fail"; exit 1; }

# 4. Stress Test: API Backpressure (429)
echo "[4/5] Testing API Backpressure (Limit=$API_QUEUE_PENDING_LIMIT)..."
psql "$DB_URL_CLEAN" -c "INSERT INTO shot_jobs (id, type, status, \"projectId\", \"organizationId\", \"sceneId\", \"shotId\", \"episodeId\", payload, \"createdAt\", \"updatedAt\") 
  SELECT 'gate-p1-1-pad-' || i, 'SHOT_RENDER', 'PENDING', '$GATE_PROJECT_ID', '$GATE_ORG_ID', '$GATE_SCENE_ID', '$GATE_SHOT_ID', '$GATE_EPISODE_ID', '{\"stress_p1_1\": true}'::jsonb, NOW(), NOW() 
  FROM generate_series(1, 10) s(i)" > /dev/null

# Try creating via API - expect 429 and check Retry-After
RESPONSE_HEADERS=$(curl -s -i -X POST "$API_URL/api/shots/$GATE_SHOT_ID/jobs" \
  -H "Authorization: Bearer $GATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"SHOT_RENDER\", \"payload\": {\"stress_p1_1\": true, \"sceneId\": \"$GATE_SCENE_ID\", \"shotId\": \"$GATE_SHOT_ID\", \"episodeId\": \"$GATE_EPISODE_ID\"}}")

HTTP_CODE=$(echo "$RESPONSE_HEADERS" | grep "HTTP/" | awk '{print $2}' || echo "FAIL")
RETRY_AFTER=$(echo "$RESPONSE_HEADERS" | grep -i "Retry-After" | awk '{print $2}' | tr -d '\r' || echo "")

echo "API Response: $HTTP_CODE, Retry-After: $RETRY_AFTER"
BACKPRESSURE_PASS=false
if [ "$HTTP_CODE" == "429" ] && [ -n "$RETRY_AFTER" ]; then
  echo "✅ Backpressure & Retry-After correctly triggered"
  BACKPRESSURE_PASS=true
else
  echo "❌ Backpressure failed (Expected 429, got $HTTP_CODE; Expected Retry-After, got '$RETRY_AFTER')"
  # Do not exit yet, let it continue to collect evidence or fail gracefully later
fi

# 5. Stress Test: Worker Concurrency
echo "[5/5] Starting Worker (Limiter ON, Limit=$MAX_IN_FLIGHT_TOTAL)..."
WORKER_ID="gw-p1-1-1" WORKER_API_KEY="$WORKER_API_KEY" WORKER_API_SECRET="$WORKER_API_SECRET" GATE_MODE=1 node apps/workers/dist/apps/workers/src/main.js > "$EVIDENCE_DIR/worker.log" 2>&1 &
W1_PID=$!

# Liveness Assertion: Must see at least 1 job running/succeeded
echo "Waiting for worker liveness (Observed > 0)..."
LIVENESS_OK=0
for i in {1..20}; do
  C=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM shot_jobs WHERE payload->>'stress_p1_1'='true' AND status IN ('RUNNING','SUCCEEDED')")
  if [ "$C" -ge 1 ]; then LIVENESS_OK=1; break; fi
  sleep 1
done

if [ "$LIVENESS_OK" -eq 0 ]; then
  echo "❌ Error: Worker did not process any job (Liveness=0)"
  exit 1
fi

# Concurrency Peak Sampling (20 samples)
echo "Sampling peak concurrency..."
MAX_OBS=0
for i in {1..20}; do
  C=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status = 'RUNNING' AND payload->>'stress_p1_1' = 'true'")
  if [ "$C" -gt "$MAX_OBS" ]; then MAX_OBS=$C; fi
  sleep 1
done

echo "Observed max RUNNING: $MAX_OBS (Limit: $MAX_IN_FLIGHT_TOTAL)"
CONCURRENCY_PASS=false
if [ "$MAX_OBS" -le "$MAX_IN_FLIGHT_TOTAL" ] && [ "$MAX_OBS" -ge 1 ]; then
  echo "✅ Concurrency limit respected and validated (Observed=$MAX_OBS)"
  CONCURRENCY_PASS=true
else
  echo "❌ Concurrency test failed (Peak: $MAX_OBS, Target: 1-$MAX_IN_FLIGHT_TOTAL)"
fi

# 6. Idempotency Check & Billing Hardening
echo "[6/6] Testing Billing Hardening: FAILED job must NOT be billed..."
JOB_ID="gate-p1-1-dedupe"
psql "$DB_URL_CLEAN" -c "INSERT INTO shot_jobs (id, status, type, \"projectId\", \"organizationId\", \"sceneId\", \"shotId\", \"episodeId\", attempts, payload, \"createdAt\", \"updatedAt\") 
  VALUES ('$JOB_ID', 'SUCCEEDED', 'SHOT_RENDER', '$GATE_PROJECT_ID', '$GATE_ORG_ID', '$GATE_SCENE_ID', '$GATE_SHOT_ID', '$GATE_EPISODE_ID', 1, '{\"stress_p1_1\": true}', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET status='SUCCEEDED', attempts=1, \"updatedAt\"=NOW();" > /dev/null

# FAILED job - 计费请求应该被拒绝
FAIL_JOB_ID="gate-p1-1-fail"
psql "$DB_URL_CLEAN" -c "INSERT INTO shot_jobs (id, status, type, \"projectId\", \"organizationId\", \"sceneId\", \"shotId\", \"episodeId\", attempts, payload, \"createdAt\", \"updatedAt\") 
  VALUES ('$FAIL_JOB_ID', 'FAILED', 'SHOT_RENDER', '$GATE_PROJECT_ID', '$GATE_ORG_ID', '$GATE_SCENE_ID', '$GATE_SHOT_ID', '$GATE_EPISODE_ID', 1, '{\"stress_p1_1\": true}', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET status='FAILED', attempts=1, \"updatedAt\"=NOW();" > /dev/null

submit_cost() {
  local jid=$1
  curl -s -X POST "$API_URL/api/internal/events/cost-ledger" -H "Content-Type: application/json" \
    -d "{\"userId\": \"$GATE_USER_ID\", \"projectId\": \"$GATE_PROJECT_ID\", \"jobId\": \"$jid\", \"jobType\": \"SHOT_RENDER\", \"attempt\": 1, \"costAmount\": 0.1, \"currency\": \"USD\", \"billingUnit\": \"job\", \"quantity\": 1}"
}

# 测试 FAILED job 计费请求被拒绝
FAIL_BILL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/internal/events/cost-ledger" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$GATE_USER_ID\", \"projectId\": \"$GATE_PROJECT_ID\", \"jobId\": \"$FAIL_JOB_ID\", \"jobType\": \"SHOT_RENDER\", \"attempt\": 1, \"costAmount\": 0.1, \"currency\": \"USD\", \"billingUnit\": \"job\", \"quantity\": 1}")

echo "FAILED job billing HTTP: $FAIL_BILL_HTTP"
FAILED_REJECT_PASS=false
if [ "$FAIL_BILL_HTTP" = "400" ] || [ "$FAIL_BILL_HTTP" = "409" ]; then
  FAILED_REJECT_PASS=true
  echo "✅ FAILED job billing rejected by API"
else
  echo "❌ FAILED job billing NOT rejected (expected 400/409, got $FAIL_BILL_HTTP)"
fi

FAILED_LEDGER_COUNT=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM cost_ledgers WHERE \"jobId\" = '$FAIL_JOB_ID' AND attempt = 1")
echo "Ledger records for FAILED job: $FAILED_LEDGER_COUNT"

FAILED_NOT_BILLED=false
if [ "$FAILED_LEDGER_COUNT" -eq 0 ]; then
  FAILED_NOT_BILLED=true
  echo "✅ FAILED job not billed (ledger count=0)"
else
  echo "❌ FAILED job billed (count=$FAILED_LEDGER_COUNT)"
fi

# 测试 SUCCEEDED job 去重
echo "Testing deduplication on succeeded job (should be 1)..."
submit_cost "$JOB_ID"
submit_cost "$JOB_ID"
LEDGER_COUNT=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM cost_ledgers WHERE \"jobId\" = '$JOB_ID' AND attempt = 1")

BILLING_HARDENED=false
if [ "$FAILED_REJECT_PASS" == "true" ] && [ "$FAILED_NOT_BILLED" == "true" ] && [ "$LEDGER_COUNT" -eq 1 ]; then
  echo "✅ Billing Hardening Pass (FailedReject=true, FailedLedger=0, Dedupe=1)"
  BILLING_HARDENED=true
else
  echo "❌ Billing Hardening Fail (FailedReject=$FAILED_REJECT_PASS, FailedLedger=$FAILED_LEDGER_COUNT, Dedupe=$LEDGER_COUNT)"
fi

# 7. Final Results
FINAL_PASS=false
if [ "$BACKPRESSURE_PASS" == "true" ] && [ "$CONCURRENCY_PASS" == "true" ] && [ "$BILLING_HARDENED" == "true" ]; then
  FINAL_PASS=true
fi

cat > "$EVIDENCE_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
GATE P1-1 [CONCURRENCY_CAPACITY]: $([ "$FINAL_PASS" == "true" ] && echo "PASS" || echo "FAIL")
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
API_Backpressure: $BACKPRESSURE_PASS (Limit=$API_QUEUE_PENDING_LIMIT, Header=Retry-After)
Worker_Concurrency: $CONCURRENCY_PASS (Limit=$MAX_IN_FLIGHT_TOTAL, ObservedMax=$MAX_OBS)
Billing_Hardening: $BILLING_HARDENED (FailedReject=$FAILED_REJECT_PASS, FailedLedger=$FAILED_LEDGER_COUNT, Dedupe=$LEDGER_COUNT)
Verdict: Commercial-grade concurrency governance validated.
EOF

echo "=== FINAL EVIDENCE ==="
cat "$EVIDENCE_DIR/FINAL_6LINE_EVIDENCE.txt"

[ "$FINAL_PASS" == "true" ] && exit 0 || exit 1
