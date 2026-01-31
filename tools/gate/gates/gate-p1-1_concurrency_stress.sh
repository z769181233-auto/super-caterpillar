#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# 0. Load Environment and Validate
source tools/gate/common/load_env.sh
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set"
  exit 1
fi

mkdir -p docs/_evidence/p1_1_concurrency_audit

# Unique IDs for this run
RUN_SUFFIX=$(date +%s | tail -c 4)
W1_ID="gw-${RUN_SUFFIX}-1"
W2_ID="gw-${RUN_SUFFIX}-2"

# Constants
export JOB_MAX_IN_FLIGHT=5
export JOB_WAVE_SIZE=3
export JOB_LEASE_TTL_MS=10000
export WORKER_OFFLINE_GRACE_MS=10000 
export WORKER_POLL_INTERVAL=4000
export API_PORT=3001
export API_URL="http://localhost:$API_PORT"
export HEARTBEAT_TTL_SECONDS=3

EVIDENCE_FILE="docs/_evidence/p1_1_concurrency_audit/p1_1_concurrency_audit.json"
TXT_EVIDENCE="docs/_evidence/p1_1_concurrency_audit/FINAL_6LINE_EVIDENCE.txt"
API_LOG="api_stress.log"
WORKER_1_LOG="worker_1_stress.log"
WORKER_2_LOG="worker_2_stress.log"

