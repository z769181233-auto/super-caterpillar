#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting Video E2E Verification..."

# Config
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu?schema=public}"
export WORKER_API_KEY="${WORKER_API_KEY:-ak_e2e_test_key_001}"
export WORKER_API_SECRET="${WORKER_API_SECRET:-sk_e2e_test_secret_001_plain_text}"
export JOB_WORKER_ENABLED="true"

# Cleanup function
cleanup() {
  echo "🧹 Cleanup..."
  if [ -n "${WORKER_PID:-}" ]; then 
    echo "Killing Worker PID: $WORKER_PID"
    kill "$WORKER_PID" 2>/dev/null || true
  fi
  if [ -n "${API_PID:-}" ]; then 
    echo "Killing API PID: $API_PID"
    kill "$API_PID" 2>/dev/null || true
  fi
  # Safe kill port 3000
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# 1. Cleanup before start
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 2. Seed Data
echo "🌱 Seeding API Key..."
API_KEY=$WORKER_API_KEY API_SECRET=$WORKER_API_SECRET pnpm -w exec ts-node tools/smoke/init_api_key.ts

# 3. Start API
echo "🚀 Starting API..."
: > api_video.log
pnpm -w --filter api dev > api_video.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

echo "⏳ Waiting for API..."
for i in {1..60}; do
  if nc -z localhost 3000; then
    echo "✅ API is up!"
    break
  fi
  sleep 1
done

if ! nc -z localhost 3000; then
  echo "❌ API failed to start"
  tail -n 20 api_video.log
  exit 1
fi

# 4. Start Worker
echo "🚀 Starting Worker..."
: > worker_video.log
pnpm -w --filter @scu/worker dev >> worker_video.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

echo "⏳ Waiting 10s for Worker..."
sleep 10

# 5. Run Video E2E Script
echo "🧪 Running run_video_e2e.sh..."
chmod +x tools/smoke/run_video_e2e.sh
./tools/smoke/run_video_e2e.sh

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Video E2E Success!"
else
  echo "❌ Video E2E Failed!"
  echo "📋 Worker Log Tail:"
  tail -n 50 worker_video.log
  echo "📋 API Log Tail:"
  tail -n 20 api_video.log
fi

exit $EXIT_CODE
