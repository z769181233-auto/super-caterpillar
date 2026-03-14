#!/bin/bash
# Comprehensive launch script for SCU services

# 1. STOP EVERYTHING
echo "➡️ Stopping existing processes..."
pkill -f "next dev" || true
pkill -f "@scu/worker" || true
pkill -f "nest" || true
pkill -f "ts-node" || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 2. CONFIGURE ENVIRONMENT
export JWT_SECRET="smoke_jwt_secret_dev_only_change_me"
export JWT_REFRESH_SECRET="smoke_jwt_refresh_secret_dev_only_change_me"
export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu?schema=public"
export REDIS_URL="redis://localhost:6379"
export IGNORE_ENV_FILE="true"
export FRONTEND_URL="http://localhost:3001"
export API_PORT=3000
export NODE_ENV=development

# 3. LAUNCH API
echo "➡️ Launching API..."
# We use start_api.sh which handles PIDs etc.
bash tools/smoke/start_api.sh > /tmp/scu_api.log 2>&1 &

# 4. WAIT FOR API
echo "➡️ Waiting for API to boot..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -s http://localhost:3000/api/health > /dev/null; do
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ API failed to start in time."
        exit 1
    fi
    printf "."
done
echo "✅ API is up!"

# 5. LAUNCH WORKER
echo "➡️ Launching Worker..."
pnpm -w --filter @scu/worker dev > /tmp/scu_worker.log 2>&1 &

# 6. LAUNCH WEB
echo "➡️ Launching Web..."
pnpm -w --filter web dev > /tmp/scu_web.log 2>&1 &

echo "🚀 All services launched in background."
echo "   API: http://localhost:3000"
echo "   Web: http://localhost:3001"