# Cleanup function
cleanup() {
  echo "Cleaning up pids: ${API_PID:-} ${W1_PID:-} ${W2_PID:-}"
  [ -n "${API_PID:-}" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "${W1_PID:-}" ] && kill -9 $W1_PID 2>/dev/null || true
  [ -n "${W2_PID:-}" ] && kill -9 $W2_PID 2>/dev/null || true
  pkill -9 -f "$W1_ID" || true
  pkill -9 -f "$W2_ID" || true
  lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
  lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# 0. Startup Cleanup
lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
psql "$DATABASE_URL" -c "DELETE FROM worker_heartbeats WHERE worker_id LIKE  # $gate$
echo "=== [GATE P1-1] Concurrency & Queue Stress Start ==="

# 1. Build EVERYTHING
echo "Building API and Worker..."
pnpm -w build --filter api --filter @scu/worker > /dev/null

# 2. Launch API
echo "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export ALLOW_TEST_BILLING_GRANT=1
WORKER_OFFLINE_GRACE_MS=10000 HEARTBEAT_TTL_SECONDS=3 JOB_LEASE_TTL_MS=10000 API_PORT=3001 node apps/api/dist/main.js > "$API_LOG" 2>&1 &
API_PID=$!

# Wait for API Ready
READY=0
for i in {1..30}; do
  if grep -q "Nest application successfully started" "$API_LOG"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "FAILED: API not ready after timeout"
  cat "$API_LOG" | tail -n 20
  exit 1
fi
echo "API is READY. IDs: $W1_ID, $W2_ID"

# 3. Launch Workers
WORKER_ID="$W1_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_1_LOG" 2>&1 &
W1_PID=$!
WORKER_ID="$W2_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_2_LOG" 2>&1 &
W2_PID=$!

sleep 5

# 4. Inject Jobs
echo "[3/4] Triggering batch jobs (N=30)..."
pnpm --filter api exec ts-node src/scripts/stress-trigger.ts --count 30

# 5. Monitor Loop
MAX_RUNNING=0
DB_URL_STR=$(echo "$DATABASE_URL" | cut -d RECLAIM_BEFORE=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action =  # $gate$
echo "[4/4] Monitoring concurrency and recovery..."
for i in {1..14}; do
  RUNNING=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status =   echo "Current Running: $RUNNING" # $gate$
  if [ "$RUNNING" -gt "$MAX_RUNNING" ]; then MAX_RUNNING=$RUNNING; fi
  
  if [ "$i" -eq 3 ]; then
    echo "!!! Simulating Worker 1 Crash (SIGKILL) ID: $W1_ID !!!"
    kill -9 $W1_PID
  fi
  sleep 5
done

# 6. Post-Run Checks
RECLAIM_AFTER=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action = RECLAIM_COUNT=$((RECLAIM_AFTER - RECLAIM_BEFORE)) # $gate$
echo "Reclaims Observed: $RECLAIM_COUNT"

DUPLICATES=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM (SELECT \"jobId\", \"jobType\" FROM cost_ledger GROUP BY \"jobId\", \"jobType\" HAVING count(*) > 1) AS dupes") # $gate$

PASS="true"
FAIL_REASON=""
if [ "$MAX_RUNNING" -gt "$JOB_MAX_IN_FLIGHT" ]; then PASS="false"; FAIL_REASON="Concurrency limit exceeded ($MAX_RUNNING > $JOB_MAX_IN_FLIGHT). "; fi
if [ "$RECLAIM_COUNT" -lt 1 ]; then PASS="false"; FAIL_REASON="No reclaims observed. "; fi
if [ "$DUPLICATES" -gt 0 ]; then PASS="false"; FAIL_REASON="Duplicates found. "; fi

# JSON Evidence
cat > "$EVIDENCE_FILE" <<EOF
{
  "gate": "P1-1_CONCURRENCY_STRESS",
  "timestamp": "$(date -u +%Y%m%dT%H%M%SZ)",
  "config": {
    "JOB_MAX_IN_FLIGHT": $JOB_MAX_IN_FLIGHT,
    "JOB_LEASE_TTL": $JOB_LEASE_TTL_MS
  },
  "results": {
    "max_concurrent_observed": $MAX_RUNNING,
    "reclaims_verified_db": $RECLAIM_COUNT,
    "pass": $PASS,
    "fail_reason": "$FAIL_REASON"
  }
}
EOF

# Text Evidence
PASS_TEXT="FAIL"
if [ "$PASS" == "true" ]; then PASS_TEXT="PASS"; fi
cat > "$TXT_EVIDENCE" <<EOF
GATE P1-1 [P1-1_CONCURRENCY_STRESS]: $PASS_TEXT
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
RunId: auto_verify_$(date +%s)
Environment: MAX_IN_FLIGHT=$JOB_MAX_IN_FLIGHT, RECLAIM_TTL=$WORKER_OFFLINE_GRACE_MS
Assertion: MaxRunning <= $JOB_MAX_IN_FLIGHT (Observed: $MAX_RUNNING)
Assertion: Reclaims > 0 (Observed: $RECLAIM_COUNT)
EOF

echo "=== [GATE P1-1] Results ==="
cat "$EVIDENCE_FILE"

if [ "$PASS" == "true" ]; then
  echo "✅ GATE PASS"
  exit 0
else
  echo "❌ GATE FAIL: $FAIL_REASON"
  echo "--- DB DIAGNOSTIC ---"
  echo "Worker Heartbeats (Last 60s):"
  psql "$DB_URL_STR" -c "SELECT worker_id, last_seen_at, status FROM worker_heartbeats WHERE last_seen_at > NOW() - INTERVAL   echo "Jobs locked by $W1_ID:" # $gate$
  psql "$DB_URL_STR" -c "SELECT id, status, \"locked_by\", lease_until FROM shot_jobs WHERE \"locked_by\" =   exit 1 # $gate$
fi

# 0. Load Environment and Validate
source tools/gate/common/load_env.sh
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set"
  exit 1
fi

mkdir -p docs/_evidence/p1_1_concurrency_audit

# Unique IDs for this run
RUN_SUFFIX=$(date +%s | tail -c 4)
W1_ID="gw-${RUN_SUFFIX}-1"
W2_ID="gw-${RUN_SUFFIX}-2"

# Constants
export JOB_MAX_IN_FLIGHT=5
export JOB_WAVE_SIZE=3
export JOB_LEASE_TTL_MS=10000
export WORKER_OFFLINE_GRACE_MS=10000 
export WORKER_POLL_INTERVAL=4000
export API_PORT=3001
export API_URL="http://localhost:$API_PORT"
export HEARTBEAT_TTL_SECONDS=3

EVIDENCE_FILE="docs/_evidence/p1_1_concurrency_audit/p1_1_concurrency_audit.json"
TXT_EVIDENCE="docs/_evidence/p1_1_concurrency_audit/FINAL_6LINE_EVIDENCE.txt"
API_LOG="api_stress.log"
WORKER_1_LOG="worker_1_stress.log"
WORKER_2_LOG="worker_2_stress.log"

# Cleanup function
cleanup() {
  echo "Cleaning up pids: ${API_PID:-} ${W1_PID:-} ${W2_PID:-}"
  [ -n "${API_PID:-}" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "${W1_PID:-}" ] && kill -9 $W1_PID 2>/dev/null || true
  [ -n "${W2_PID:-}" ] && kill -9 $W2_PID 2>/dev/null || true
  pkill -9 -f "$W1_ID" || true
  pkill -9 -f "$W2_ID" || true
  lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
  lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# 0. Startup Cleanup
lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
psql "$DATABASE_URL" -c "DELETE FROM worker_heartbeats WHERE worker_id LIKE  # $gate$
echo "=== [GATE P1-1] Concurrency & Queue Stress Start ==="

# 1. Build EVERYTHING
echo "Building API and Worker..."
pnpm -w build --filter api --filter @scu/worker > /dev/null

# 2. Launch API
echo "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export ALLOW_TEST_BILLING_GRANT=1
WORKER_OFFLINE_GRACE_MS=10000 HEARTBEAT_TTL_SECONDS=3 JOB_LEASE_TTL_MS=10000 API_PORT=3001 node apps/api/dist/main.js > "$API_LOG" 2>&1 &
API_PID=$!

# Wait for API Ready
READY=0
for i in {1..30}; do
  if grep -q "Nest application successfully started" "$API_LOG"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "FAILED: API not ready after timeout"
  cat "$API_LOG" | tail -n 20
  exit 1
fi
echo "API is READY. IDs: $W1_ID, $W2_ID"

# 3. Launch Workers
WORKER_ID="$W1_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_1_LOG" 2>&1 &
W1_PID=$!
WORKER_ID="$W2_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_2_LOG" 2>&1 &
W2_PID=$!

sleep 5

# 4. Inject Jobs
echo "[3/4] Triggering batch jobs (N=30)..."
pnpm --filter api exec ts-node src/scripts/stress-trigger.ts --count 30

# 5. Monitor Loop
MAX_RUNNING=0
DB_URL_STR=$(echo "$DATABASE_URL" | cut -d RECLAIM_BEFORE=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action =  # $gate$
echo "[4/4] Monitoring concurrency and recovery..."
for i in {1..14}; do
  RUNNING=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status =   echo "Current Running: $RUNNING" # $gate$
  if [ "$RUNNING" -gt "$MAX_RUNNING" ]; then MAX_RUNNING=$RUNNING; fi
  
  if [ "$i" -eq 3 ]; then
    echo "!!! Simulating Worker 1 Crash (SIGKILL) ID: $W1_ID !!!"
    kill -9 $W1_PID
  fi
  sleep 5
done

# 6. Post-Run Checks
RECLAIM_AFTER=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action = RECLAIM_COUNT=$((RECLAIM_AFTER - RECLAIM_BEFORE)) # $gate$
echo "Reclaims Observed: $RECLAIM_COUNT"

DUPLICATES=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM (SELECT \"jobId\", \"jobType\" FROM cost_ledger GROUP BY \"jobId\", \"jobType\" HAVING count(*) > 1) AS dupes") # $gate$

PASS="true"
FAIL_REASON=""
if [ "$MAX_RUNNING" -gt "$JOB_MAX_IN_FLIGHT" ]; then PASS="false"; FAIL_REASON="Concurrency limit exceeded ($MAX_RUNNING > $JOB_MAX_IN_FLIGHT). "; fi
if [ "$RECLAIM_COUNT" -lt 1 ]; then PASS="false"; FAIL_REASON="No reclaims observed. "; fi
if [ "$DUPLICATES" -gt 0 ]; then PASS="false"; FAIL_REASON="Duplicates found. "; fi

# JSON Evidence
cat > "$EVIDENCE_FILE" <<EOF
{
  "gate": "P1-1_CONCURRENCY_STRESS",
  "timestamp": "$(date -u +%Y%m%dT%H%M%SZ)",
  "config": {
    "JOB_MAX_IN_FLIGHT": $JOB_MAX_IN_FLIGHT,
    "JOB_LEASE_TTL": $JOB_LEASE_TTL_MS
  },
  "results": {
    "max_concurrent_observed": $MAX_RUNNING,
    "reclaims_verified_db": $RECLAIM_COUNT,
    "pass": $PASS,
    "fail_reason": "$FAIL_REASON"
  }
}
EOF

# Text Evidence
PASS_TEXT="FAIL"
if [ "$PASS" == "true" ]; then PASS_TEXT="PASS"; fi
cat > "$TXT_EVIDENCE" <<EOF
GATE P1-1 [P1-1_CONCURRENCY_STRESS]: $PASS_TEXT
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
RunId: auto_verify_$(date +%s)
Environment: MAX_IN_FLIGHT=$JOB_MAX_IN_FLIGHT, RECLAIM_TTL=$WORKER_OFFLINE_GRACE_MS
Assertion: MaxRunning <= $JOB_MAX_IN_FLIGHT (Observed: $MAX_RUNNING)
Assertion: Reclaims > 0 (Observed: $RECLAIM_COUNT)
EOF

echo "=== [GATE P1-1] Results ==="
cat "$EVIDENCE_FILE"

if [ "$PASS" == "true" ]; then
  echo "✅ GATE PASS"
  exit 0
else
  echo "❌ GATE FAIL: $FAIL_REASON"
  echo "--- DB DIAGNOSTIC ---"
  echo "Worker Heartbeats (Last 60s):"
  psql "$DB_URL_STR" -c "SELECT worker_id, last_seen_at, status FROM worker_heartbeats WHERE last_seen_at > NOW() - INTERVAL   echo "Jobs locked by $W1_ID:" # $gate$
  psql "$DB_URL_STR" -c "SELECT id, status, \"locked_by\", lease_until FROM shot_jobs WHERE \"locked_by\" =   exit 1 # $gate$
fi

# 0. Load Environment and Validate
source tools/gate/common/load_env.sh
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set"
  exit 1
fi

mkdir -p docs/_evidence/p1_1_concurrency_audit

# Unique IDs for this run
RUN_SUFFIX=$(date +%s | tail -c 4)
W1_ID="gw-${RUN_SUFFIX}-1"
W2_ID="gw-${RUN_SUFFIX}-2"

# Constants
export JOB_MAX_IN_FLIGHT=5
export JOB_WAVE_SIZE=3
export JOB_LEASE_TTL_MS=10000
export WORKER_OFFLINE_GRACE_MS=10000 
export WORKER_POLL_INTERVAL=4000
export API_PORT=3001
export API_URL="http://localhost:$API_PORT"
export HEARTBEAT_TTL_SECONDS=3

EVIDENCE_FILE="docs/_evidence/p1_1_concurrency_audit/p1_1_concurrency_audit.json"
TXT_EVIDENCE="docs/_evidence/p1_1_concurrency_audit/FINAL_6LINE_EVIDENCE.txt"
API_LOG="api_stress.log"
WORKER_1_LOG="worker_1_stress.log"
WORKER_2_LOG="worker_2_stress.log"

# Cleanup function
cleanup() {
  echo "Cleaning up pids: ${API_PID:-} ${W1_PID:-} ${W2_PID:-}"
  [ -n "${API_PID:-}" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "${W1_PID:-}" ] && kill -9 $W1_PID 2>/dev/null || true
  [ -n "${W2_PID:-}" ] && kill -9 $W2_PID 2>/dev/null || true
  pkill -9 -f "$W1_ID" || true
  pkill -9 -f "$W2_ID" || true
  lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
  lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# 0. Startup Cleanup
lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
psql "$DATABASE_URL" -c "DELETE FROM worker_heartbeats WHERE worker_id LIKE  # $gate$
echo "=== [GATE P1-1] Concurrency & Queue Stress Start ==="

# 1. Build EVERYTHING
echo "Building API and Worker..."
pnpm -w build --filter api --filter @scu/worker > /dev/null

# 2. Launch API
echo "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export ALLOW_TEST_BILLING_GRANT=1
WORKER_OFFLINE_GRACE_MS=10000 HEARTBEAT_TTL_SECONDS=3 JOB_LEASE_TTL_MS=10000 API_PORT=3001 node apps/api/dist/main.js > "$API_LOG" 2>&1 &
API_PID=$!

# Wait for API Ready
READY=0
for i in {1..30}; do
  if grep -q "Nest application successfully started" "$API_LOG"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "FAILED: API not ready after timeout"
  cat "$API_LOG" | tail -n 20
  exit 1
fi
echo "API is READY. IDs: $W1_ID, $W2_ID"

# 3. Launch Workers
WORKER_ID="$W1_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_1_LOG" 2>&1 &
W1_PID=$!
WORKER_ID="$W2_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_2_LOG" 2>&1 &
W2_PID=$!

sleep 5

# 4. Inject Jobs
echo "[3/4] Triggering batch jobs (N=30)..."
pnpm --filter api exec ts-node src/scripts/stress-trigger.ts --count 30

# 5. Monitor Loop
MAX_RUNNING=0
DB_URL_STR=$(echo "$DATABASE_URL" | cut -d RECLAIM_BEFORE=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action =  # $gate$
echo "[4/4] Monitoring concurrency and recovery..."
for i in {1..14}; do
  RUNNING=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status =   echo "Current Running: $RUNNING" # $gate$
  if [ "$RUNNING" -gt "$MAX_RUNNING" ]; then MAX_RUNNING=$RUNNING; fi
  
  if [ "$i" -eq 3 ]; then
    echo "!!! Simulating Worker 1 Crash (SIGKILL) ID: $W1_ID !!!"
    kill -9 $W1_PID
  fi
  sleep 5
done

# 6. Post-Run Checks
RECLAIM_AFTER=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action = RECLAIM_COUNT=$((RECLAIM_AFTER - RECLAIM_BEFORE)) # $gate$
echo "Reclaims Observed: $RECLAIM_COUNT"

DUPLICATES=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM (SELECT \"jobId\", \"jobType\" FROM cost_ledger GROUP BY \"jobId\", \"jobType\" HAVING count(*) > 1) AS dupes") # $gate$

PASS="true"
FAIL_REASON=""
if [ "$MAX_RUNNING" -gt "$JOB_MAX_IN_FLIGHT" ]; then PASS="false"; FAIL_REASON="Concurrency limit exceeded ($MAX_RUNNING > $JOB_MAX_IN_FLIGHT). "; fi
if [ "$RECLAIM_COUNT" -lt 1 ]; then PASS="false"; FAIL_REASON="No reclaims observed. "; fi
if [ "$DUPLICATES" -gt 0 ]; then PASS="false"; FAIL_REASON="Duplicates found. "; fi

# JSON Evidence
cat > "$EVIDENCE_FILE" <<EOF
{
  "gate": "P1-1_CONCURRENCY_STRESS",
  "timestamp": "$(date -u +%Y%m%dT%H%M%SZ)",
  "config": {
    "JOB_MAX_IN_FLIGHT": $JOB_MAX_IN_FLIGHT,
    "JOB_LEASE_TTL": $JOB_LEASE_TTL_MS
  },
  "results": {
    "max_concurrent_observed": $MAX_RUNNING,
    "reclaims_verified_db": $RECLAIM_COUNT,
    "pass": $PASS,
    "fail_reason": "$FAIL_REASON"
  }
}
EOF

# Text Evidence
PASS_TEXT="FAIL"
if [ "$PASS" == "true" ]; then PASS_TEXT="PASS"; fi
cat > "$TXT_EVIDENCE" <<EOF
GATE P1-1 [P1-1_CONCURRENCY_STRESS]: $PASS_TEXT
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
RunId: auto_verify_$(date +%s)
Environment: MAX_IN_FLIGHT=$JOB_MAX_IN_FLIGHT, RECLAIM_TTL=$WORKER_OFFLINE_GRACE_MS
Assertion: MaxRunning <= $JOB_MAX_IN_FLIGHT (Observed: $MAX_RUNNING)
Assertion: Reclaims > 0 (Observed: $RECLAIM_COUNT)
EOF

echo "=== [GATE P1-1] Results ==="
cat "$EVIDENCE_FILE"

if [ "$PASS" == "true" ]; then
  echo "✅ GATE PASS"
  exit 0
else
  echo "❌ GATE FAIL: $FAIL_REASON"
  echo "--- DB DIAGNOSTIC ---"
  echo "Worker Heartbeats (Last 60s):"
  psql "$DB_URL_STR" -c "SELECT worker_id, last_seen_at, status FROM worker_heartbeats WHERE last_seen_at > NOW() - INTERVAL   echo "Jobs locked by $W1_ID:" # $gate$
  psql "$DB_URL_STR" -c "SELECT id, status, \"locked_by\", lease_until FROM shot_jobs WHERE \"locked_by\" =   exit 1 # $gate$
fi

# 0. Load Environment and Validate
source tools/gate/common/load_env.sh
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set"
  exit 1
fi

mkdir -p docs/_evidence/p1_1_concurrency_audit

# Unique IDs for this run
RUN_SUFFIX=$(date +%s | tail -c 4)
W1_ID="gw-${RUN_SUFFIX}-1"
W2_ID="gw-${RUN_SUFFIX}-2"

# Constants
export JOB_MAX_IN_FLIGHT=5
export JOB_WAVE_SIZE=3
export JOB_LEASE_TTL_MS=10000
export WORKER_OFFLINE_GRACE_MS=10000 
export WORKER_POLL_INTERVAL=4000
export API_PORT=3001
export API_URL="http://localhost:$API_PORT"
export HEARTBEAT_TTL_SECONDS=3

EVIDENCE_FILE="docs/_evidence/p1_1_concurrency_audit/p1_1_concurrency_audit.json"
TXT_EVIDENCE="docs/_evidence/p1_1_concurrency_audit/FINAL_6LINE_EVIDENCE.txt"
API_LOG="api_stress.log"
WORKER_1_LOG="worker_1_stress.log"
WORKER_2_LOG="worker_2_stress.log"

# Cleanup function
cleanup() {
  echo "Cleaning up pids: ${API_PID:-} ${W1_PID:-} ${W2_PID:-}"
  [ -n "${API_PID:-}" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "${W1_PID:-}" ] && kill -9 $W1_PID 2>/dev/null || true
  [ -n "${W2_PID:-}" ] && kill -9 $W2_PID 2>/dev/null || true
  pkill -9 -f "$W1_ID" || true
  pkill -9 -f "$W2_ID" || true
  lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
  lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# 0. Startup Cleanup
lsof -i :3000 -t | xargs kill -9 2>/dev/null || true
lsof -i :3001 -t | xargs kill -9 2>/dev/null || true
psql "$DATABASE_URL" -c "DELETE FROM worker_heartbeats WHERE worker_id LIKE  # $gate$
echo "=== [GATE P1-1] Concurrency & Queue Stress Start ==="

# 1. Build EVERYTHING
echo "Building API and Worker..."
pnpm -w build --filter api --filter @scu/worker > /dev/null

# 2. Launch API
echo "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export ALLOW_TEST_BILLING_GRANT=1
WORKER_OFFLINE_GRACE_MS=10000 HEARTBEAT_TTL_SECONDS=3 JOB_LEASE_TTL_MS=10000 API_PORT=3001 node apps/api/dist/main.js > "$API_LOG" 2>&1 &
API_PID=$!

# Wait for API Ready
READY=0
for i in {1..30}; do
  if grep -q "Nest application successfully started" "$API_LOG"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "FAILED: API not ready after timeout"
  cat "$API_LOG" | tail -n 20
  exit 1
fi
echo "API is READY. IDs: $W1_ID, $W2_ID"

# 3. Launch Workers
WORKER_ID="$W1_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_1_LOG" 2>&1 &
W1_PID=$!
WORKER_ID="$W2_ID" WORKER_OFFLINE_GRACE_MS=10000 node apps/workers/dist/apps/workers/src/main.js > "$WORKER_2_LOG" 2>&1 &
W2_PID=$!

sleep 5

# 4. Inject Jobs
echo "[3/4] Triggering batch jobs (N=30)..."
pnpm --filter api exec ts-node src/scripts/stress-trigger.ts --count 30

# 5. Monitor Loop
MAX_RUNNING=0
DB_URL_STR=$(echo "$DATABASE_URL" | cut -d RECLAIM_BEFORE=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action =  # $gate$
echo "[4/4] Monitoring concurrency and recovery..."
for i in {1..14}; do
  RUNNING=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status =   echo "Current Running: $RUNNING" # $gate$
  if [ "$RUNNING" -gt "$MAX_RUNNING" ]; then MAX_RUNNING=$RUNNING; fi
  
  if [ "$i" -eq 3 ]; then
    echo "!!! Simulating Worker 1 Crash (SIGKILL) ID: $W1_ID !!!"
    kill -9 $W1_PID
  fi
  sleep 5
done

# 6. Post-Run Checks
RECLAIM_AFTER=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM audit_logs WHERE action = RECLAIM_COUNT=$((RECLAIM_AFTER - RECLAIM_BEFORE)) # $gate$
echo "Reclaims Observed: $RECLAIM_COUNT"

DUPLICATES=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM (SELECT \"jobId\", \"jobType\" FROM cost_ledger GROUP BY \"jobId\", \"jobType\" HAVING count(*) > 1) AS dupes") # $gate$

PASS="true"
FAIL_REASON=""
if [ "$MAX_RUNNING" -gt "$JOB_MAX_IN_FLIGHT" ]; then PASS="false"; FAIL_REASON="Concurrency limit exceeded ($MAX_RUNNING > $JOB_MAX_IN_FLIGHT). "; fi
if [ "$RECLAIM_COUNT" -lt 1 ]; then PASS="false"; FAIL_REASON="No reclaims observed. "; fi
if [ "$DUPLICATES" -gt 0 ]; then PASS="false"; FAIL_REASON="Duplicates found. "; fi

# JSON Evidence
cat > "$EVIDENCE_FILE" <<EOF
{
  "gate": "P1-1_CONCURRENCY_STRESS",
  "timestamp": "$(date -u +%Y%m%dT%H%M%SZ)",
  "config": {
    "JOB_MAX_IN_FLIGHT": $JOB_MAX_IN_FLIGHT,
    "JOB_LEASE_TTL": $JOB_LEASE_TTL_MS
  },
  "results": {
    "max_concurrent_observed": $MAX_RUNNING,
    "reclaims_verified_db": $RECLAIM_COUNT,
    "pass": $PASS,
    "fail_reason": "$FAIL_REASON"
  }
}
EOF

# Text Evidence
PASS_TEXT="FAIL"
if [ "$PASS" == "true" ]; then PASS_TEXT="PASS"; fi
cat > "$TXT_EVIDENCE" <<EOF
GATE P1-1 [P1-1_CONCURRENCY_STRESS]: $PASS_TEXT
Timestamp: $(date -u +%Y%m%dT%H%M%SZ)
RunId: auto_verify_$(date +%s)
Environment: MAX_IN_FLIGHT=$JOB_MAX_IN_FLIGHT, RECLAIM_TTL=$WORKER_OFFLINE_GRACE_MS
Assertion: MaxRunning <= $JOB_MAX_IN_FLIGHT (Observed: $MAX_RUNNING)
Assertion: Reclaims > 0 (Observed: $RECLAIM_COUNT)
EOF

echo "=== [GATE P1-1] Results ==="
cat "$EVIDENCE_FILE"

if [ "$PASS" == "true" ]; then
  echo "✅ GATE PASS"
  exit 0
else
  echo "❌ GATE FAIL: $FAIL_REASON"
  echo "--- DB DIAGNOSTIC ---"
  echo "Worker Heartbeats (Last 60s):"
  psql "$DB_URL_STR" -c "SELECT worker_id, last_seen_at, status FROM worker_heartbeats WHERE last_seen_at > NOW() - INTERVAL   echo "Jobs locked by $W1_ID:" # $gate$
  psql "$DB_URL_STR" -c "SELECT id, status, \"locked_by\", lease_until FROM shot_jobs WHERE \"locked_by\" =   exit 1 # $gate$
fi
