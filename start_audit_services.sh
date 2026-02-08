#!/bin/bash
set -e
PROJECT_ROOT="$(pwd)"

source tools/gate/common/safe_proc.sh
echo "Pre-start cleanup..."
kill_port 3000
kill_port 3001
kill_port 8188

# 2. Start API
echo "Starting API..."
export REPO_ROOT="${PROJECT_ROOT}"
echo "REPO_ROOT set to: ${REPO_ROOT}"
export NODE_OPTIONS="--max-old-space-size=4096"
export HMAC_DEBUG="1"
export TS_NODE_TRANSPILE_ONLY="1"
mkdir -p logs .data/pids
pnpm -C apps/api dev > logs/api_audit.log 2>&1 &
API_PID=$!

echo "Waiting for API to be healthy..."
MAX_RETRIES=60
RETRY_COUNT=0
HEALTH_URL="http://127.0.0.1:3000/api/health"

until curl -s $HEALTH_URL > /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ API failed to start in time (Logs below):"
        tail -n 30 logs/api_audit.log
        kill -9 $API_PID || true
        exit 1
    fi
    printf "."
    sleep 2
done
echo -e "\n✅ API is up."

# 3. Start Worker
echo "Starting Worker..."
export NODE_OPTIONS="--max-old-space-size=4096"
export WORKER_METRICS_PORT=3001
pnpm -C apps/workers dev > logs/worker_audit.log 2>&1 &
WORKER_PID=$!

# Save PIDs
echo $API_PID > .data/pids/api.pid
echo $WORKER_PID > .data/pids/worker.pid

echo "✅ Services initiated. PIDs: API($API_PID), Worker($WORKER_PID)"
