#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

export API_PORT=3011export PORT=$API_PORT

# gate-ce06-story-parse-real.sh
# 验证：
# 1. API HMAC v1.1 握手与 Nonce 防重放 (4004/403)
# 2. 真·CE06 Processor 小说解析 -> DB Upsert
# 3. 计费 (Credits) 与审计 (AuditLog)
# 4. 幂等性：同一原文重复提交不额外扣费

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/ce06_story_parse_${TS}"
mkdir -p "$EVID_DIR"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "Starting Commercial CE06 Real Engine Gate..."

# 1. 环境准备
export API_PORT=3011
export WORKER_PORT=3012
export STAGE3_ENGINE_MODE=REPLAY # 确定性模式

# 清理
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

# 2. 准备 API Key
log "Initializing Test API Key..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1)
export API_KEY=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2)
export API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2)

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log "FATAL: Failed to init API Key."
    echo "$INIT_OUT"
    exit 1
fi
log "Using API_KEY: ${API_KEY:0:4}... API_SECRET: ${API_SECRET:0:4}..."

# 3. 编译并启动服务
log "Rebuilding API..."
pnpm --filter api build

log "Starting API & Worker..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# 启动 Worker (支持 CE06)
STAGE3_ENGINE_MODE=REPLAY API_URL="http://127.0.0.1:3011" WORKER_SUPPORTED_ENGINES="ce06_novel_parsing" WORKER_API_KEY="$API_KEY" WORKER_API_SECRET="$API_SECRET" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 4. 运行 Gate Runner (TypeScript)
log "Running CE06 Gate Runner..."
export API_BASE_URL="http://127.0.0.1:3011"
npx ts-node -P tsconfig.json -r tsconfig-paths/register tools/gate/gates/ce06_gate_runner.ts 2>&1 | tee -a "$EVID_DIR/runner.log"

# 5. 检查结果
if grep -q "ALL COMMERCIAL GATE TESTS PASSED" "$EVID_DIR/runner.log"; then
    log "✅ CE06 Commercial Gate Passed."
else
    log "❌ CE06 Commercial Gate FAILED. check $EVID_DIR/runner.log"
    kill $API_PID || true
    kill $WORKER_PID || true
    exit 1
fi

# 6. 清理
kill $API_PID || true
kill $WORKER_PID || true

log "Gate Finalized."
exit 0

# gate-ce06-story-parse-real.sh
# 验证：
# 1. API HMAC v1.1 握手与 Nonce 防重放 (4004/403)
# 2. 真·CE06 Processor 小说解析 -> DB Upsert
# 3. 计费 (Credits) 与审计 (AuditLog)
# 4. 幂等性：同一原文重复提交不额外扣费

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/ce06_story_parse_${TS}"
mkdir -p "$EVID_DIR"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "Starting Commercial CE06 Real Engine Gate..."

# 1. 环境准备
export API_PORT=3011
export WORKER_PORT=3012
export STAGE3_ENGINE_MODE=REPLAY # 确定性模式

# 清理
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

# 2. 准备 API Key
log "Initializing Test API Key..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1)
export API_KEY=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2)
export API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2)

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log "FATAL: Failed to init API Key."
    echo "$INIT_OUT"
    exit 1
fi
log "Using API_KEY: ${API_KEY:0:4}... API_SECRET: ${API_SECRET:0:4}..."

# 3. 编译并启动服务
log "Rebuilding API..."
pnpm --filter api build

log "Starting API & Worker..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# 启动 Worker (支持 CE06)
STAGE3_ENGINE_MODE=REPLAY API_URL="http://127.0.0.1:3011" WORKER_SUPPORTED_ENGINES="ce06_novel_parsing" WORKER_API_KEY="$API_KEY" WORKER_API_SECRET="$API_SECRET" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 4. 运行 Gate Runner (TypeScript)
log "Running CE06 Gate Runner..."
export API_BASE_URL="http://127.0.0.1:3011"
npx ts-node -P tsconfig.json -r tsconfig-paths/register tools/gate/gates/ce06_gate_runner.ts 2>&1 | tee -a "$EVID_DIR/runner.log"

# 5. 检查结果
if grep -q "ALL COMMERCIAL GATE TESTS PASSED" "$EVID_DIR/runner.log"; then
    log "✅ CE06 Commercial Gate Passed."
else
    log "❌ CE06 Commercial Gate FAILED. check $EVID_DIR/runner.log"
    kill $API_PID || true
    kill $WORKER_PID || true
    exit 1
fi

# 6. 清理
kill $API_PID || true
kill $WORKER_PID || true

log "Gate Finalized."
exit 0

# gate-ce06-story-parse-real.sh
# 验证：
# 1. API HMAC v1.1 握手与 Nonce 防重放 (4004/403)
# 2. 真·CE06 Processor 小说解析 -> DB Upsert
# 3. 计费 (Credits) 与审计 (AuditLog)
# 4. 幂等性：同一原文重复提交不额外扣费

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/ce06_story_parse_${TS}"
mkdir -p "$EVID_DIR"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "Starting Commercial CE06 Real Engine Gate..."

