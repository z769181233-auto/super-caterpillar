#!/bin/bash
source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
set -euo pipefail

# ===== Stage-3-C: CE03 Density Closure Gate =====
# 验证：CE03 视觉密度计算 + 落库(QualityMetrics) + 计费(CostLedger) + 幂等

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/stage3_ce03_density_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 Stage-3-C: CE03 Density Closure Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REPLAY
export API_PORT=3011
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")}

# 清理进程
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

# 1.3 Sync DB Schema
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss)

# 1.5 自举：复用 gate_seed.ts 确保基础数据
log "== Bootstrap base data via gate_seed.ts =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts 2>&1 | tee -a "$EVID_DIR/seed.log" || {
  log "❌ FAIL: gate_seed.ts failed. Check $EVID_DIR/seed.log"
  exit 1
}

log "✅ Seed done."

# 2. 启动 API & Worker
log "Starting API & Worker..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REPLAY API_URL="http://127.0.0.1:3011" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,default_novel_analysis,ce03_visual_density" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 3. 触发 CE03 Job
# 我们需要一个 Shot Job，类型为 CE03_VISUAL_DENSITY。
# 由于没有现成的 trigger 脚本，我们手动构造一个。
# 复用 gate_seed 中的 projectId/userId/orgId

log "Triggering CE03 Job..."

# Get Project ID
PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs)
USER_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM users WHERE email='gate_user@local'" | xargs)
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations WHERE slug='gate_org_stage3b'" | xargs)

# Create a Shot Job for CE03
JOB_ID=$(node -e "
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  console.log(id);
")

TRACE_ID="trace-ce03-gate-${TS}"

# Insert Job into DB
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\",
  status, type, priority, \"maxRetry\", \"traceId\", payload, \"createdAt\", \"updatedAt\"
) VALUES (
  '$JOB_ID', '$ORG_ID', '$PROJECT_ID', 
  (SELECT id FROM episodes LIMIT 1), 
  (SELECT id FROM scenes LIMIT 1), 
  (SELECT id FROM shots LIMIT 1),
  'PENDING', 'CE03_VISUAL_DENSITY', 10, 3, '$TRACE_ID', 
  '{\"structured_text\": \"[\\\"Test Scene for Density\\\"]\"}', 
  NOW(), NOW()
);
" > /dev/null

log "✅ Job Created: $JOB_ID"

# 4. 等待任务完成
log "Waiting for Job $JOB_ID to succeed..."
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

# 5. 验证
log "== Verification Start =="

# 5.1 QualityMetrics Density Score > 0
log "Check #1: Density Score > 0"
SCORE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT \"visualDensityScore\" FROM ${TABLE_METRICS} WHERE \"jobId\"='$JOB_ID' LIMIT 1" | xargs)

if (( $(echo "$SCORE > 0" | bc -l) )); then
  log "✅ Score Check PASS: $SCORE"
else
  log "❌ FAIL: Invalid Score: $SCORE"
  exit 1
fi

# 5.2 Ledger Row Count == 1
log "Check #2: Ledger row count == 1"
LEDGER_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT count(*) FROM ${TABLE_LEDGER} WHERE \"jobId\"='$JOB_ID' AND \"jobType\"='CE03_VISUAL_DENSITY'" | xargs)

if [ "$LEDGER_COUNT" != "1" ]; then
  log "❌ FAIL: Expected 1 ledger record, got $LEDGER_COUNT"
  exit 1
fi

# 5.3 Trace ID
log "Check #3: Trace ID"
LEDGER_TRACE=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c \
  "SELECT \"traceId\" FROM ${TABLE_LEDGER} WHERE \"jobId\"='$JOB_ID'" | xargs)

if [ "$LEDGER_TRACE" != "$TRACE_ID" ]; then
  log "❌ FAIL: Trace mismatch. Got $LEDGER_TRACE, expected $TRACE_ID"
  exit 1
fi

# Generate Report
echo "STAGE3_C_STATUS: PASSED" > "$EVID_DIR/FINAL_REPORT.txt"
echo "JOB_ID: $JOB_ID" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "DENSITY_SCORE: $SCORE" >> "$EVID_DIR/FINAL_REPORT.txt"
echo "GATE_VERSION: 1.0" >> "$EVID_DIR/FINAL_REPORT.txt"

log "✅ Stage-3-C Gate PASSED"
exit 0
