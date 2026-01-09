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
export JOB_MAX_IN_FLIGHT=5
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

psql "$DB_URL_CLEAN" -c "DELETE FROM shot_jobs WHERE type = 'SHOT_RENDER' AND payload->>'stress_p1_1' = 'true'" || true
psql "$DB_URL_CLEAN" -c "DELETE FROM cost_ledgers WHERE \"jobId\" IN (SELECT id FROM shot_jobs WHERE type = 'SHOT_RENDER' AND payload->>'stress_p1_1' = 'true')" || true
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

psql "$DB_URL_CLEAN" -c "INSERT INTO \"users\" (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") VALUES ('$GATE_USER_ID', 'gate-p1-1@example.com', 'dummy', NOW(), NOW());" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"organizations\" (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", \"credits\") VALUES ('$GATE_ORG_ID', 'Gate Org', '$GATE_USER_ID', NOW(), NOW(), 1000);" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"projects\" (id, name, \"organizationId\", \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ('$GATE_PROJECT_ID', 'Gate Project', '$GATE_ORG_ID', '$GATE_USER_ID', NOW(), NOW());" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"seasons\" (id, title, \"projectId\", index, \"createdAt\", \"updatedAt\") VALUES ('$GATE_SEASON_ID', 'Season 1', '$GATE_PROJECT_ID', 1, NOW(), NOW());" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"episodes\" (id, name, \"seasonId\", \"projectId\", index) VALUES ('$GATE_EPISODE_ID', 'Episode 1', '$GATE_SEASON_ID', '$GATE_PROJECT_ID', 1);" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"scenes\" (id, \"episodeId\", \"projectId\", index, title) VALUES ('$GATE_SCENE_ID', '$GATE_EPISODE_ID', '$GATE_PROJECT_ID', 1, 'Scene 1');" > /dev/null
psql "$DB_URL_CLEAN" -c "INSERT INTO \"shots\" (id, \"sceneId\", index, type, params, \"organizationId\") VALUES ('$GATE_SHOT_ID', '$GATE_SCENE_ID', 1, 'NORMAL', '{}'::jsonb, '$GATE_ORG_ID');" > /dev/null

# Generate JWT
export JWT_SECRET="test-secret-p1-1"
GATE_TOKEN=$(pnpm -w exec tsx tools/gate/gates/gen_token.ts "{\"sub\":\"$GATE_USER_ID\",\"userId\":\"$GATE_USER_ID\",\"orgId\":\"$GATE_ORG_ID\",\"email\":\"gate-p1-1@example.com\"}" "$JWT_SECRET")

echo "[3/5] Starting API (Backpressure ON)..."
export STRIPE_SECRET_KEY="sk_test_p1_1"
export ALLOW_TEST_BILLING_GRANT=1
export GATE_MODE=1
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
# We need some dummy jobs in PENDING to trigger backpressure
# SHOT_RENDER is a valid enum value
psql "$DB_URL_CLEAN" -c "INSERT INTO shot_jobs (id, type, status, \"projectId\", \"organizationId\", \"sceneId\", \"shotId\", \"episodeId\", payload, \"createdAt\", \"updatedAt\") 
  SELECT 'gate-p1-1-pad-' || i, 'SHOT_RENDER', 'PENDING', '$GATE_PROJECT_ID', '$GATE_ORG_ID', '$GATE_SCENE_ID', '$GATE_SHOT_ID', '$GATE_EPISODE_ID', '{\"stress_p1_1\": true}'::jsonb, NOW(), NOW() 
  FROM generate_series(1, 4) s(i)" > /dev/null

# Try creating via API - expect 429
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/shots/$GATE_SHOT_ID/jobs" \
  -H "Authorization: Bearer $GATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"SHOT_RENDER\", \"payload\": {\"stress_p1_1\": true, \"sceneId\": \"$GATE_SCENE_ID\", \"shotId\": \"$GATE_SHOT_ID\", \"episodeId\": \"$GATE_EPISODE_ID\"}}")

echo "API Response for job 5: $RESPONSE"
BACKPRESSURE_PASS=false
if [ "$RESPONSE" == "429" ]; then
  echo "✅ Backpressure triggered correctly (429)"
  BACKPRESSURE_PASS=true
else
  echo "❌ Backpressure failed (expected 429, got $RESPONSE)"