# 1. 环境准备
export API_PORT=3011
export WORKER_PORT=3012
export STAGE3_ENGINE_MODE=REPLAY # 确定性模式

# 清理
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

# 2. 准备 API Key
log "Initializing Test API Key..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1)
export API_KEY=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2)
export API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2)

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log "FATAL: Failed to init API Key."
    echo "$INIT_OUT"
    exit 1
fi
log "Using API_KEY: ${API_KEY:0:4}... API_SECRET: ${API_SECRET:0:4}..."

# 3. 编译并启动服务
log "Rebuilding API..."
pnpm --filter api build

log "Starting API & Worker..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# 启动 Worker (支持 CE06)
STAGE3_ENGINE_MODE=REPLAY API_URL="http://127.0.0.1:3011" WORKER_SUPPORTED_ENGINES="ce06_novel_parsing" WORKER_API_KEY="$API_KEY" WORKER_API_SECRET="$API_SECRET" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 4. 运行 Gate Runner (TypeScript)
log "Running CE06 Gate Runner..."
export API_BASE_URL="http://127.0.0.1:3011"
npx ts-node -P tsconfig.json -r tsconfig-paths/register tools/gate/gates/ce06_gate_runner.ts 2>&1 | tee -a "$EVID_DIR/runner.log"

# 5. 检查结果
if grep -q "ALL COMMERCIAL GATE TESTS PASSED" "$EVID_DIR/runner.log"; then
    log "✅ CE06 Commercial Gate Passed."
else
    log "❌ CE06 Commercial Gate FAILED. check $EVID_DIR/runner.log"
    kill $API_PID || true
    kill $WORKER_PID || true
    exit 1
fi

# 6. 清理
kill $API_PID || true
kill $WORKER_PID || true

log "Gate Finalized."
exit 0

# gate-ce06-story-parse-real.sh
# 验证：
# 1. API HMAC v1.1 握手与 Nonce 防重放 (4004/403)
# 2. 真·CE06 Processor 小说解析 -> DB Upsert
# 3. 计费 (Credits) 与审计 (AuditLog)
# 4. 幂等性：同一原文重复提交不额外扣费

TS=$(date +%Y%m%d_%H%M%S)
EVID_DIR="docs/_evidence/ce06_story_parse_${TS}"
mkdir -p "$EVID_DIR"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "Starting Commercial CE06 Real Engine Gate..."

# 1. 环境准备
export API_PORT=3011
export WORKER_PORT=3012
export STAGE3_ENGINE_MODE=REPLAY # 确定性模式

# 清理
pkill -9 -f "api/dist/main" || true
pkill -9 -f "workers/src/main" || true
lsof -t -i :3011 | xargs kill -9 2>/dev/null || true

# 2. 准备 API Key
log "Initializing Test API Key..."
INIT_OUT=$(npx ts-node -P apps/api/tsconfig.json tools/smoke/init_api_key.ts 2>&1)
export API_KEY=$(echo "$INIT_OUT" | grep "API_KEY=" | cut -d= -f2)
export API_SECRET=$(echo "$INIT_OUT" | grep "API_SECRET=" | cut -d= -f2)

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
    log "FATAL: Failed to init API Key."
    echo "$INIT_OUT"
    exit 1
fi
log "Using API_KEY: ${API_KEY:0:4}... API_SECRET: ${API_SECRET:0:4}..."

# 3. 编译并启动服务
log "Rebuilding API..."
pnpm --filter api build

log "Starting API & Worker..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# 启动 Worker (支持 CE06)
STAGE3_ENGINE_MODE=REPLAY API_URL="http://127.0.0.1:3011" WORKER_SUPPORTED_ENGINES="ce06_novel_parsing" WORKER_API_KEY="$API_KEY" WORKER_API_SECRET="$API_SECRET" npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register apps/workers/src/main.ts > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 10

# 4. 运行 Gate Runner (TypeScript)
log "Running CE06 Gate Runner..."
export API_BASE_URL="http://127.0.0.1:3011"
npx ts-node -P tsconfig.json -r tsconfig-paths/register tools/gate/gates/ce06_gate_runner.ts 2>&1 | tee -a "$EVID_DIR/runner.log"

# 5. 检查结果
if grep -q "ALL COMMERCIAL GATE TESTS PASSED" "$EVID_DIR/runner.log"; then
    log "✅ CE06 Commercial Gate Passed."
else
    log "❌ CE06 Commercial Gate FAILED. check $EVID_DIR/runner.log"
    kill $API_PID || true
    kill $WORKER_PID || true
    exit 1
fi

# 6. 清理
kill $API_PID || true
kill $WORKER_PID || true

log "Gate Finalized."
exit 0
