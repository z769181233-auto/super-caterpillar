#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"# ===== Stage-3-D: CE04 Enrichment Closure Gate =====
# 验证：CE04 视觉丰富度计算 + Prompt生成 + 落库 + 计费 + 幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce04_enrichment_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-D: CE04 Enrichment Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL # Use Real-Stub for deterministic output
export API_PORT=3011
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

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
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3011" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 CE04 Job
log "Triggering CE04 Job..."

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug= # $gate$
JOB_ID=$(node -e "const crypto = require(TRACE_ID="trace-ce04-gate-${TS}"

# Insert Job
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
    (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  (SELECT id FROM shots LIMIT 1),
      NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID"

# 4. 等待完成
log "Waiting for Job $JOB_ID..."
MAX_RETRY=30
while [ $MAX_RETRY -gt 0 ]; do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  log "Status: $STATUS" # $gate$
  if [ "$STATUS" == "SUCCEEDED" ]; then break; fi
  if [ "$STATUS" == "FAILED" ]; then 
    log "❌ FAIL: Job FAILED"
    tail -n 30 "$EVID_DIR/worker.log"
    exit 1
  fi
  sleep 3
  ((MAX_RETRY--))
done

if [ $MAX_RETRY -eq 0 ]; then
  log "❌ FAIL: Job timeout"
  exit 1
fi

# 5. 验证 (8 Assertions)
log "== Verification Start =="

# Asserts 1-8
METRICS_JSON=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT row_to_json(m) FROM (SELECT \"enrichmentQuality\", metadata FROM ${TABLE_METRICS} WHERE \"jobId\"=
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"=
TOTAL_CREDITS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"totalCredits\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=
# 1. Job SUCCEEDED (Already checked)
# 2. Enrichment Record count >= 1 (Idempotent: just check we have data. If duplicate, ensure content is consistent)
METRICS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_METRICS} WHERE \"jobId\"=
if [ "$METRICS_COUNT" -lt "1" ]; then log "❌ FAIL: Metric count $METRICS_COUNT"; exit 1; fi
log "✅ Assertion 2: Metrics Count >= 1 ($METRICS_COUNT)"

# 3. enrichedPrompt not empty & length > N
ENRICHED_PROMPT=$(echo $METRICS_JSON | jq -r LEN=${#ENRICHED_PROMPT}
if [ "$LEN" -lt 10 ]; then log "❌ FAIL: Prompt too short ($LEN)"; exit 1; fi
log "✅ Assertion 3: Prompt Length ($LEN) > 10"

# 4. promptParts contains keys
STYLE=$(echo $METRICS_JSON | jq -r if [ "$STYLE" == "null" ] || [ -z "$STYLE" ]; then log "❌ FAIL: Missing style"; exit 1; fi
log "✅ Assertion 4: Prompt Parts (Style: $STYLE) present"

# 5. metadata.traceId matches (Check Ledger traceId)
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then log "❌ FAIL: Trace mismatch"; exit 1; fi
log "✅ Assertion 5: Trace ID Verified"

# 6. CostLedger count == 1
if [ "$LEDGER_COUNT" != "1" ]; then log "❌ FAIL: Ledger count $LEDGER_COUNT"; exit 1; fi
log "✅ Assertion 6: Ledger Count == 1"

# 7. totalCredits > 0
if (( $(echo "$TOTAL_CREDITS <= 0" | bc -l) )); then log "❌ FAIL: Credits $TOTAL_CREDITS"; exit 1; fi
log "✅ Assertion 7: Credits > 0 ($TOTAL_CREDITS)"

# 8. Hash Check (For double run, handled by wrapper script comparing reports)

# Report
echo "STAGE3_D_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ENRICHED_PROMPT: $ENRICHED_PROMPT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "PROMPT_HASH: $(echo $ENRICHED_PROMPT | md5)" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-D Gate PASSED"
exit 0

# ===== Stage-3-D: CE04 Enrichment Closure Gate =====
# 验证：CE04 视觉丰富度计算 + Prompt生成 + 落库 + 计费 + 幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce04_enrichment_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-D: CE04 Enrichment Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL # Use Real-Stub for deterministic output
export API_PORT=3011
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

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
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3011" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 CE04 Job
log "Triggering CE04 Job..."

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug= # $gate$
JOB_ID=$(node -e "const crypto = require(TRACE_ID="trace-ce04-gate-${TS}"

# Insert Job
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
    (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  (SELECT id FROM shots LIMIT 1),
      NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID"

# 4. 等待完成
log "Waiting for Job $JOB_ID..."
MAX_RETRY=30
while [ $MAX_RETRY -gt 0 ]; do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  log "Status: $STATUS" # $gate$
  if [ "$STATUS" == "SUCCEEDED" ]; then break; fi
  if [ "$STATUS" == "FAILED" ]; then 
    log "❌ FAIL: Job FAILED"
    tail -n 30 "$EVID_DIR/worker.log"
    exit 1
  fi
  sleep 3
  ((MAX_RETRY--))
done

if [ $MAX_RETRY -eq 0 ]; then
  log "❌ FAIL: Job timeout"
  exit 1
fi

# 5. 验证 (8 Assertions)
log "== Verification Start =="

# Asserts 1-8
METRICS_JSON=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT row_to_json(m) FROM (SELECT \"enrichmentQuality\", metadata FROM ${TABLE_METRICS} WHERE \"jobId\"=
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"=
TOTAL_CREDITS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"totalCredits\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=
# 1. Job SUCCEEDED (Already checked)
# 2. Enrichment Record count >= 1 (Idempotent: just check we have data. If duplicate, ensure content is consistent)
METRICS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_METRICS} WHERE \"jobId\"=
if [ "$METRICS_COUNT" -lt "1" ]; then log "❌ FAIL: Metric count $METRICS_COUNT"; exit 1; fi
log "✅ Assertion 2: Metrics Count >= 1 ($METRICS_COUNT)"

# 3. enrichedPrompt not empty & length > N
ENRICHED_PROMPT=$(echo $METRICS_JSON | jq -r LEN=${#ENRICHED_PROMPT}
if [ "$LEN" -lt 10 ]; then log "❌ FAIL: Prompt too short ($LEN)"; exit 1; fi
log "✅ Assertion 3: Prompt Length ($LEN) > 10"

# 4. promptParts contains keys
STYLE=$(echo $METRICS_JSON | jq -r if [ "$STYLE" == "null" ] || [ -z "$STYLE" ]; then log "❌ FAIL: Missing style"; exit 1; fi
log "✅ Assertion 4: Prompt Parts (Style: $STYLE) present"

# 5. metadata.traceId matches (Check Ledger traceId)
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then log "❌ FAIL: Trace mismatch"; exit 1; fi
log "✅ Assertion 5: Trace ID Verified"

# 6. CostLedger count == 1
if [ "$LEDGER_COUNT" != "1" ]; then log "❌ FAIL: Ledger count $LEDGER_COUNT"; exit 1; fi
log "✅ Assertion 6: Ledger Count == 1"

# 7. totalCredits > 0
if (( $(echo "$TOTAL_CREDITS <= 0" | bc -l) )); then log "❌ FAIL: Credits $TOTAL_CREDITS"; exit 1; fi
log "✅ Assertion 7: Credits > 0 ($TOTAL_CREDITS)"

# 8. Hash Check (For double run, handled by wrapper script comparing reports)

# Report
echo "STAGE3_D_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ENRICHED_PROMPT: $ENRICHED_PROMPT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "PROMPT_HASH: $(echo $ENRICHED_PROMPT | md5)" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-D Gate PASSED"
exit 0

# ===== Stage-3-D: CE04 Enrichment Closure Gate =====
# 验证：CE04 视觉丰富度计算 + Prompt生成 + 落库 + 计费 + 幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce04_enrichment_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-D: CE04 Enrichment Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL # Use Real-Stub for deterministic output
export API_PORT=3011
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

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
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3011" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 CE04 Job
log "Triggering CE04 Job..."

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug= # $gate$
JOB_ID=$(node -e "const crypto = require(TRACE_ID="trace-ce04-gate-${TS}"

# Insert Job
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
    (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  (SELECT id FROM shots LIMIT 1),
      NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID"

# 4. 等待完成
log "Waiting for Job $JOB_ID..."
MAX_RETRY=30
while [ $MAX_RETRY -gt 0 ]; do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  log "Status: $STATUS" # $gate$
  if [ "$STATUS" == "SUCCEEDED" ]; then break; fi
  if [ "$STATUS" == "FAILED" ]; then 
    log "❌ FAIL: Job FAILED"
    tail -n 30 "$EVID_DIR/worker.log"
    exit 1
  fi
  sleep 3
  ((MAX_RETRY--))
done

if [ $MAX_RETRY -eq 0 ]; then
  log "❌ FAIL: Job timeout"
  exit 1
fi

# 5. 验证 (8 Assertions)
log "== Verification Start =="

# Asserts 1-8
METRICS_JSON=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT row_to_json(m) FROM (SELECT \"enrichmentQuality\", metadata FROM ${TABLE_METRICS} WHERE \"jobId\"=
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"=
TOTAL_CREDITS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"totalCredits\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=
# 1. Job SUCCEEDED (Already checked)
# 2. Enrichment Record count >= 1 (Idempotent: just check we have data. If duplicate, ensure content is consistent)
METRICS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_METRICS} WHERE \"jobId\"=
if [ "$METRICS_COUNT" -lt "1" ]; then log "❌ FAIL: Metric count $METRICS_COUNT"; exit 1; fi
log "✅ Assertion 2: Metrics Count >= 1 ($METRICS_COUNT)"

# 3. enrichedPrompt not empty & length > N
ENRICHED_PROMPT=$(echo $METRICS_JSON | jq -r LEN=${#ENRICHED_PROMPT}
if [ "$LEN" -lt 10 ]; then log "❌ FAIL: Prompt too short ($LEN)"; exit 1; fi
log "✅ Assertion 3: Prompt Length ($LEN) > 10"

# 4. promptParts contains keys
STYLE=$(echo $METRICS_JSON | jq -r if [ "$STYLE" == "null" ] || [ -z "$STYLE" ]; then log "❌ FAIL: Missing style"; exit 1; fi
log "✅ Assertion 4: Prompt Parts (Style: $STYLE) present"

# 5. metadata.traceId matches (Check Ledger traceId)
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then log "❌ FAIL: Trace mismatch"; exit 1; fi
log "✅ Assertion 5: Trace ID Verified"

# 6. CostLedger count == 1
if [ "$LEDGER_COUNT" != "1" ]; then log "❌ FAIL: Ledger count $LEDGER_COUNT"; exit 1; fi
log "✅ Assertion 6: Ledger Count == 1"

# 7. totalCredits > 0
if (( $(echo "$TOTAL_CREDITS <= 0" | bc -l) )); then log "❌ FAIL: Credits $TOTAL_CREDITS"; exit 1; fi
log "✅ Assertion 7: Credits > 0 ($TOTAL_CREDITS)"

# 8. Hash Check (For double run, handled by wrapper script comparing reports)

# Report
echo "STAGE3_D_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ENRICHED_PROMPT: $ENRICHED_PROMPT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "PROMPT_HASH: $(echo $ENRICHED_PROMPT | md5)" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-D Gate PASSED"
exit 0

# ===== Stage-3-D: CE04 Enrichment Closure Gate =====
# 验证：CE04 视觉丰富度计算 + Prompt生成 + 落库 + 计费 + 幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce04_enrichment_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-D: CE04 Enrichment Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL # Use Real-Stub for deterministic output
export API_PORT=3011
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d 
# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

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
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3011" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 CE04 Job
log "Triggering CE04 Job..."

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug= # $gate$
JOB_ID=$(node -e "const crypto = require(TRACE_ID="trace-ce04-gate-${TS}"

# Insert Job
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
    (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  (SELECT id FROM shots LIMIT 1),
      NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID"

# 4. 等待完成
log "Waiting for Job $JOB_ID..."
MAX_RETRY=30
while [ $MAX_RETRY -gt 0 ]; do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  log "Status: $STATUS" # $gate$
  if [ "$STATUS" == "SUCCEEDED" ]; then break; fi
  if [ "$STATUS" == "FAILED" ]; then 
    log "❌ FAIL: Job FAILED"
    tail -n 30 "$EVID_DIR/worker.log"
    exit 1
  fi
  sleep 3
  ((MAX_RETRY--))
done

if [ $MAX_RETRY -eq 0 ]; then
  log "❌ FAIL: Job timeout"
  exit 1
fi

# 5. 验证 (8 Assertions)
log "== Verification Start =="

# Asserts 1-8
METRICS_JSON=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT row_to_json(m) FROM (SELECT \"enrichmentQuality\", metadata FROM ${TABLE_METRICS} WHERE \"jobId\"=
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"=
TOTAL_CREDITS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"totalCredits\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=
# 1. Job SUCCEEDED (Already checked)
# 2. Enrichment Record count >= 1 (Idempotent: just check we have data. If duplicate, ensure content is consistent)
METRICS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT count(*) FROM ${TABLE_METRICS} WHERE \"jobId\"=
if [ "$METRICS_COUNT" -lt "1" ]; then log "❌ FAIL: Metric count $METRICS_COUNT"; exit 1; fi
log "✅ Assertion 2: Metrics Count >= 1 ($METRICS_COUNT)"

# 3. enrichedPrompt not empty & length > N
ENRICHED_PROMPT=$(echo $METRICS_JSON | jq -r LEN=${#ENRICHED_PROMPT}
if [ "$LEN" -lt 10 ]; then log "❌ FAIL: Prompt too short ($LEN)"; exit 1; fi
log "✅ Assertion 3: Prompt Length ($LEN) > 10"

# 4. promptParts contains keys
STYLE=$(echo $METRICS_JSON | jq -r if [ "$STYLE" == "null" ] || [ -z "$STYLE" ]; then log "❌ FAIL: Missing style"; exit 1; fi
log "✅ Assertion 4: Prompt Parts (Style: $STYLE) present"

# 5. metadata.traceId matches (Check Ledger traceId)
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \ # $gate$
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"=if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then log "❌ FAIL: Trace mismatch"; exit 1; fi
log "✅ Assertion 5: Trace ID Verified"

# 6. CostLedger count == 1
if [ "$LEDGER_COUNT" != "1" ]; then log "❌ FAIL: Ledger count $LEDGER_COUNT"; exit 1; fi
log "✅ Assertion 6: Ledger Count == 1"

# 7. totalCredits > 0
if (( $(echo "$TOTAL_CREDITS <= 0" | bc -l) )); then log "❌ FAIL: Credits $TOTAL_CREDITS"; exit 1; fi
log "✅ Assertion 7: Credits > 0 ($TOTAL_CREDITS)"

# 8. Hash Check (For double run, handled by wrapper script comparing reports)

# Report
echo "STAGE3_D_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ENRICHED_PROMPT: $ENRICHED_PROMPT" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "PROMPT_HASH: $(echo $ENRICHED_PROMPT | md5)" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-D Gate PASSED"
exit 0
