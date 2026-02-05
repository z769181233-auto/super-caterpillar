#!/bin/bash
set -e
PROJECT_ROOT="$(pwd)"

# 1. Surgical Cleanup by Port (Avoid global pkill)
cleanup_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -t -i:$port)
    if [ ! -z "$pid" ]; then
        echo "Cleaning up existing $name on port $port (PID: $pid)..."
        kill -9 $pid || true
        sleep 1
    fi
}

echo "Pre-start cleanup..."
cleanup_port 3000 "API"
cleanup_port 3001 "Web/Other"
cleanup_port 8188 "ComfyUI (if stray)"

# 2. Start API
echo "Starting API..."
export REPO_ROOT="${PROJECT_ROOT}"
echo "REPO_ROOT set to: ${REPO_ROOT}"
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm -C apps/api dev > api_audit.log 2>&1 &
API_PID=$!

echo "Waiting for API to be healthy..."
MAX_RETRIES=60
RETRY_COUNT=0
HEALTH_URL="http://127.0.0.1:3000/api/health"

until curl -s $HEALTH_URL > /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ API failed to start in time (Logs below):"
        tail -n 30 api_audit.log
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
pnpm -C apps/workers dev > worker_audit.log 2>&1 &
WORKER_PID=$!

# Save PIDs
echo $API_PID > api.pid
echo $WORKER_PID > worker.pid

echo "✅ Services initiated. PIDs: API($API_PID), Worker($WORKER_PID)"
