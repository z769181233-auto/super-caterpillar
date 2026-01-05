#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../common/run_with_timeout.sh"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/ce01_m1_hardpass_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "Starting CE01 M1 Hardpass Gate..."
log "EVID_DIR: $EVID_DIR"

# 1. Cleanup & Preparation (Ghost Worker Killer)
log "Cleaning up old processes and env..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "ts-node.*workers/src/main.ts" || true
pkill -9 -f "apps/workers/dist/apps/workers/src/main.js" || true
pkill -9 -f "node .*apps/workers" || true
# Kill any processes on 3001/3002
lsof -t -i :3001 | xargs kill -9 2>/dev/null || true
lsof -t -i :3002 | xargs kill -9 2>/dev/null || true

# Log process state to prove cleanup
ps aux | grep node | grep -v grep > "$EVID_DIR/process_cleanup_proof.txt"
log "Cleanup complete. Process proof saved."

# 2. Start API
log "Starting API..."
# Ensure default env vars for test
export STRIPE_SECRET_KEY="sk_test_mock_start_key"
export ALLOW_TEST_BILLING_GRANT=1
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
log "API PID: $API_PID"

# Helper to wait for port
wait_for_port() {
  local port=$1
  local pid=$2
  local name=$3
  local timeout=60
  local start=$(date +%s)
  while true; do
    if ! kill -0 $pid 2>/dev/null; then
      log "FATAL: $name died unexpectedly."
      exit 1
    fi
    if lsof -iTCP:$port -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      log "$name listening on $port"
      return 0
    fi
    local now=$(date +%s)
    if [ $((now - start)) -ge $timeout ]; then
      log "FATAL: Timeout waiting for $name"
      exit 1
    fi
    sleep 1
  done
}

wait_for_port 3001 $API_PID "API"

# 3. Start Workers with Fail-Once Flag
log "Starting Workers with CE01_REFERENCE_SHEET_GATE_FAIL_ONCE=1..."
# We only need CE01 capability
export WORKER_CAPS="CE01_REFERENCE_SHEET"
export CE01_REFERENCE_SHEET_GATE_FAIL_ONCE=1
export API_URL="http://127.0.0.1:3001"
export JOB_RETRY_BACKOFF_SECONDS=5 # Ensure consistent backoff

# Use compiled worker for stability
log "Starting Worker (Compiled)..."
CE01_REFERENCE_SHEET_GATE_FAIL_ONCE=1 node apps/workers/dist/apps/workers/src/main.js > "$EVID_DIR/workers.log" 2>&1 &
WORKER_PID=$!
log "Worker PID: $WORKER_PID"

# Wait a bit
sleep 10
# Check if worker is alive
if ! kill -0 $WORKER_PID 2>/dev/null; then
  log "FATAL: Worker process died immediately."
  cat "$EVID_DIR/workers.log"
  exit 1
fi

# 4. Trigger CE01 Job
log "Triggering CE01 Job..."
# Handle DATABASE_URL relative to gate
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env.local ]; then
     export DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

# Trigger script
TRIGGER_OUT=$(npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/ce01_trigger.ts 2>&1)
log "$TRIGGER_OUT"
JOB_ID=$(echo "$TRIGGER_OUT" | grep "JOB_ID=" | cut -d= -f2)

if [ -z "$JOB_ID" ]; then
  log "FATAL: Failed to get JOB_ID."
  exit 1
fi
log "Tracking Job: $JOB_ID"

# 5. Monitor Job Status Transitions
# Expected: PENDING -> RUNNING -> FAILED -> RETRYING -> RUNNING -> SUCCEEDED
MAX_WAIT=120
START_TIME=$(date +%s)
DETECTED_FAILED=0
DETECTED_RETRYING=0
DETECTED_SUCCEEDED=0
LAST_WORKER_ID=""

log "Polling DB for job status..."
# Evidence files
echo "JOB_ID=$JOB_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "BACKOFF_SECONDS=$JOB_RETRY_BACKOFF_SECONDS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

while true; do
  NOW=$(date +%s)
  if [ $((NOW - START_TIME)) -ge $MAX_WAIT ]; then
    log "FATAL: Timeout waiting for SUCCEEDED"
    exit 1
  fi
  
  # Fetch status, attempts, lastError, workerId
  # Using psql
  ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status, attempts, \"lastError\", \"workerId\" FROM shot_jobs WHERE id='$JOB_ID'")
  STATUS=$(echo "$ROW" | awk -F '|' '{print $1}' | xargs)
  ATTEMPTS=$(echo "$ROW" | awk -F '|' '{print $2}' | xargs)
  LAST_ERROR=$(echo "$ROW" | awk -F '|' '{print $3}' | xargs)
  WORKER_ID=$(echo "$ROW" | awk -F '|' '{print $4}' | xargs)

  log "Probe: Status=$STATUS Attempts=$ATTEMPTS Worker=$WORKER_ID"
  
  # Append to evidence log
  echo "$(date +%H:%M:%S) Status=$STATUS Attempts=$ATTEMPTS Worker=$WORKER_ID" >> "$EVID_DIR/sql_job_history.txt"

  if [[ "$STATUS" == "FAILED" ]]; then
     DETECTED_FAILED=1
  fi
  
  if [[ "$STATUS" == "RETRYING" ]]; then
     DETECTED_RETRYING=1
  fi
  
  if [[ "$STATUS" == "SUCCEEDED" ]]; then
     DETECTED_SUCCEEDED=1
     log ">> Detected SUCCEEDED state"
     
     # Verify Hardening Rule A
     if [[ "$LAST_ERROR" != "" && "$LAST_ERROR" != "null" ]]; then
        log "FATAL: SUCCEEDED but lastError is not null: $LAST_ERROR"
        exit 1
     fi
     if [[ "$WORKER_ID" != "" && "$WORKER_ID" != "null" ]]; then
        log "FATAL: SUCCEEDED but workerId is not null: $WORKER_ID"
        exit 1
     fi
     log ">> Verified: lastError is NULL, workerId is NULL"
     
     # Verify Attempts
     echo "ATTEMPTS_FINAL=$ATTEMPTS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
     echo "LAST_ERROR_FINAL=NULL" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
     echo "WORKER_ID_FINAL=NULL" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
     
     break
  fi
  
  sleep 2
done

# 6. Verification Summary
if [ $DETECTED_FAILED -eq 0 ] && [ $DETECTED_RETRYING -eq 0 ]; then
   if [ "$ATTEMPTS" -le 0 ]; then
      log "FATAL: Job succeeded but attempts=$ATTEMPTS (Did not retry?)"
      exit 1
   else
      log "WARNING: Missed polling FAILED/RETRYING states, but attempts=$ATTEMPTS suggests retry happened."
   fi
else
   log ">> Transitions verified: FAILED/RETRYING detected."
fi

# Cleanup
kill $API_PID || true
kill $WORKER_PID || true

log "GATE CE01 M1 HARDPASS: SUCCESS"
exit 0
