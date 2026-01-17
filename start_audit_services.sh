#!/bin/bash
set -e
PROJECT_ROOT="$(pwd)"

echo "Starting API..."
pnpm -C apps/api dev > api_audit.log 2>&1 &
API_PID=$!

echo "Waiting for API to be healthy..."
MAX_RETRIES=60
RETRY_COUNT=0
until curl -s http://localhost:3000/api/health > /dev/null; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "API failed to start in time"
        tail -n 20 api_audit.log
        kill $API_PID || true
        exit 1
    fi
    sleep 2
done
echo "API is up."

echo "Starting Worker..."
pnpm -C apps/workers dev > worker_audit.log 2>&1 &
WORKER_PID=$!

# Save PIDs for cleanup
echo $API_PID > api.pid
echo $WORKER_PID > worker.pid
