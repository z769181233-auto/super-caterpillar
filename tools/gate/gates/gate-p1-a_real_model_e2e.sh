#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"# ===== P1-A: Real Model E2E Gate =====
# 验证：真实模型路由 (Router 2.0) + Gemini/SDXL/Flux 适配器 + 质量分上报

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_QUALITY="quality_scores"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/p1_a_real_model_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 P1-A: Real Model E2E Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3113

# 清理进程
log "Cleaning up existing processes on port 3113..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3113 | xargs kill -9 2>/dev/null || true
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_p1a_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

# 1.3 Sync DB 
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss > /dev/null)

# 1.5 Seeding
log "== Bootstrap base data =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts > /dev/null

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3113 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3113" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations LIMIT 1" | xargs) # $gate$
EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$

# 我们运行两个 ShotRender 任务，一个用 SDXL (默认)，一个用 Flux (高质量要求)
JOB_ID_CE04="p1a-ce04-${TS}"
JOB_ID_SDXL="p1a-sdxl-${TS}"
JOB_ID_FLUX="p1a-flux-${TS}"

log "Inserting P1-A Jobs..."
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
  INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
  (  (  (" > /dev/null

wait_for_job() {
  local JID=$1
  log "Waiting for $JID..."
  for i in {1..30}; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "❌ FAIL: $JID FAILED"; exit 1; fi
    sleep 2
  done
  log "❌ FAIL: $JID Timeout"; exit 1
}

wait_for_job "$JOB_ID_CE04"
wait_for_job "$JOB_ID_SDXL"
wait_for_job "$JOB_ID_FLUX"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. 验证 CE04 -> Gemini
CE04_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->if [ "$CE04_MODEL" != "gemini-2.0-flash" ]; then # $gate$
  log "❌ FAIL: CE04 Model Mismatch ($CE04_MODEL)"
  exit 1
fi
log "✅ CE04 Model: $CE04_MODEL"

# 2. 验证 QualityScore/QualityMetrics (由 Gemini Adapter 写入)
QS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM quality_metrics WHERE \"jobId\"=if [ "$QS_COUNT" -lt 1 ]; then # $gate$
  log "❌ FAIL: QualityMetrics (CE04) not found for $JOB_ID_CE04"
  exit 1
fi
log "✅ QualityMetrics (CE04) Entry Found: $QS_COUNT"

# 3. 验证 SDXL 路由
SDXL_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$SDXL_MODEL" != "sdxl-v1.5-real" ]; then # $gate$
  log "❌ FAIL: SDXL Model Mismatch ($SDXL_MODEL)"
  exit 1
fi
log "✅ SDXL Route: Success"

# 4. 验证 Flux 路由
FLUX_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Flux Model Mismatch ($FLUX_MODEL)"
  exit 1
fi
log "✅ Flux Route: Success"

# 5. 验证计费幂等/模型标识
FLUX_LEDGER_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_LEDGER_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Ledger Model Mismatch ($FLUX_LEDGER_MODEL)"
  exit 1
fi
log "✅ Ledger Flow: Success"

# Cleanup
kill $API_PID $WORKER_PID || true

log "🎉 P1-A: Real Model E2E Gate PASSED"
exit 0

# ===== P1-A: Real Model E2E Gate =====
# 验证：真实模型路由 (Router 2.0) + Gemini/SDXL/Flux 适配器 + 质量分上报

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_QUALITY="quality_scores"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/p1_a_real_model_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 P1-A: Real Model E2E Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3113

# 清理进程
log "Cleaning up existing processes on port 3113..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3113 | xargs kill -9 2>/dev/null || true
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_p1a_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

# 1.3 Sync DB 
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss > /dev/null)

# 1.5 Seeding
log "== Bootstrap base data =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts > /dev/null

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3113 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3113" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations LIMIT 1" | xargs) # $gate$
EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$

# 我们运行两个 ShotRender 任务，一个用 SDXL (默认)，一个用 Flux (高质量要求)
JOB_ID_CE04="p1a-ce04-${TS}"
JOB_ID_SDXL="p1a-sdxl-${TS}"
JOB_ID_FLUX="p1a-flux-${TS}"

log "Inserting P1-A Jobs..."
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
  INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
  (  (  (" > /dev/null

wait_for_job() {
  local JID=$1
  log "Waiting for $JID..."
  for i in {1..30}; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "❌ FAIL: $JID FAILED"; exit 1; fi
    sleep 2
  done
  log "❌ FAIL: $JID Timeout"; exit 1
}

wait_for_job "$JOB_ID_CE04"
wait_for_job "$JOB_ID_SDXL"
wait_for_job "$JOB_ID_FLUX"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. 验证 CE04 -> Gemini
CE04_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->if [ "$CE04_MODEL" != "gemini-2.0-flash" ]; then # $gate$
  log "❌ FAIL: CE04 Model Mismatch ($CE04_MODEL)"
  exit 1
fi
log "✅ CE04 Model: $CE04_MODEL"

# 2. 验证 QualityScore/QualityMetrics (由 Gemini Adapter 写入)
QS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM quality_metrics WHERE \"jobId\"=if [ "$QS_COUNT" -lt 1 ]; then # $gate$
  log "❌ FAIL: QualityMetrics (CE04) not found for $JOB_ID_CE04"
  exit 1
fi
log "✅ QualityMetrics (CE04) Entry Found: $QS_COUNT"

# 3. 验证 SDXL 路由
SDXL_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$SDXL_MODEL" != "sdxl-v1.5-real" ]; then # $gate$
  log "❌ FAIL: SDXL Model Mismatch ($SDXL_MODEL)"
  exit 1
fi
log "✅ SDXL Route: Success"

# 4. 验证 Flux 路由
FLUX_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Flux Model Mismatch ($FLUX_MODEL)"
  exit 1
fi
log "✅ Flux Route: Success"

# 5. 验证计费幂等/模型标识
FLUX_LEDGER_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_LEDGER_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Ledger Model Mismatch ($FLUX_LEDGER_MODEL)"
  exit 1
fi
log "✅ Ledger Flow: Success"

# Cleanup
kill $API_PID $WORKER_PID || true

log "🎉 P1-A: Real Model E2E Gate PASSED"
exit 0

# ===== P1-A: Real Model E2E Gate =====
# 验证：真实模型路由 (Router 2.0) + Gemini/SDXL/Flux 适配器 + 质量分上报

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_QUALITY="quality_scores"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/p1_a_real_model_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 P1-A: Real Model E2E Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3113

# 清理进程
log "Cleaning up existing processes on port 3113..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3113 | xargs kill -9 2>/dev/null || true
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_p1a_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

# 1.3 Sync DB 
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss > /dev/null)

# 1.5 Seeding
log "== Bootstrap base data =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts > /dev/null

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3113 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3113" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations LIMIT 1" | xargs) # $gate$
EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$

# 我们运行两个 ShotRender 任务，一个用 SDXL (默认)，一个用 Flux (高质量要求)
JOB_ID_CE04="p1a-ce04-${TS}"
JOB_ID_SDXL="p1a-sdxl-${TS}"
JOB_ID_FLUX="p1a-flux-${TS}"

log "Inserting P1-A Jobs..."
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
  INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
  (  (  (" > /dev/null

wait_for_job() {
  local JID=$1
  log "Waiting for $JID..."
  for i in {1..30}; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "❌ FAIL: $JID FAILED"; exit 1; fi
    sleep 2
  done
  log "❌ FAIL: $JID Timeout"; exit 1
}

wait_for_job "$JOB_ID_CE04"
wait_for_job "$JOB_ID_SDXL"
wait_for_job "$JOB_ID_FLUX"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. 验证 CE04 -> Gemini
CE04_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->if [ "$CE04_MODEL" != "gemini-2.0-flash" ]; then # $gate$
  log "❌ FAIL: CE04 Model Mismatch ($CE04_MODEL)"
  exit 1
fi
log "✅ CE04 Model: $CE04_MODEL"

# 2. 验证 QualityScore/QualityMetrics (由 Gemini Adapter 写入)
QS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM quality_metrics WHERE \"jobId\"=if [ "$QS_COUNT" -lt 1 ]; then # $gate$
  log "❌ FAIL: QualityMetrics (CE04) not found for $JOB_ID_CE04"
  exit 1
fi
log "✅ QualityMetrics (CE04) Entry Found: $QS_COUNT"

# 3. 验证 SDXL 路由
SDXL_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$SDXL_MODEL" != "sdxl-v1.5-real" ]; then # $gate$
  log "❌ FAIL: SDXL Model Mismatch ($SDXL_MODEL)"
  exit 1
fi
log "✅ SDXL Route: Success"

# 4. 验证 Flux 路由
FLUX_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Flux Model Mismatch ($FLUX_MODEL)"
  exit 1
fi
log "✅ Flux Route: Success"

# 5. 验证计费幂等/模型标识
FLUX_LEDGER_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_LEDGER_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Ledger Model Mismatch ($FLUX_LEDGER_MODEL)"
  exit 1
fi
log "✅ Ledger Flow: Success"

# Cleanup
kill $API_PID $WORKER_PID || true

log "🎉 P1-A: Real Model E2E Gate PASSED"
exit 0

# ===== P1-A: Real Model E2E Gate =====
# 验证：真实模型路由 (Router 2.0) + Gemini/SDXL/Flux 适配器 + 质量分上报

TABLE_METRICS="quality_metrics"
TABLE_LEDGER="cost_ledgers"
TABLE_QUALITY="quality_scores"

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/p1_a_real_model_${TS}"
mkdir -p "$EVID_DIR"

log() { 
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"
}

log "🚀 P1-A: Real Model E2E Gate"

# 1. 环境准备
export STAGE3_ENGINE_MODE=REAL
export API_PORT=3113

# 清理进程
log "Cleaning up existing processes on port 3113..."
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3113 | xargs kill -9 2>/dev/null || true
export ASSET_STORAGE_DIR="$(pwd)/apps/workers/.runtime/assets_p1a_${TS}"
mkdir -p "$ASSET_STORAGE_DIR"

# 1.3 Sync DB 
log "== Sync DB Schema =="
(cd packages/database && npx prisma db push --accept-data-loss > /dev/null)

# 1.5 Seeding
log "== Bootstrap base data =="
npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register tools/gate/common/gate_seed.ts > /dev/null

# 2. 启动 API & Worker
log "Starting API & Worker..."
PORT=3113 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

STAGE3_ENGINE_MODE=REAL API_URL="http://127.0.0.1:3113" \
ASSET_STORAGE_DIR="$ASSET_STORAGE_DIR" \
  WORKER_SUPPORTED_ENGINES="ce06_novel_parsing,ce03_visual_density,ce04_visual_enrichment,shot_render" \
  npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------

PROJECT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM projects LIMIT 1" | xargs) # $gate$
ORG_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM organizations LIMIT 1" | xargs) # $gate$
EPISODE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM episodes LIMIT 1" | xargs) # $gate$
SCENE_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM scenes LIMIT 1" | xargs) # $gate$
SHOT_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT id FROM shots LIMIT 1" | xargs) # $gate$

# 我们运行两个 ShotRender 任务，一个用 SDXL (默认)，一个用 Flux (高质量要求)
JOB_ID_CE04="p1a-ce04-${TS}"
JOB_ID_SDXL="p1a-sdxl-${TS}"
JOB_ID_FLUX="p1a-flux-${TS}"

log "Inserting P1-A Jobs..."
PGPASSWORD=postgres psql -h localhost -U postgres -d scu -c "
  INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", status, type, priority, \"traceId\", payload, \"createdAt\", \"updatedAt\") VALUES
  (  (  (" > /dev/null

wait_for_job() {
  local JID=$1
  log "Waiting for $JID..."
  for i in {1..30}; do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then return 0; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "❌ FAIL: $JID FAILED"; exit 1; fi
    sleep 2
  done
  log "❌ FAIL: $JID Timeout"; exit 1
}

wait_for_job "$JOB_ID_CE04"
wait_for_job "$JOB_ID_SDXL"
wait_for_job "$JOB_ID_FLUX"

# ---------------------------------------------------------
# Verification
# ---------------------------------------------------------
log "== Verification Start =="

# 1. 验证 CE04 -> Gemini
CE04_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->if [ "$CE04_MODEL" != "gemini-2.0-flash" ]; then # $gate$
  log "❌ FAIL: CE04 Model Mismatch ($CE04_MODEL)"
  exit 1
fi
log "✅ CE04 Model: $CE04_MODEL"

# 2. 验证 QualityScore/QualityMetrics (由 Gemini Adapter 写入)
QS_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT count(*) FROM quality_metrics WHERE \"jobId\"=if [ "$QS_COUNT" -lt 1 ]; then # $gate$
  log "❌ FAIL: QualityMetrics (CE04) not found for $JOB_ID_CE04"
  exit 1
fi
log "✅ QualityMetrics (CE04) Entry Found: $QS_COUNT"

# 3. 验证 SDXL 路由
SDXL_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$SDXL_MODEL" != "sdxl-v1.5-real" ]; then # $gate$
  log "❌ FAIL: SDXL Model Mismatch ($SDXL_MODEL)"
  exit 1
fi
log "✅ SDXL Route: Success"

# 4. 验证 Flux 路由
FLUX_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Flux Model Mismatch ($FLUX_MODEL)"
  exit 1
fi
log "✅ Flux Route: Success"

# 5. 验证计费幂等/模型标识
FLUX_LEDGER_MODEL=$(PGPASSWORD=postgres psql -h localhost -U postgres -d scu -t -c "SELECT \"metadata\"->>if [ "$FLUX_LEDGER_MODEL" != "flux-v1-dev" ]; then # $gate$
  log "❌ FAIL: Ledger Model Mismatch ($FLUX_LEDGER_MODEL)"
  exit 1
fi
log "✅ Ledger Flow: Success"

# Cleanup
kill $API_PID $WORKER_PID || true

log "🎉 P1-A: Real Model E2E Gate PASSED"
exit 0
