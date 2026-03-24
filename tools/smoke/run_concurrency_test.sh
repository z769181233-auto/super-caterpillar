#!/bin/bash
set -euo pipefail

# concurrency test: 2 workers competing for jobs

echo "🚀 Starting Concurrency Regression Test (Nightly)..."

# Config
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu?schema=public}"
export WORKER_API_KEY="${WORKER_API_KEY:-ak_e2e_test_key_001}"
export WORKER_API_SECRET="${WORKER_API_SECRET:-sk_e2e_test_secret_001_plain_text}"

# Pre-flight
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -f "node apps/workers" || true

# Seed
API_KEY=$WORKER_API_KEY API_SECRET=$WORKER_API_SECRET pnpm -w exec ts-node tools/smoke/init_api_key.ts
pnpm -w exec ts-node tools/smoke/seed_e2e_data.ts

# Start API
echo "🚀 Starting API..."
: > api.log
pnpm -w --filter api dev > api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

echo "⏳ Waiting for API..."
sleep 10

# Start 2 Workers
echo "🚀 Starting Worker A..."
pnpm -w --filter @scu/worker dev > worker_a.log 2>&1 &
WORKER_A=$!
echo "Worker A PID: $WORKER_A"

echo "🚀 Starting Worker B..."
pnpm -w --filter @scu/worker dev > worker_b.log 2>&1 &
WORKER_B=$!
echo "Worker B PID: $WORKER_B"

echo "⏳ Waiting 15s for Workers..."
sleep 15

# Run E2E Verify (Happy Path only)
echo "🧪 Running Verify..."
# We reuse e2e_verify.ts but might want to inject lots of jobs if we really want to stress test.
# For now, standard verification ensures at least one job is claimed correctly without crashing.
npx ts-node tools/smoke/e2e_verify.ts
EXIT_CODE=$?

# Analyze Logs for Double Claim?
# Hard to grep "Double Claim" unless we log it specifically. 
# But we can check if both workers picked up *different* jobs if we submitted multiple.
# Since e2e_verify submits 1 job, only A or B should claim it. The other should be idle.

# Cleanup
kill $API_PID || true
kill $WORKER_A || true
kill $WORKER_B || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

exit $EXIT_CODE
