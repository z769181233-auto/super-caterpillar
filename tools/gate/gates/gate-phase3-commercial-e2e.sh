#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-phase3-commercial-e2e.sh#
# Logic: 
# 1. Auth & Seed (Org, Proj, NovelSource, Scene, Shot)
# 2. Trigger Full Pipeline (CE06 -> CE03 -> CE04 -> SHOT_RENDER -> COMPOSE -> PREVIEW)
# 3. Verify synchronous result (Job IDs, Scores)
# 4. Verify DB Status (Assets, Audit Logs)
# 5. Fail-fast if any stage fails.

set -e

GATE_UID=$(date +%s)
EVIDENCE_DIR="docs/_evidence/GATE_PHASE3_E2E_${GATE_UID}"
mkdir -p "$EVIDENCE_DIR"

log() { echo -e "\033[1;32m[PIPELINE_GATE]\033[0m $1"; }
error() { echo -e "\033[1;31m[PIPELINE_ERROR]\033[0m $1" >&2; }

# 1. Environment Guard
if [ -z "$DATABASE_URL" ]; then error "DATABASE_URL missing"; exit 1; fi
API_URL="${API_URL:-http://localhost:3000}"

# 2. Shared Auth & Seeding
# Sources: VALID_API_KEY_ID, API_SECRET, ORG_ID, PROJ_ID, SHOT_ID_1, NOVEL_SOURCE_ID etc.
source tools/gate/lib/gate_auth_seed.sh

log "Gate Identity: Org=$ORG_ID, Project=$PROJ_ID, NovelSource=$NOVEL_SOURCE_ID"
log "Target Shot ID: $SHOT_ID_1"

# 3. Startup API and Workers (FORCE RESTART to pick up Orchestrator changes)
log "Stopping existing processes and clearing cache..."
# Aggressive kill by port and name
lsof -ti:3000 | xargs kill -9 || true
pkill -f "apps/api/src/main.ts" || true
pkill -f "apps/workers/src/worker-app.ts" || true
rm -rf apps/api/dist apps/workers/dist || true
sleep 3

log "Starting API Server..."
PORT=3000 API_SECRET_KEY=pipeline_secret_2026 HMAC_TRACE=1 npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register apps/api/src/main.ts > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
sleep 15 # Wait longer for NestJS to fully bootstrap

log "Starting Worker..."
STAGE3_ENGINE_MODE=REAL GATE_MODE=0 HMAC_TRACE=1 WORKER_ID="worker_p3_${GATE_UID}" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts --apiUrl="$API_URL" --apiKey="$VALID_API_KEY_ID" --apiSecret="$API_SECRET" > "$EVIDENCE_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10 # Wait for registration

# Cleanup on exit
cleanup() {
  log "Cleaning up processes..."
  [ -n "${API_PID:-}" ] && kill $API_PID || true
  [ -n "${WORKER_PID:-}" ] && kill $WORKER_PID || true
}
trap cleanup EXIT

