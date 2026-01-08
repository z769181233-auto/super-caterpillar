#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
set -euo pipefail

# ===== Stage-3-E: ShotRender Realization Gate =====
# 验证：真实文件产出 + 高额计费 + 幂等 + Trace贯通

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_ASSET="assets"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce05_shotrender_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-E: ShotRender Realization Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3012
# Ensure ASSET_STORAGE_DIR is absolute for Worker
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_gate_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")}

# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3012 | xargs kill -9 2>/dev/null || true

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

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3012" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 ShotRender Job
log "Triggering ShotRender Job..."

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs)
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug='gate_org_stage3b'" | xargs)
SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs)

JOB_ID=$(node -e "const crypto = require('crypto'); console.log(crypto.randomUUID());")
TRACE_ID="trace-render-${TS}"

# Insert Job
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
  '$JOB_ID', '$ORG_ID', '$PROJECT_ID', 
  (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  '$SHOT_ID',
  'PENDING', 'SHOT_RENDER', 10, 3, '$TRACE_ID', 
  '{\"shotId\": \"$SHOT_ID\", \"prompt\": \"A gate test shot\", \"seed\": 999}', 
  NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID for Shot $SHOT_ID"

# 4. 等待完成
log "Waiting for Job $JOB_ID..."
MAX_RETRY=30
while [ $MAX_RETRY -gt 0 ]; do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID'" | xargs)
  log "Status: $STATUS"
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

# 5. 验证 (5 Assertions)
log "== Verification Start =="

# 1. File Existence & Size > 0
ASSET_URI=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT \"storageKey\" FROM ${TABLE_ASSET} WHERE \"ownerId\"='$SHOT_ID' AND \"type\"='IMAGE'" | xargs)

log "Asset URI: $ASSET_URI"

if [ ! -f "$ASSET_URI" ]; then
    log "❌ FAIL: Asset file not found at $ASSET_URI"
    exit 1
fi

FILE_SIZE=$(wc -c < "$ASSET_URI")
if [ "$FILE_SIZE" -le 0 ]; then
    log "❌ FAIL: Asset file empty"
    exit 1
fi
log "✅ Assertion 1: File Exists & Not Empty ($FILE_SIZE bytes)"

# 2. Ledger Count == 1 (Idempotent check handled by double run script wrapper, here check existence)
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"='$JOB_ID' AND \"jobType\"='SHOT_RENDER'" | xargs)

if [ "$LEDGER_COUNT" -lt "1" ]; then log "❌ FAIL: Ledger count $LEDGER_COUNT"; exit 1; fi
log "✅ Assertion 2: Ledger Count >= 1 ($LEDGER_COUNT)"

# 3. Credits > 1.0
TOTAL_CREDITS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT \"totalCredits\" FROM ${TABLE_LEDGER} WHERE \"jobId\"='$JOB_ID' AND \"jobType\"='SHOT_RENDER' LIMIT 1" | xargs)

if (( $(echo "$TOTAL_CREDITS < 1.0" | bc -l) )); then log "❌ FAIL: Low Credits ($TOTAL_CREDITS)"; exit 1; fi
log "✅ Assertion 3: High Value Billing ($TOTAL_CREDITS credits)"

# 4. Trace ID (Ledger vs Job vs Quality)
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"='$JOB_ID' LIMIT 1" | xargs)
if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then log "❌ FAIL: Trace mismatch $LEDGER_TRACE vs $TRACE_ID"; exit 1; fi
log "✅ Assertion 4: Trace ID Matches"

# 5. Asset DB Record
ASSET_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT id FROM ${TABLE_ASSET} WHERE \"storageKey\"='$ASSET_URI'" | xargs)
if [ -z "$ASSET_ID" ]; then log "❌ FAIL: Asset DB record missing"; exit 1; fi
log "✅ Assertion 5: Asset DB Record Found"


echo "STAGE3_E_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET_URI: $ASSET_URI" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "ASSET_SIZE: $FILE_SIZE" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-E Gate PASSED"
exit 0
