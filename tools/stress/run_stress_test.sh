#!/bin/bash
set -e

# Configuration
export PORT=3999
export API_URL="http://localhost:$PORT"
export NODE_ENV=production # Use production mode for better perf simulation
export JOB_WATCHDOG_ENABLED=true
export JOB_WATCHDOG_TIMEOUT_MS=5000 # 5s timeout for fast test
export WORKER_HEARTBEAT_TIMEOUT_MS=5000
export JWT_SECRET="stress_test_secret_must_be_long_enough_32_chars"
export JWT_REFRESH_SECRET="stress_test_refresh_secret_32_chars"
export REDIS_URL="redis://localhost:6379"
export CORS_ORIGINS="*"
export API_PORT=3999
export NODE_ENV=test
export DATABASE_URL=${DATABASE_URL:-"postgres://postgres:password@127.0.0.1:5432/scu_dev"} # Default fallback

echo "=== Staging Stress Test Pipeline ==="

# 1. Build API (Ensure we are running latest code)
echo "[1/4] Building API..."
pnpm --filter api build

# 2. Start API in Background
echo "[2/4] Starting API on port $PORT..."
(cd apps/api && node dist/main) > api_stress.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

# Wait for API to be ready
echo "Waiting for API to initialize..."
sleep 10
# Simple health check
if curl -s $API_URL/api/health > /dev/null; then
    echo "API is UP!"
else
    echo "API failed to start or health check failed. Check api_stress.log"
    # Don't exit yet, let the stress test try (it might just be health check path issue)
fi

# 3. Run Stress Test
echo "[3/4] Running Stress Test Suite..."
# We need to make sure we use the same DATABASE_URL
export DATABASE_URL=$DATABASE_URL 
# Also allow local imports in tsx
npx tsx tools/stress/full_chain_stress.ts || STRESS_EXIT_CODE=$?

# 4. Cleanup
echo "[4/4] Cleaning up..."
kill $API_PID || true
echo "API Stopped."

if [ -n "$STRESS_EXIT_CODE" ]; then
    echo "❌ Stress Test Failed!"
    exit $STRESS_EXIT_CODE
else
    echo "✅ Stress Test Completed Successfully!"
fi