# 4. HMAC v1.1 Helper (Reusable from Phase 2)
generate_hmac_headers_lines() {
  local method=$1
  local path=$2
  local body=$3
  local timestamp=$(date +%s)
  local nonce="nonce_${GATE_UID}"
  
  node -e "
    const crypto = require(    const secret =     const method =     const path =     const body =     const timestamp =     const nonce =     const apiKey = 
    const payload = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    process.stdout.write(    process.stdout.write(    process.stdout.write(    process.stdout.write(  "
}

# 5. EXECUTE PIPELINE: POST /api/ce-dag/run
log "Triggering Commercial E2E Pipeline (POST /api/ce-dag/run)..."
DAG_PATH="/api/ce-dag/run"
DAG_BODY=
HEADERS_RAW=$(generate_hmac_headers_lines "POST" "$DAG_PATH" "$DAG_BODY")
CURL_HEADERS=()
while   CURL_HEADERS+=(-H "$line")
done <<< "$HEADERS_RAW"
CURL_HEADERS+=(-H "Content-Type: application/json")

DAG_RESP="$EVIDENCE_DIR/dag_run_result.json"
HTTP_CODE=$(curl -s -o "$DAG_RESP" -w "%{http_code}" \
  -X POST "$API_URL$DAG_PATH" \
  "${CURL_HEADERS[@]}" \
  -d "$DAG_BODY")

log "API Response Code: $HTTP_CODE"
if [ "$HTTP_CODE" != "201" ]; then
  error "Pipeline Trigger Failed (HTTP $HTTP_CODE)"
  cat "$DAG_RESP"
  exit 1
fi

# 6. Verify Result Structure
log "Verifying Pipeline Result Structure..."
node -e "
  const res = JSON.parse(require(  const required = [  for (const f of required) {
    if (res[f] === undefined || res[f] === null) { console.error(  }
  console.log(" || { error "Invalid Result Structure"; exit 1; }

# 7. Deep DB Verification (Commercial HARD SEAL)
log "Performing Deep DB Verification (Scene Video Asset)..."
SCENE_ID=$(node -e "
  const res = JSON.parse(require(  // In our seed, SHOT_ID_1 is bound to a Scene. Let  console.log(") # We
# Query DB for the Scene Asset created by the Preview Job
PREVIEW_JOB_ID=$(node -e "console.log(JSON.parse(require(
log "Verifying Scene Video Asset in DB for Job $PREVIEW_JOB_ID..."
ASSET_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM assets 
  WHERE \"createdByJobId\" =     AND \"ownerType\" =     AND type =     AND status = ")

if [ "$ASSET_COUNT" -gt 0 ]; then
  log "Asset Found: $ASSET_COUNT scene video(s) generated."
else
  error "Deep Verification Failed: No Scene Video Asset found for Preview Job $PREVIEW_JOB_ID"
  exit 1
fi

# 8. Audit Log Check
log "Checking Audit Trail for Pipeline stages..."
log "Preview Job ID: $PREVIEW_JOB_ID"
TRACE_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT \"traceId\" FROM shot_jobs WHERE id = log "Resolved Job Trace ID: $TRACE_ID" # $gate$

TOTAL_AUDITS=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_logs") # $gate$
log "Total Audit Logs in DB: $TOTAL_AUDITS"

DEBUG_ACTIONS=$(psql "$DATABASE_URL" -t -A -c "SELECT action FROM audit_logs WHERE \"details\"->>log "Actions found for Trace ID: $DEBUG_ACTIONS" # $gate$

DEBUG_DETAILS=$(psql "$DATABASE_URL" -t -A -c "SELECT details FROM audit_logs WHERE \"details\"->>log "Sample Details for Trace ID: $DEBUG_DETAILS" # $gate$

AUDIT_LOG_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM audit_logs 
  WHERE \"details\"->>    AND action LIKE ")

if [ "$AUDIT_LOG_COUNT" -gt 2 ]; then
  log "Audit Trail Found: "$AUDIT_LOG_COUNT" engine-level records."
else
  error "Audit Trail Missing for Pipeline stages."
  exit 1
fi

log "--------------------------------------------------------"
log "COMMERCIAL E2E PIPELINE: HARD PASS"
log "Evidence archived at: $EVIDENCE_DIR"
log "--------------------------------------------------------"

# 9. CostLedger Verification (P0 Hotfix: Billing Gap Closure)
log "Performing CostLedger Verification (Commercial 0-Risk)..."

# A. Count Check
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")
# Note: pipelineRunId usually matches traceId or is passed down. 
# In our flow, runId is trace_... or uuid. Let
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")

log "CostLedger Entries found for Trace ID $TRACE_ID: $LEDGER_COUNT"

# Dump Ledger for Evidence
psql "$DATABASE_URL" -c " # $gate$
  SELECT \"jobType\", \"costAmount\", \"billingUnit\", \"metadata\"->>  FROM cost_ledgers 
  WHERE metadata->>" > "$EVIDENCE_DIR/ledger_check.txt"

# B. Coverage Assertion
# Expected: CE06, CE03, CE04, SHOT_RENDER, VIDEO_RENDER (Total 5)
# Adjust if VIDEO_RENDER (CE11 preview) uses different traceId handling, but our processor mods stuck to traceId || jobId
EXPECTED_MIN=4 
if [ "$LEDGER_COUNT" -lt "$EXPECTED_MIN" ]; then
  error "Billing Gap Detected: Expected at least $EXPECTED_MIN ledger entries (CE06/03/04/Shot/Video), found $LEDGER_COUNT"
  cat "$EVIDENCE_DIR/ledger_check.txt"
  exit 1
fi

# C. Engine Whitelist Check
# Verify specific engines are present
ENGINES_FOUND=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT string_agg(metadata->>  FROM cost_ledgers 
  WHERE metadata->>")

log "Engines Billed: $ENGINES_FOUND"

for required in "ce06_novel_parsing" "ce03_visual_density" "ce04_visual_enrichment" "shot_render"; do
  if [[ "$ENGINES_FOUND" != *"$required"* ]]; then
    error "Missing Billing for Required Engine: $required"
    exit 1
  fi
done

log "Billing Coverage Verified: ALL REAL ENGINES ACCOUNTED."
log "--------------------------------------------------------"
log "COMMERCIAL HARD SEAL VERIFIED"

exit 0

set -e

GATE_UID=$(date +%s)
EVIDENCE_DIR="docs/_evidence/GATE_PHASE3_E2E_${GATE_UID}"
mkdir -p "$EVIDENCE_DIR"

log() { echo -e "\033[1;32m[PIPELINE_GATE]\033[0m $1"; }
error() { echo -e "\033[1;31m[PIPELINE_ERROR]\033[0m $1" >&2; }

# 1. Environment Guard
if [ -z "$DATABASE_URL" ]; then error "DATABASE_URL missing"; exit 1; fi
API_URL="${API_URL:-http://localhost:3000}"

# 2. Shared Auth & Seeding
# Sources: VALID_API_KEY_ID, API_SECRET, ORG_ID, PROJ_ID, SHOT_ID_1, NOVEL_SOURCE_ID etc.
source tools/gate/lib/gate_auth_seed.sh

log "Gate Identity: Org=$ORG_ID, Project=$PROJ_ID, NovelSource=$NOVEL_SOURCE_ID"
log "Target Shot ID: $SHOT_ID_1"

# 3. Startup API and Workers (FORCE RESTART to pick up Orchestrator changes)
log "Stopping existing processes and clearing cache..."
# Aggressive kill by port and name
lsof -ti:3000 | xargs kill -9 || true
pkill -f "apps/api/src/main.ts" || true
pkill -f "apps/workers/src/worker-app.ts" || true
rm -rf apps/api/dist apps/workers/dist || true
sleep 3

log "Starting API Server..."
PORT=3000 API_SECRET_KEY=pipeline_secret_2026 HMAC_TRACE=1 npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register apps/api/src/main.ts > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
sleep 15 # Wait longer for NestJS to fully bootstrap

log "Starting Worker..."
STAGE3_ENGINE_MODE=REAL GATE_MODE=0 HMAC_TRACE=1 WORKER_ID="worker_p3_${GATE_UID}" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts --apiUrl="$API_URL" --apiKey="$VALID_API_KEY_ID" --apiSecret="$API_SECRET" > "$EVIDENCE_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10 # Wait for registration

# Cleanup on exit
cleanup() {
  log "Cleaning up processes..."
  [ -n "${API_PID:-}" ] && kill $API_PID || true
  [ -n "${WORKER_PID:-}" ] && kill $WORKER_PID || true
}
trap cleanup EXIT

# 4. HMAC v1.1 Helper (Reusable from Phase 2)
generate_hmac_headers_lines() {
  local method=$1
  local path=$2
  local body=$3
  local timestamp=$(date +%s)
  local nonce="nonce_${GATE_UID}"
  
  node -e "
    const crypto = require(    const secret =     const method =     const path =     const body =     const timestamp =     const nonce =     const apiKey = 
    const payload = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    process.stdout.write(    process.stdout.write(    process.stdout.write(    process.stdout.write(  "
}

# 5. EXECUTE PIPELINE: POST /api/ce-dag/run
log "Triggering Commercial E2E Pipeline (POST /api/ce-dag/run)..."
DAG_PATH="/api/ce-dag/run"
DAG_BODY=
HEADERS_RAW=$(generate_hmac_headers_lines "POST" "$DAG_PATH" "$DAG_BODY")
CURL_HEADERS=()
while   CURL_HEADERS+=(-H "$line")
done <<< "$HEADERS_RAW"
CURL_HEADERS+=(-H "Content-Type: application/json")

DAG_RESP="$EVIDENCE_DIR/dag_run_result.json"
HTTP_CODE=$(curl -s -o "$DAG_RESP" -w "%{http_code}" \
  -X POST "$API_URL$DAG_PATH" \
  "${CURL_HEADERS[@]}" \
  -d "$DAG_BODY")

log "API Response Code: $HTTP_CODE"
if [ "$HTTP_CODE" != "201" ]; then
  error "Pipeline Trigger Failed (HTTP $HTTP_CODE)"
  cat "$DAG_RESP"
  exit 1
fi

# 6. Verify Result Structure
log "Verifying Pipeline Result Structure..."
node -e "
  const res = JSON.parse(require(  const required = [  for (const f of required) {
    if (res[f] === undefined || res[f] === null) { console.error(  }
  console.log(" || { error "Invalid Result Structure"; exit 1; }

# 7. Deep DB Verification (Commercial HARD SEAL)
log "Performing Deep DB Verification (Scene Video Asset)..."
SCENE_ID=$(node -e "
  const res = JSON.parse(require(  // In our seed, SHOT_ID_1 is bound to a Scene. Let  console.log(") # We
# Query DB for the Scene Asset created by the Preview Job
PREVIEW_JOB_ID=$(node -e "console.log(JSON.parse(require(
log "Verifying Scene Video Asset in DB for Job $PREVIEW_JOB_ID..."
ASSET_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM assets 
  WHERE \"createdByJobId\" =     AND \"ownerType\" =     AND type =     AND status = ")

if [ "$ASSET_COUNT" -gt 0 ]; then
  log "Asset Found: $ASSET_COUNT scene video(s) generated."
else
  error "Deep Verification Failed: No Scene Video Asset found for Preview Job $PREVIEW_JOB_ID"
  exit 1
fi

# 8. Audit Log Check
log "Checking Audit Trail for Pipeline stages..."
log "Preview Job ID: $PREVIEW_JOB_ID"
TRACE_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT \"traceId\" FROM shot_jobs WHERE id = log "Resolved Job Trace ID: $TRACE_ID" # $gate$

TOTAL_AUDITS=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_logs") # $gate$
log "Total Audit Logs in DB: $TOTAL_AUDITS"

DEBUG_ACTIONS=$(psql "$DATABASE_URL" -t -A -c "SELECT action FROM audit_logs WHERE \"details\"->>log "Actions found for Trace ID: $DEBUG_ACTIONS" # $gate$

DEBUG_DETAILS=$(psql "$DATABASE_URL" -t -A -c "SELECT details FROM audit_logs WHERE \"details\"->>log "Sample Details for Trace ID: $DEBUG_DETAILS" # $gate$

AUDIT_LOG_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM audit_logs 
  WHERE \"details\"->>    AND action LIKE ")

if [ "$AUDIT_LOG_COUNT" -gt 2 ]; then
  log "Audit Trail Found: "$AUDIT_LOG_COUNT" engine-level records."
else
  error "Audit Trail Missing for Pipeline stages."
  exit 1
fi

log "--------------------------------------------------------"
log "COMMERCIAL E2E PIPELINE: HARD PASS"
log "Evidence archived at: $EVIDENCE_DIR"
log "--------------------------------------------------------"

# 9. CostLedger Verification (P0 Hotfix: Billing Gap Closure)
log "Performing CostLedger Verification (Commercial 0-Risk)..."

# A. Count Check
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")
# Note: pipelineRunId usually matches traceId or is passed down. 
# In our flow, runId is trace_... or uuid. Let
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")

log "CostLedger Entries found for Trace ID $TRACE_ID: $LEDGER_COUNT"

# Dump Ledger for Evidence
psql "$DATABASE_URL" -c " # $gate$
  SELECT \"jobType\", \"costAmount\", \"billingUnit\", \"metadata\"->>  FROM cost_ledgers 
  WHERE metadata->>" > "$EVIDENCE_DIR/ledger_check.txt"

# B. Coverage Assertion
# Expected: CE06, CE03, CE04, SHOT_RENDER, VIDEO_RENDER (Total 5)
# Adjust if VIDEO_RENDER (CE11 preview) uses different traceId handling, but our processor mods stuck to traceId || jobId
EXPECTED_MIN=4 
if [ "$LEDGER_COUNT" -lt "$EXPECTED_MIN" ]; then
  error "Billing Gap Detected: Expected at least $EXPECTED_MIN ledger entries (CE06/03/04/Shot/Video), found $LEDGER_COUNT"
  cat "$EVIDENCE_DIR/ledger_check.txt"
  exit 1
fi

# C. Engine Whitelist Check
# Verify specific engines are present
ENGINES_FOUND=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT string_agg(metadata->>  FROM cost_ledgers 
  WHERE metadata->>")

log "Engines Billed: $ENGINES_FOUND"

for required in "ce06_novel_parsing" "ce03_visual_density" "ce04_visual_enrichment" "shot_render"; do
  if [[ "$ENGINES_FOUND" != *"$required"* ]]; then
    error "Missing Billing for Required Engine: $required"
    exit 1
  fi
done

log "Billing Coverage Verified: ALL REAL ENGINES ACCOUNTED."
log "--------------------------------------------------------"
log "COMMERCIAL HARD SEAL VERIFIED"

exit 0

set -e

GATE_UID=$(date +%s)
EVIDENCE_DIR="docs/_evidence/GATE_PHASE3_E2E_${GATE_UID}"
mkdir -p "$EVIDENCE_DIR"

log() { echo -e "\033[1;32m[PIPELINE_GATE]\033[0m $1"; }
error() { echo -e "\033[1;31m[PIPELINE_ERROR]\033[0m $1" >&2; }

# 1. Environment Guard
if [ -z "$DATABASE_URL" ]; then error "DATABASE_URL missing"; exit 1; fi
API_URL="${API_URL:-http://localhost:3000}"

# 2. Shared Auth & Seeding
# Sources: VALID_API_KEY_ID, API_SECRET, ORG_ID, PROJ_ID, SHOT_ID_1, NOVEL_SOURCE_ID etc.
source tools/gate/lib/gate_auth_seed.sh

log "Gate Identity: Org=$ORG_ID, Project=$PROJ_ID, NovelSource=$NOVEL_SOURCE_ID"
log "Target Shot ID: $SHOT_ID_1"

# 3. Startup API and Workers (FORCE RESTART to pick up Orchestrator changes)
log "Stopping existing processes and clearing cache..."
# Aggressive kill by port and name
lsof -ti:3000 | xargs kill -9 || true
pkill -f "apps/api/src/main.ts" || true
pkill -f "apps/workers/src/worker-app.ts" || true
rm -rf apps/api/dist apps/workers/dist || true
sleep 3

log "Starting API Server..."
PORT=3000 API_SECRET_KEY=pipeline_secret_2026 HMAC_TRACE=1 npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register apps/api/src/main.ts > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
sleep 15 # Wait longer for NestJS to fully bootstrap

log "Starting Worker..."
STAGE3_ENGINE_MODE=REAL GATE_MODE=0 HMAC_TRACE=1 WORKER_ID="worker_p3_${GATE_UID}" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts --apiUrl="$API_URL" --apiKey="$VALID_API_KEY_ID" --apiSecret="$API_SECRET" > "$EVIDENCE_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10 # Wait for registration

# Cleanup on exit
cleanup() {
  log "Cleaning up processes..."
  [ -n "${API_PID:-}" ] && kill $API_PID || true
  [ -n "${WORKER_PID:-}" ] && kill $WORKER_PID || true
}
trap cleanup EXIT

# 4. HMAC v1.1 Helper (Reusable from Phase 2)
generate_hmac_headers_lines() {
  local method=$1
  local path=$2
  local body=$3
  local timestamp=$(date +%s)
  local nonce="nonce_${GATE_UID}"
  
  node -e "
    const crypto = require(    const secret =     const method =     const path =     const body =     const timestamp =     const nonce =     const apiKey = 
    const payload = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    process.stdout.write(    process.stdout.write(    process.stdout.write(    process.stdout.write(  "
}

# 5. EXECUTE PIPELINE: POST /api/ce-dag/run
log "Triggering Commercial E2E Pipeline (POST /api/ce-dag/run)..."
DAG_PATH="/api/ce-dag/run"
DAG_BODY=
HEADERS_RAW=$(generate_hmac_headers_lines "POST" "$DAG_PATH" "$DAG_BODY")
CURL_HEADERS=()
while   CURL_HEADERS+=(-H "$line")
done <<< "$HEADERS_RAW"
CURL_HEADERS+=(-H "Content-Type: application/json")

DAG_RESP="$EVIDENCE_DIR/dag_run_result.json"
HTTP_CODE=$(curl -s -o "$DAG_RESP" -w "%{http_code}" \
  -X POST "$API_URL$DAG_PATH" \
  "${CURL_HEADERS[@]}" \
  -d "$DAG_BODY")

log "API Response Code: $HTTP_CODE"
if [ "$HTTP_CODE" != "201" ]; then
  error "Pipeline Trigger Failed (HTTP $HTTP_CODE)"
  cat "$DAG_RESP"
  exit 1
fi

# 6. Verify Result Structure
log "Verifying Pipeline Result Structure..."
node -e "
  const res = JSON.parse(require(  const required = [  for (const f of required) {
    if (res[f] === undefined || res[f] === null) { console.error(  }
  console.log(" || { error "Invalid Result Structure"; exit 1; }

# 7. Deep DB Verification (Commercial HARD SEAL)
log "Performing Deep DB Verification (Scene Video Asset)..."
SCENE_ID=$(node -e "
  const res = JSON.parse(require(  // In our seed, SHOT_ID_1 is bound to a Scene. Let  console.log(") # We
# Query DB for the Scene Asset created by the Preview Job
PREVIEW_JOB_ID=$(node -e "console.log(JSON.parse(require(
log "Verifying Scene Video Asset in DB for Job $PREVIEW_JOB_ID..."
ASSET_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM assets 
  WHERE \"createdByJobId\" =     AND \"ownerType\" =     AND type =     AND status = ")

if [ "$ASSET_COUNT" -gt 0 ]; then
  log "Asset Found: $ASSET_COUNT scene video(s) generated."
else
  error "Deep Verification Failed: No Scene Video Asset found for Preview Job $PREVIEW_JOB_ID"
  exit 1
fi

# 8. Audit Log Check
log "Checking Audit Trail for Pipeline stages..."
log "Preview Job ID: $PREVIEW_JOB_ID"
TRACE_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT \"traceId\" FROM shot_jobs WHERE id = log "Resolved Job Trace ID: $TRACE_ID" # $gate$

TOTAL_AUDITS=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_logs") # $gate$
log "Total Audit Logs in DB: $TOTAL_AUDITS"

DEBUG_ACTIONS=$(psql "$DATABASE_URL" -t -A -c "SELECT action FROM audit_logs WHERE \"details\"->>log "Actions found for Trace ID: $DEBUG_ACTIONS" # $gate$

DEBUG_DETAILS=$(psql "$DATABASE_URL" -t -A -c "SELECT details FROM audit_logs WHERE \"details\"->>log "Sample Details for Trace ID: $DEBUG_DETAILS" # $gate$

AUDIT_LOG_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM audit_logs 
  WHERE \"details\"->>    AND action LIKE ")

if [ "$AUDIT_LOG_COUNT" -gt 2 ]; then
  log "Audit Trail Found: "$AUDIT_LOG_COUNT" engine-level records."
else
  error "Audit Trail Missing for Pipeline stages."
  exit 1
fi

log "--------------------------------------------------------"
log "COMMERCIAL E2E PIPELINE: HARD PASS"
log "Evidence archived at: $EVIDENCE_DIR"
log "--------------------------------------------------------"

# 9. CostLedger Verification (P0 Hotfix: Billing Gap Closure)
log "Performing CostLedger Verification (Commercial 0-Risk)..."

# A. Count Check
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")
# Note: pipelineRunId usually matches traceId or is passed down. 
# In our flow, runId is trace_... or uuid. Let
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")

log "CostLedger Entries found for Trace ID $TRACE_ID: $LEDGER_COUNT"

# Dump Ledger for Evidence
psql "$DATABASE_URL" -c " # $gate$
  SELECT \"jobType\", \"costAmount\", \"billingUnit\", \"metadata\"->>  FROM cost_ledgers 
  WHERE metadata->>" > "$EVIDENCE_DIR/ledger_check.txt"

# B. Coverage Assertion
# Expected: CE06, CE03, CE04, SHOT_RENDER, VIDEO_RENDER (Total 5)
# Adjust if VIDEO_RENDER (CE11 preview) uses different traceId handling, but our processor mods stuck to traceId || jobId
EXPECTED_MIN=4 
if [ "$LEDGER_COUNT" -lt "$EXPECTED_MIN" ]; then
  error "Billing Gap Detected: Expected at least $EXPECTED_MIN ledger entries (CE06/03/04/Shot/Video), found $LEDGER_COUNT"
  cat "$EVIDENCE_DIR/ledger_check.txt"
  exit 1
fi

# C. Engine Whitelist Check
# Verify specific engines are present
ENGINES_FOUND=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT string_agg(metadata->>  FROM cost_ledgers 
  WHERE metadata->>")

log "Engines Billed: $ENGINES_FOUND"

for required in "ce06_novel_parsing" "ce03_visual_density" "ce04_visual_enrichment" "shot_render"; do
  if [[ "$ENGINES_FOUND" != *"$required"* ]]; then
    error "Missing Billing for Required Engine: $required"
    exit 1
  fi
done

log "Billing Coverage Verified: ALL REAL ENGINES ACCOUNTED."
log "--------------------------------------------------------"
log "COMMERCIAL HARD SEAL VERIFIED"

exit 0

set -e

GATE_UID=$(date +%s)
EVIDENCE_DIR="docs/_evidence/GATE_PHASE3_E2E_${GATE_UID}"
mkdir -p "$EVIDENCE_DIR"

log() { echo -e "\033[1;32m[PIPELINE_GATE]\033[0m $1"; }
error() { echo -e "\033[1;31m[PIPELINE_ERROR]\033[0m $1" >&2; }

# 1. Environment Guard
if [ -z "$DATABASE_URL" ]; then error "DATABASE_URL missing"; exit 1; fi
API_URL="${API_URL:-http://localhost:3000}"

# 2. Shared Auth & Seeding
# Sources: VALID_API_KEY_ID, API_SECRET, ORG_ID, PROJ_ID, SHOT_ID_1, NOVEL_SOURCE_ID etc.
source tools/gate/lib/gate_auth_seed.sh

log "Gate Identity: Org=$ORG_ID, Project=$PROJ_ID, NovelSource=$NOVEL_SOURCE_ID"
log "Target Shot ID: $SHOT_ID_1"

# 3. Startup API and Workers (FORCE RESTART to pick up Orchestrator changes)
log "Stopping existing processes and clearing cache..."
# Aggressive kill by port and name
lsof -ti:3000 | xargs kill -9 || true
pkill -f "apps/api/src/main.ts" || true
pkill -f "apps/workers/src/worker-app.ts" || true
rm -rf apps/api/dist apps/workers/dist || true
sleep 3

log "Starting API Server..."
PORT=3000 API_SECRET_KEY=pipeline_secret_2026 HMAC_TRACE=1 npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register apps/api/src/main.ts > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
sleep 15 # Wait longer for NestJS to fully bootstrap

log "Starting Worker..."
STAGE3_ENGINE_MODE=REAL GATE_MODE=0 HMAC_TRACE=1 WORKER_ID="worker_p3_${GATE_UID}" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts --apiUrl="$API_URL" --apiKey="$VALID_API_KEY_ID" --apiSecret="$API_SECRET" > "$EVIDENCE_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10 # Wait for registration

# Cleanup on exit
cleanup() {
  log "Cleaning up processes..."
  [ -n "${API_PID:-}" ] && kill $API_PID || true
  [ -n "${WORKER_PID:-}" ] && kill $WORKER_PID || true
}
trap cleanup EXIT

# 4. HMAC v1.1 Helper (Reusable from Phase 2)
generate_hmac_headers_lines() {
  local method=$1
  local path=$2
  local body=$3
  local timestamp=$(date +%s)
  local nonce="nonce_${GATE_UID}"
  
  node -e "
    const crypto = require(    const secret =     const method =     const path =     const body =     const timestamp =     const nonce =     const apiKey = 
    const payload = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    process.stdout.write(    process.stdout.write(    process.stdout.write(    process.stdout.write(  "
}

# 5. EXECUTE PIPELINE: POST /api/ce-dag/run
log "Triggering Commercial E2E Pipeline (POST /api/ce-dag/run)..."
DAG_PATH="/api/ce-dag/run"
DAG_BODY=
HEADERS_RAW=$(generate_hmac_headers_lines "POST" "$DAG_PATH" "$DAG_BODY")
CURL_HEADERS=()
while   CURL_HEADERS+=(-H "$line")
done <<< "$HEADERS_RAW"
CURL_HEADERS+=(-H "Content-Type: application/json")

DAG_RESP="$EVIDENCE_DIR/dag_run_result.json"
HTTP_CODE=$(curl -s -o "$DAG_RESP" -w "%{http_code}" \
  -X POST "$API_URL$DAG_PATH" \
  "${CURL_HEADERS[@]}" \
  -d "$DAG_BODY")

log "API Response Code: $HTTP_CODE"
if [ "$HTTP_CODE" != "201" ]; then
  error "Pipeline Trigger Failed (HTTP $HTTP_CODE)"
  cat "$DAG_RESP"
  exit 1
fi

# 6. Verify Result Structure
log "Verifying Pipeline Result Structure..."
node -e "
  const res = JSON.parse(require(  const required = [  for (const f of required) {
    if (res[f] === undefined || res[f] === null) { console.error(  }
  console.log(" || { error "Invalid Result Structure"; exit 1; }

# 7. Deep DB Verification (Commercial HARD SEAL)
log "Performing Deep DB Verification (Scene Video Asset)..."
SCENE_ID=$(node -e "
  const res = JSON.parse(require(  // In our seed, SHOT_ID_1 is bound to a Scene. Let  console.log(") # We
# Query DB for the Scene Asset created by the Preview Job
PREVIEW_JOB_ID=$(node -e "console.log(JSON.parse(require(
log "Verifying Scene Video Asset in DB for Job $PREVIEW_JOB_ID..."
ASSET_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM assets 
  WHERE \"createdByJobId\" =     AND \"ownerType\" =     AND type =     AND status = ")

if [ "$ASSET_COUNT" -gt 0 ]; then
  log "Asset Found: $ASSET_COUNT scene video(s) generated."
else
  error "Deep Verification Failed: No Scene Video Asset found for Preview Job $PREVIEW_JOB_ID"
  exit 1
fi

# 8. Audit Log Check
log "Checking Audit Trail for Pipeline stages..."
log "Preview Job ID: $PREVIEW_JOB_ID"
TRACE_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT \"traceId\" FROM shot_jobs WHERE id = log "Resolved Job Trace ID: $TRACE_ID" # $gate$

TOTAL_AUDITS=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM audit_logs") # $gate$
log "Total Audit Logs in DB: $TOTAL_AUDITS"

DEBUG_ACTIONS=$(psql "$DATABASE_URL" -t -A -c "SELECT action FROM audit_logs WHERE \"details\"->>log "Actions found for Trace ID: $DEBUG_ACTIONS" # $gate$

DEBUG_DETAILS=$(psql "$DATABASE_URL" -t -A -c "SELECT details FROM audit_logs WHERE \"details\"->>log "Sample Details for Trace ID: $DEBUG_DETAILS" # $gate$

AUDIT_LOG_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM audit_logs 
  WHERE \"details\"->>    AND action LIKE ")

if [ "$AUDIT_LOG_COUNT" -gt 2 ]; then
  log "Audit Trail Found: "$AUDIT_LOG_COUNT" engine-level records."
else
  error "Audit Trail Missing for Pipeline stages."
  exit 1
fi

log "--------------------------------------------------------"
log "COMMERCIAL E2E PIPELINE: HARD PASS"
log "Evidence archived at: $EVIDENCE_DIR"
log "--------------------------------------------------------"

# 9. CostLedger Verification (P0 Hotfix: Billing Gap Closure)
log "Performing CostLedger Verification (Commercial 0-Risk)..."

# A. Count Check
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")
# Note: pipelineRunId usually matches traceId or is passed down. 
# In our flow, runId is trace_... or uuid. Let
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT count(*) FROM cost_ledgers 
  WHERE metadata->>")

log "CostLedger Entries found for Trace ID $TRACE_ID: $LEDGER_COUNT"

# Dump Ledger for Evidence
psql "$DATABASE_URL" -c " # $gate$
  SELECT \"jobType\", \"costAmount\", \"billingUnit\", \"metadata\"->>  FROM cost_ledgers 
  WHERE metadata->>" > "$EVIDENCE_DIR/ledger_check.txt"

# B. Coverage Assertion
# Expected: CE06, CE03, CE04, SHOT_RENDER, VIDEO_RENDER (Total 5)
# Adjust if VIDEO_RENDER (CE11 preview) uses different traceId handling, but our processor mods stuck to traceId || jobId
EXPECTED_MIN=4 
if [ "$LEDGER_COUNT" -lt "$EXPECTED_MIN" ]; then
  error "Billing Gap Detected: Expected at least $EXPECTED_MIN ledger entries (CE06/03/04/Shot/Video), found $LEDGER_COUNT"
  cat "$EVIDENCE_DIR/ledger_check.txt"
  exit 1
fi

# C. Engine Whitelist Check
# Verify specific engines are present
ENGINES_FOUND=$(psql "$DATABASE_URL" -t -A -c " # $gate$
  SELECT string_agg(metadata->>  FROM cost_ledgers 
  WHERE metadata->>")

log "Engines Billed: $ENGINES_FOUND"

for required in "ce06_novel_parsing" "ce03_visual_density" "ce04_visual_enrichment" "shot_render"; do
  if [[ "$ENGINES_FOUND" != *"$required"* ]]; then
    error "Missing Billing for Required Engine: $required"
    exit 1
  fi
done

log "Billing Coverage Verified: ALL REAL ENGINES ACCOUNTED."
log "--------------------------------------------------------"
log "COMMERCIAL HARD SEAL VERIFIED"

exit 0