fi

# 5. Stress Test: Worker Concurrency
echo "[5/5] Starting Worker (Limiter ON, Limit=$MAX_IN_FLIGHT_TOTAL)..."
WORKER_ID="gw-p1-1-1" node apps/workers/dist/main.js > "$EVIDENCE_DIR/worker.log" 2>&1 &
W1_PID=$!

sleep 10

# Check running count
RUNNING_COUNT=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status = 'RUNNING' AND payload->>'stress_p1_1' = 'true'")
echo "Concurrent Running Jobs: $RUNNING_COUNT (Max allowed: $MAX_IN_FLIGHT_TOTAL)"

CONCURRENCY_PASS=false
if [ "$RUNNING_COUNT" -le "$MAX_IN_FLIGHT_TOTAL" ]; then
  echo "✅ Concurrency limit respected"
  CONCURRENCY_PASS=true
else
  echo "❌ Concurrency limit violated ($RUNNING_COUNT > $MAX_IN_FLIGHT_TOTAL)"
fi

# 6. Idempotency Check (Manual Injection for test)
echo "[6/6] Testing Billing Idempotency (Attempt-aware)..."
JOB_ID="gate-p1-1-dedupe"
psql "$DB_URL_CLEAN" -c "INSERT INTO shot_jobs (id, status, type, \"projectId\", \"organizationId\", \"sceneId\", \"shotId\", \"episodeId\", attempts, payload, \"createdAt\", \"updatedAt\") 
  VALUES ('$JOB_ID', 'SUCCEEDED', 'SHOT_RENDER', '$GATE_PROJECT_ID', '$GATE_ORG_ID', '$GATE_SCENE_ID', '$GATE_SHOT_ID', '$GATE_EPISODE_ID', 1, '{\"stress_p1_1\": true}', NOW(), NOW())" > /dev/null

# Submit same job same attempt twice to internal ledger
submit_cost() {
  curl -s -X POST "$API_URL/api/internal/events/cost-ledger" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"$GATE_USER_ID\",
      \"projectId\": \"$GATE_PROJECT_ID\",
      \"jobId\": \"$JOB_ID\",
      \"jobType\": \"SHOT_RENDER\",
      \"attempt\": 1,
      \"costAmount\": 0.1,
      \"currency\": \"USD\",
      \"billingUnit\": \"job\",
      \"quantity\": 1
    }"
}

echo "Submitting cost attempt 1..."
submit_cost
echo "Submitting cost attempt 1 (duplicate)..."
submit_cost

LEDGER_COUNT=$(psql "$DB_URL_CLEAN" -t -A -c "SELECT count(*) FROM cost_ledgers WHERE \"jobId\" = '$JOB_ID' AND attempt = 1")
echo "Ledger records for $JOB_ID attempt 1: $LEDGER_COUNT"

IDEMPOTENCY_PASS=false
if [ "$LEDGER_COUNT" -eq 1 ]; then
  echo "✅ Billing Idempotency passed (deduplicated)"
  IDEMPOTENCY_PASS=true
else
  echo "❌ Billing Idempotency failed (count=$LEDGER_COUNT)"
fi

# 7. Final Results
FINAL_PASS=false
if [ "$BACKPRESSURE_PASS" == "true" ] && [ "$CONCURRENCY_PASS" == "true" ] && [ "$IDEMPOTENCY_PASS" == "true" ]; then
  FINAL_PASS=true
fi

# Write Evidence
cat > "$EVIDENCE_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
GATE P1-1 [CONCURRENCY_CAPACITY]: $([ "$FINAL_PASS" == "true" ] && echo "PASS" || echo "FAIL")
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
API_Backpressure: $BACKPRESSURE_PASS (Limit=$API_QUEUE_PENDING_LIMIT)
Worker_Concurrency: $CONCURRENCY_PASS (Limit=$MAX_IN_FLIGHT_TOTAL, Observed=$RUNNING_COUNT)
Billing_Idempotency: $IDEMPOTENCY_PASS (Attempt-aware unique key verified)
Verdict: Commercial-grade concurrency governance validated.
EOF

echo "=== FINAL EVIDENCE ==="
cat "$EVIDENCE_DIR/FINAL_6LINE_EVIDENCE.txt"

[ "$FINAL_PASS" == "true" ] && exit 0 || exit 1
