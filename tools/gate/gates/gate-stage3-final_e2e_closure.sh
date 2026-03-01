#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"# ===== Stage-3-Final: E2E Closure Gate =====
# 验证：全链路贯通 (CE06 -> CE03 -> CE04 -> ShotRender) + 双跑幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_ASSET="assets"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_final_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-Final: E2E Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3013
# Ensure ASSET_STORAGE_DIR is absolute for Worker
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_gate_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3013 | xargs kill -9 2>/dev/null || true

# 1.3 Sync DB Schema
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss)

# 1.5 自举
log "== Bootstrap base data via gate_seed.ts =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts 2>&1 | tee -a "$EVID_DIR/seed.log" || {
  log "❌ FAIL: gate_seed.ts failed"
  exit 1
}

log "✅ Seed done."

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3013 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3013" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Run Logic
# ---------------------------------------------------------

run_chain() {
  local RUN_NAME=$1
  log "-- Starting Chain Run: $RUN_NAME --"

  # Recalculate IDs for this run (or reuse if we want strict reuse, but for E2E chain we usually start fresh job IDs on same objects)
  # BUT for Gateway Idempotency test, we should run EXACTLY the same logical jobs or retry them?
  # User Requirement: "Double Run: Ledger 1, Asset Reused". This implies retrying the SAME JOB ID or processing the same Business Object idempotency.
  # Given our system design (JobId is unique), idempotency usually means "Same Input -> Same Output" even if JobId differs (Business Idempotency) OR "Same JobId -> Processed Once".
  # Let  # Actually, "Ledger count = 1" per JobType usually means per Business Action.
  # Let  # Wait, if New Job ID, Ledger will log a new entry unless we deduplicate by hash. 
  # If User says "Ledger count == 1", they likely mean "Same Job ID re-execution" OR "Business logic deduplication".
  # "Gate-3b" checked "Job Idempotency" (Same Job ID = 1 Ledger).
  # So let  # BUT we have a chain.
  # Simplified approach: 
  # Run 1: Create Jobs A, B, C, D. Wait for success.
  # Run 2: Reset status to PENDING for Jobs A, B, C, D. Worker picks up. Should verify "Already Done" or "Idempotent Re-execution".
  # Our workers currently don  # Actually, $(processShotRenderJob) uses $(upsert) for Asset. Ledger? $(record*Billing) usually logs every time unless we have dedup logic.
  # Check $(CostLedgerService): It usually does $(create).
  # If we want Ledger=1 for same JobId, the table constraint $(jobId_jobType) unique key handles it (it would throw or skip).
  # Let
  if [ "$RUN_NAME" == "Run1" ]; then
     # Create IDs
     PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
     ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug=     SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
     SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$
     
     EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
     
     JOB_ID_CE06="ce06-job-${TS}"
     JOB_ID_CE03="ce03-job-${TS}"
     JOB_ID_CE04="ce04-job-${TS}"
     JOB_ID_SHOT="shot-job-${TS}"
     export JOB_ID_CE06 JOB_ID_CE03 JOB_ID_CE04 JOB_ID_SHOT PROJECT_ID ORG_ID SCENE_ID SHOT_ID EPISODE_ID

     # Insert Jobs (PENDING)
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
      INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
      (      (      (      (     " > /dev/null
     log "Jobs Created: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT"
  else
     # Run 2: Reset Jobs to PENDING (and clear workerId so they are picked up immediately)
     log "Resetting Jobs to PENDING for Re-run..."
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "UPDATE shot_jobs SET status=  fi

  # Wait for All Succeeded
  wait_for_job "$JOB_ID_CE06"
  wait_for_job "$JOB_ID_CE03"
  wait_for_job "$JOB_ID_CE04"
  wait_for_job "$JOB_ID_SHOT"
}

wait_for_job() {
  local JID=$1
  local MAX_RETRY=30
  while [ $MAX_RETRY -gt 0 ]; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then 
      log "❌ FAIL: Job $JID FAILED"
      tail -n 30 "$EVID_DIR/worker.log"
      exit 1
    fi
    sleep 2
    ((MAX_RETRY--))
  done
  log "❌ FAIL: Job $JID Timeout"
  exit 1
}

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

# Run 1
run_chain "Run1"

# Run 2 (Idempotency)
run_chain "Run2"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. Check Ledger Counts (Should be 1 because of DB Unique constraint on jobId+jobType, Worker will fail or ignore but Gate shouldn# Actually if Worker tries to insert duplicate Ledger with same JobID, it fails hard (Job Failed) OR stays 1 (if ignore).
# If Job Failed, wait_for_job would have crashed. So if we are here, jobs SUCCEEDED.
# This means Worker handled "Ledger already exists" gracefully OR didn# Let
check_ledger() {
  local JID=$1
  local TYPE=$2
  COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM $gate$1$gate$ WHERE \"jobId\"=  if [ "$COUNT" != "1" ]; then log "❌ FAIL: Ledger Count for $TYPE is $COUNT (Expected 1)"; exit 1; fi
  log "✅ Ledger $TYPE: 1"
}

check_ledger "$JOB_ID_CE06" "CE06"
check_ledger "$JOB_ID_CE03" "CE03"
check_ledger "$JOB_ID_CE04" "CE04"
check_ledger "$JOB_ID_SHOT" "SHOT"

# 2. Check ShotRender Asset
ASSET_URI=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"storageKey\" FROM ${TABLE_ASSET} WHERE \"ownerId\"=
if [ ! -f "$ASSET_URI" ]; then log "❌ FAIL: Asset file missing"; exit 1; fi
SIZE=$(wc -c < "$ASSET_URI")
if [ "$SIZE" -le 0 ]; then log "❌ FAIL: Asset empty"; exit 1; fi
log "✅ Asset Exists: $ASSET_URI ($SIZE bytes)"

# 3. Check Trace ID Persistence (Sample one)
TRACE_VAL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$TRACE_VAL" != "trace-shot" ]; then log "❌ FAIL: Trace Mismatch ($TRACE_VAL)"; exit 1; fi
log "✅ Trace ID Valid"

# Final Report
echo "STAGE3_FINAL_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_IDS: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET: $ASSET_URI" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-Final E2E Gate PASSED"
exit 0

# ===== Stage-3-Final: E2E Closure Gate =====
# 验证：全链路贯通 (CE06 -> CE03 -> CE04 -> ShotRender) + 双跑幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_ASSET="assets"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_final_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-Final: E2E Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3013
# Ensure ASSET_STORAGE_DIR is absolute for Worker
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_gate_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3013 | xargs kill -9 2>/dev/null || true

# 1.3 Sync DB Schema
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss)

# 1.5 自举
log "== Bootstrap base data via gate_seed.ts =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts 2>&1 | tee -a "$EVID_DIR/seed.log" || {
  log "❌ FAIL: gate_seed.ts failed"
  exit 1
}

log "✅ Seed done."

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3013 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3013" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Run Logic
# ---------------------------------------------------------

run_chain() {
  local RUN_NAME=$1
  log "-- Starting Chain Run: $RUN_NAME --"

  # Recalculate IDs for this run (or reuse if we want strict reuse, but for E2E chain we usually start fresh job IDs on same objects)
  # BUT for Gateway Idempotency test, we should run EXACTLY the same logical jobs or retry them?
  # User Requirement: "Double Run: Ledger 1, Asset Reused". This implies retrying the SAME JOB ID or processing the same Business Object idempotency.
  # Given our system design (JobId is unique), idempotency usually means "Same Input -> Same Output" even if JobId differs (Business Idempotency) OR "Same JobId -> Processed Once".
  # Let  # Actually, "Ledger count = 1" per JobType usually means per Business Action.
  # Let  # Wait, if New Job ID, Ledger will log a new entry unless we deduplicate by hash. 
  # If User says "Ledger count == 1", they likely mean "Same Job ID re-execution" OR "Business logic deduplication".
  # "Gate-3b" checked "Job Idempotency" (Same Job ID = 1 Ledger).
  # So let  # BUT we have a chain.
  # Simplified approach: 
  # Run 1: Create Jobs A, B, C, D. Wait for success.
  # Run 2: Reset status to PENDING for Jobs A, B, C, D. Worker picks up. Should verify "Already Done" or "Idempotent Re-execution".
  # Our workers currently don  # Actually, $(processShotRenderJob) uses $(upsert) for Asset. Ledger? $(record*Billing) usually logs every time unless we have dedup logic.
  # Check $(CostLedgerService): It usually does $(create).
  # If we want Ledger=1 for same JobId, the table constraint $(jobId_jobType) unique key handles it (it would throw or skip).
  # Let
  if [ "$RUN_NAME" == "Run1" ]; then
     # Create IDs
     PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
     ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug=     SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
     SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$
     
     EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
     
     JOB_ID_CE06="ce06-job-${TS}"
     JOB_ID_CE03="ce03-job-${TS}"
     JOB_ID_CE04="ce04-job-${TS}"
     JOB_ID_SHOT="shot-job-${TS}"
     export JOB_ID_CE06 JOB_ID_CE03 JOB_ID_CE04 JOB_ID_SHOT PROJECT_ID ORG_ID SCENE_ID SHOT_ID EPISODE_ID

     # Insert Jobs (PENDING)
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
      INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
      (      (      (      (     " > /dev/null
     log "Jobs Created: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT"
  else
     # Run 2: Reset Jobs to PENDING (and clear workerId so they are picked up immediately)
     log "Resetting Jobs to PENDING for Re-run..."
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "UPDATE shot_jobs SET status=  fi

  # Wait for All Succeeded
  wait_for_job "$JOB_ID_CE06"
  wait_for_job "$JOB_ID_CE03"
  wait_for_job "$JOB_ID_CE04"
  wait_for_job "$JOB_ID_SHOT"
}

wait_for_job() {
  local JID=$1
  local MAX_RETRY=30
  while [ $MAX_RETRY -gt 0 ]; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then 
      log "❌ FAIL: Job $JID FAILED"
      tail -n 30 "$EVID_DIR/worker.log"
      exit 1
    fi
    sleep 2
    ((MAX_RETRY--))
  done
  log "❌ FAIL: Job $JID Timeout"
  exit 1
}

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

# Run 1
run_chain "Run1"

# Run 2 (Idempotency)
run_chain "Run2"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. Check Ledger Counts (Should be 1 because of DB Unique constraint on jobId+jobType, Worker will fail or ignore but Gate shouldn# Actually if Worker tries to insert duplicate Ledger with same JobID, it fails hard (Job Failed) OR stays 1 (if ignore).
# If Job Failed, wait_for_job would have crashed. So if we are here, jobs SUCCEEDED.
# This means Worker handled "Ledger already exists" gracefully OR didn# Let
check_ledger() {
  local JID=$1
  local TYPE=$2
  COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM $gate$1$gate$ WHERE \"jobId\"=  if [ "$COUNT" != "1" ]; then log "❌ FAIL: Ledger Count for $TYPE is $COUNT (Expected 1)"; exit 1; fi
  log "✅ Ledger $TYPE: 1"
}

check_ledger "$JOB_ID_CE06" "CE06"
check_ledger "$JOB_ID_CE03" "CE03"
check_ledger "$JOB_ID_CE04" "CE04"
check_ledger "$JOB_ID_SHOT" "SHOT"

# 2. Check ShotRender Asset
ASSET_URI=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"storageKey\" FROM ${TABLE_ASSET} WHERE \"ownerId\"=
if [ ! -f "$ASSET_URI" ]; then log "❌ FAIL: Asset file missing"; exit 1; fi
SIZE=$(wc -c < "$ASSET_URI")
if [ "$SIZE" -le 0 ]; then log "❌ FAIL: Asset empty"; exit 1; fi
log "✅ Asset Exists: $ASSET_URI ($SIZE bytes)"

# 3. Check Trace ID Persistence (Sample one)
TRACE_VAL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$TRACE_VAL" != "trace-shot" ]; then log "❌ FAIL: Trace Mismatch ($TRACE_VAL)"; exit 1; fi
log "✅ Trace ID Valid"

# Final Report
echo "STAGE3_FINAL_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_IDS: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET: $ASSET_URI" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-Final E2E Gate PASSED"
exit 0

# ===== Stage-3-Final: E2E Closure Gate =====
# 验证：全链路贯通 (CE06 -> CE03 -> CE04 -> ShotRender) + 双跑幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_ASSET="assets"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_final_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-Final: E2E Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3013
# Ensure ASSET_STORAGE_DIR is absolute for Worker
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_gate_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3013 | xargs kill -9 2>/dev/null || true

# 1.3 Sync DB Schema
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss)

# 1.5 自举
log "== Bootstrap base data via gate_seed.ts =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts 2>&1 | tee -a "$EVID_DIR/seed.log" || {
  log "❌ FAIL: gate_seed.ts failed"
  exit 1
}

log "✅ Seed done."

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3013 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3013" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Run Logic
# ---------------------------------------------------------

run_chain() {
  local RUN_NAME=$1
  log "-- Starting Chain Run: $RUN_NAME --"

  # Recalculate IDs for this run (or reuse if we want strict reuse, but for E2E chain we usually start fresh job IDs on same objects)
  # BUT for Gateway Idempotency test, we should run EXACTLY the same logical jobs or retry them?
  # User Requirement: "Double Run: Ledger 1, Asset Reused". This implies retrying the SAME JOB ID or processing the same Business Object idempotency.
  # Given our system design (JobId is unique), idempotency usually means "Same Input -> Same Output" even if JobId differs (Business Idempotency) OR "Same JobId -> Processed Once".
  # Let  # Actually, "Ledger count = 1" per JobType usually means per Business Action.
  # Let  # Wait, if New Job ID, Ledger will log a new entry unless we deduplicate by hash. 
  # If User says "Ledger count == 1", they likely mean "Same Job ID re-execution" OR "Business logic deduplication".
  # "Gate-3b" checked "Job Idempotency" (Same Job ID = 1 Ledger).
  # So let  # BUT we have a chain.
  # Simplified approach: 
  # Run 1: Create Jobs A, B, C, D. Wait for success.
  # Run 2: Reset status to PENDING for Jobs A, B, C, D. Worker picks up. Should verify "Already Done" or "Idempotent Re-execution".
  # Our workers currently don  # Actually, $(processShotRenderJob) uses $(upsert) for Asset. Ledger? $(record*Billing) usually logs every time unless we have dedup logic.
  # Check $(CostLedgerService): It usually does $(create).
  # If we want Ledger=1 for same JobId, the table constraint $(jobId_jobType) unique key handles it (it would throw or skip).
  # Let
  if [ "$RUN_NAME" == "Run1" ]; then
     # Create IDs
     PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
     ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug=     SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
     SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$
     
     EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
     
     JOB_ID_CE06="ce06-job-${TS}"
     JOB_ID_CE03="ce03-job-${TS}"
     JOB_ID_CE04="ce04-job-${TS}"
     JOB_ID_SHOT="shot-job-${TS}"
     export JOB_ID_CE06 JOB_ID_CE03 JOB_ID_CE04 JOB_ID_SHOT PROJECT_ID ORG_ID SCENE_ID SHOT_ID EPISODE_ID

     # Insert Jobs (PENDING)
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
      INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
      (      (      (      (     " > /dev/null
     log "Jobs Created: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT"
  else
     # Run 2: Reset Jobs to PENDING (and clear workerId so they are picked up immediately)
     log "Resetting Jobs to PENDING for Re-run..."
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "UPDATE shot_jobs SET status=  fi

  # Wait for All Succeeded
  wait_for_job "$JOB_ID_CE06"
  wait_for_job "$JOB_ID_CE03"
  wait_for_job "$JOB_ID_CE04"
  wait_for_job "$JOB_ID_SHOT"
}

wait_for_job() {
  local JID=$1
  local MAX_RETRY=30
  while [ $MAX_RETRY -gt 0 ]; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then 
      log "❌ FAIL: Job $JID FAILED"
      tail -n 30 "$EVID_DIR/worker.log"
      exit 1
    fi
    sleep 2
    ((MAX_RETRY--))
  done
  log "❌ FAIL: Job $JID Timeout"
  exit 1
}

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

# Run 1
run_chain "Run1"

# Run 2 (Idempotency)
run_chain "Run2"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. Check Ledger Counts (Should be 1 because of DB Unique constraint on jobId+jobType, Worker will fail or ignore but Gate shouldn# Actually if Worker tries to insert duplicate Ledger with same JobID, it fails hard (Job Failed) OR stays 1 (if ignore).
# If Job Failed, wait_for_job would have crashed. So if we are here, jobs SUCCEEDED.
# This means Worker handled "Ledger already exists" gracefully OR didn# Let
check_ledger() {
  local JID=$1
  local TYPE=$2
  COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM $gate$1$gate$ WHERE \"jobId\"=  if [ "$COUNT" != "1" ]; then log "❌ FAIL: Ledger Count for $TYPE is $COUNT (Expected 1)"; exit 1; fi
  log "✅ Ledger $TYPE: 1"
}

check_ledger "$JOB_ID_CE06" "CE06"
check_ledger "$JOB_ID_CE03" "CE03"
check_ledger "$JOB_ID_CE04" "CE04"
check_ledger "$JOB_ID_SHOT" "SHOT"

# 2. Check ShotRender Asset
ASSET_URI=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"storageKey\" FROM ${TABLE_ASSET} WHERE \"ownerId\"=
if [ ! -f "$ASSET_URI" ]; then log "❌ FAIL: Asset file missing"; exit 1; fi
SIZE=$(wc -c < "$ASSET_URI")
if [ "$SIZE" -le 0 ]; then log "❌ FAIL: Asset empty"; exit 1; fi
log "✅ Asset Exists: $ASSET_URI ($SIZE bytes)"

# 3. Check Trace ID Persistence (Sample one)
TRACE_VAL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$TRACE_VAL" != "trace-shot" ]; then log "❌ FAIL: Trace Mismatch ($TRACE_VAL)"; exit 1; fi
log "✅ Trace ID Valid"

# Final Report
echo "STAGE3_FINAL_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_IDS: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET: $ASSET_URI" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-Final E2E Gate PASSED"
exit 0

# ===== Stage-3-Final: E2E Closure Gate =====
# 验证：全链路贯通 (CE06 -> CE03 -> CE04 -> ShotRender) + 双跑幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_ASSET="assets"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_final_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-Final: E2E Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3013
# Ensure ASSET_STORAGE_DIR is absolute for Worker
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_gate_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3013 | xargs kill -9 2>/dev/null || true

# 1.3 Sync DB Schema
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss)

# 1.5 自举
log "== Bootstrap base data via gate_seed.ts =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts 2>&1 | tee -a "$EVID_DIR/seed.log" || {
  log "❌ FAIL: gate_seed.ts failed"
  exit 1
}

log "✅ Seed done."

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3013 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3013" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Run Logic
# ---------------------------------------------------------

run_chain() {
  local RUN_NAME=$1
  log "-- Starting Chain Run: $RUN_NAME --"

  # Recalculate IDs for this run (or reuse if we want strict reuse, but for E2E chain we usually start fresh job IDs on same objects)
  # BUT for Gateway Idempotency test, we should run EXACTLY the same logical jobs or retry them?
  # User Requirement: "Double Run: Ledger 1, Asset Reused". This implies retrying the SAME JOB ID or processing the same Business Object idempotency.
  # Given our system design (JobId is unique), idempotency usually means "Same Input -> Same Output" even if JobId differs (Business Idempotency) OR "Same JobId -> Processed Once".
  # Let  # Actually, "Ledger count = 1" per JobType usually means per Business Action.
  # Let  # Wait, if New Job ID, Ledger will log a new entry unless we deduplicate by hash. 
  # If User says "Ledger count == 1", they likely mean "Same Job ID re-execution" OR "Business logic deduplication".
  # "Gate-3b" checked "Job Idempotency" (Same Job ID = 1 Ledger).
  # So let  # BUT we have a chain.
  # Simplified approach: 
  # Run 1: Create Jobs A, B, C, D. Wait for success.
  # Run 2: Reset status to PENDING for Jobs A, B, C, D. Worker picks up. Should verify "Already Done" or "Idempotent Re-execution".
  # Our workers currently don  # Actually, $(processShotRenderJob) uses $(upsert) for Asset. Ledger? $(record*Billing) usually logs every time unless we have dedup logic.
  # Check $(CostLedgerService): It usually does $(create).
  # If we want Ledger=1 for same JobId, the table constraint $(jobId_jobType) unique key handles it (it would throw or skip).
  # Let
  if [ "$RUN_NAME" == "Run1" ]; then
     # Create IDs
     PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
     ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug=     SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
     SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$
     
     EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
     
     JOB_ID_CE06="ce06-job-${TS}"
     JOB_ID_CE03="ce03-job-${TS}"
     JOB_ID_CE04="ce04-job-${TS}"
     JOB_ID_SHOT="shot-job-${TS}"
     export JOB_ID_CE06 JOB_ID_CE03 JOB_ID_CE04 JOB_ID_SHOT PROJECT_ID ORG_ID SCENE_ID SHOT_ID EPISODE_ID

     # Insert Jobs (PENDING)
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
      INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
      (      (      (      (     " > /dev/null
     log "Jobs Created: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT"
  else
     # Run 2: Reset Jobs to PENDING (and clear workerId so they are picked up immediately)
     log "Resetting Jobs to PENDING for Re-run..."
     PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "UPDATE shot_jobs SET status=  fi

  # Wait for All Succeeded
  wait_for_job "$JOB_ID_CE06"
  wait_for_job "$JOB_ID_CE03"
  wait_for_job "$JOB_ID_CE04"
  wait_for_job "$JOB_ID_SHOT"
}

wait_for_job() {
  local JID=$1
  local MAX_RETRY=30
  while [ $MAX_RETRY -gt 0 ]; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then 
      log "❌ FAIL: Job $JID FAILED"
      tail -n 30 "$EVID_DIR/worker.log"
      exit 1
    fi
    sleep 2
    ((MAX_RETRY--))
  done
  log "❌ FAIL: Job $JID Timeout"
  exit 1
}

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

# Run 1
run_chain "Run1"

# Run 2 (Idempotency)
run_chain "Run2"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. Check Ledger Counts (Should be 1 because of DB Unique constraint on jobId+jobType, Worker will fail or ignore but Gate shouldn# Actually if Worker tries to insert duplicate Ledger with same JobID, it fails hard (Job Failed) OR stays 1 (if ignore).
# If Job Failed, wait_for_job would have crashed. So if we are here, jobs SUCCEEDED.
# This means Worker handled "Ledger already exists" gracefully OR didn# Let
check_ledger() {
  local JID=$1
  local TYPE=$2
  COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM $gate$1$gate$ WHERE \"jobId\"=  if [ "$COUNT" != "1" ]; then log "❌ FAIL: Ledger Count for $TYPE is $COUNT (Expected 1)"; exit 1; fi
  log "✅ Ledger $TYPE: 1"
}

check_ledger "$JOB_ID_CE06" "CE06"
check_ledger "$JOB_ID_CE03" "CE03"
check_ledger "$JOB_ID_CE04" "CE04"
check_ledger "$JOB_ID_SHOT" "SHOT"

# 2. Check ShotRender Asset
ASSET_URI=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"storageKey\" FROM ${TABLE_ASSET} WHERE \"ownerId\"=
if [ ! -f "$ASSET_URI" ]; then log "❌ FAIL: Asset file missing"; exit 1; fi
SIZE=$(wc -c < "$ASSET_URI")
if [ "$SIZE" -le 0 ]; then log "❌ FAIL: Asset empty"; exit 1; fi
log "✅ Asset Exists: $ASSET_URI ($SIZE bytes)"

# 3. Check Trace ID Persistence (Sample one)
TRACE_VAL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$TRACE_VAL" != "trace-shot" ]; then log "❌ FAIL: Trace Mismatch ($TRACE_VAL)"; exit 1; fi
log "✅ Trace ID Valid"

# Final Report
echo "STAGE3_FINAL_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_IDS: $JOB_ID_CE06, $JOB_ID_CE03, $JOB_ID_CE04, $JOB_ID_SHOT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET: $ASSET_URI" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-Final E2E Gate PASSED"
exit 0
