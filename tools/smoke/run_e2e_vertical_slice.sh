#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting E2E Vertical Slice Verification (RC1)..."

# Config
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu?schema=public}"
export WORKER_API_KEY="${WORKER_API_KEY:-ak_e2e_test_key_001}"
export WORKER_API_SECRET="${WORKER_API_SECRET:-sk_e2e_test_secret_001_plain_text}"

echo "API_BASE_URL=$API_BASE_URL"
echo "DATABASE_URL=$DATABASE_URL"
echo "WORKER_API_KEY=$WORKER_API_KEY"

# Dependency checks
if ! nc -z localhost 5432; then
  echo "❌ DB not reachable at localhost:5432"
  exit 1
fi

echo "🧹 Pre-flight Cleanup: Killing potential zombie processes from previous run..."
# Kill by port 3000 (API) ensuring it's free. This is safe (port conflict is fatal anyway).
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# For Workers, we rely on previous script's cleanup. 
# If zombie workers exist, they might steal jobs, but `pkill -f node` is too aggressive.
# We trust `kill 0` or PID tracking from now on.

# Wait for ports to be freed
echo "⏳ Waiting for ports to release..."
sleep 2

echo "🌱 Seeding E2E Data..."
# Seeding scripts are short-lived, safe to kill if stuck?
# Actually, let's just run them.
# Seed API Key first
API_KEY=$WORKER_API_KEY API_SECRET=$WORKER_API_SECRET pnpm -w exec ts-node tools/smoke/init_api_key.ts

# Seed E2E Data (Project, NovelSource)
pnpm -w exec ts-node tools/smoke/seed_e2e_data.ts


# Start API (复用 start_api.sh 体系,确保环境一致性)
echo "🚀 Starting API via start_api.sh..."
# 确保必需环境变量已导出
export JWT_SECRET="${JWT_SECRET:?JWT_SECRET required}"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export IGNORE_ENV_FILE="${IGNORE_ENV_FILE:-true}"

# 调用统一启动脚本
bash tools/smoke/start_api.sh

# 读取PID
if [ -f /tmp/scu_api_smoke.pid ]; then
  API_PID=$(cat /tmp/scu_api_smoke.pid)
  echo "API PID: $API_PID"
else
  echo "❌ API PID file not found"
  exit 1
fi

cleanup() {
  echo "🧹 Cleanup..."
  # Prioritize killing captured PIDs
  if [ -n "${WORKER_PID:-}" ]; then 
    echo "Killing Worker PID: $WORKER_PID"
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
  if [ -n "${API_PID:-}" ]; then 
    echo "Killing API PID: $API_PID"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  
  # LSOF fallback for API port
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ Waiting for API (localhost:3000)..."
API_READY=false
for i in {1..60}; do
  if nc -z localhost 3000; then
    echo "✅ API is up!"
    API_READY=true
    break
  fi
  sleep 1
done

if [ "$API_READY" = "false" ]; then
  echo "❌ API failed to start in 60s"
  echo "📋 API Log Tail:"
  tail -n 20 api.log || true
  exit 1
fi

# Start worker (Single Process, No Loop)
echo "🚀 Starting Worker (Single Process)..."
: > worker.log
pnpm -w --filter @scu/worker dev >> worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

# E2E Worker 治理: Worker 健康检查
echo "⏳ Waiting 5s for Worker to initialize..."
sleep 5

if ! ps -p $WORKER_PID > /dev/null 2>&1; then
  echo "❌ Worker process died immediately!"
  echo "📋 Worker Log Tail (first 50 lines):"
  head -n 50 worker.log || true
  exit 1
fi

echo "✅ Worker process is running (PID: $WORKER_PID)"
echo "⏳ Waiting additional 10s for Worker to connect to API..."
sleep 10

# Run E2E verify (THIS is the source of truth)
echo "🧪 Running e2e_verify.ts ..."
set +e
npx ts-node tools/smoke/e2e_verify.ts
E2E_EXIT_CODE=$?
set -e

if [ $E2E_EXIT_CODE -eq 0 ]; then
  echo "✅ E2E Verification Passed!"
else
  echo "❌ E2E Verification Failed! exit=$E2E_EXIT_CODE"
  
  # E2E Worker 治理: 提取 JobId 并查询状态
  echo "🔍 Searching for Job ID in logs..."
  JOB_ID=$(grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' worker.log | head -n 1 || echo "UNKNOWN")
  
  if [ "$JOB_ID" != "UNKNOWN" ]; then
    echo "🔍 Found Job ID: $JOB_ID"
    echo "📋 Query Job Status:"
    echo "   curl -s $"{API_BASE_URL}/jobs/$JOB_ID""
    # 尝试查询 Job 状态(可能失败,非强制)
    curl -s "${API_BASE_URL}/jobs/$JOB_ID" 2>/dev/null | head -n 30 || echo "(Failed to query job status)"
  fi
  
  # E2E Worker 治理: Grep 关键错误
  echo "🔍 Searching for Worker errors..."
  grep -iE "error|exception|failed|timeout" worker.log | tail -n 20 || echo "No obvious errors found in worker log"
  
  echo "📋 Worker Log Tail:"
  tail -n 80 worker.log || true
  echo "📋 API Log Tail:"
  if [ -f /tmp/scu_api_smoke_last.logpath ]; then
    API_LOG_PATH=$(cat /tmp/scu_api_smoke_last.logpath)
    tail -n 20 "$API_LOG_PATH" || true
  else
    echo "(API log path not found)"
  fi
fi

# Cleanup ensures we don't leave zombie processes
cleanup

exit $E2E_EXIT_CODE
