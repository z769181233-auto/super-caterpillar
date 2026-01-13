#!/bin/bash
set -e

# Cleanup any leaking ports
lsof -t -i :3000 | xargs kill -9 || true
pkill -9 -f "ts-node.*workers" || true
pkill -9 -f "node.*workers" || true

# Load environment
source .env.local
export API_SECRET_KEY=$(echo "$API_SECRET_KEY" | tr -d '"' | tr -d "'")
VALID_KEY=$(psql "$DATABASE_URL" -t -c "SELECT key FROM \"api_keys\" WHERE status = 'ACTIVE' LIMIT 1;" | tr -d '[:space:]')

echo "Using API Key: $VALID_KEY"

# Start API
if [ -f "apps/api/dist/main.js" ]; then
    NODE_ENV=production node apps/api/dist/main.js > docs/_evidence/api_v6.log 2>&1 &
else
    npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register --transpile-only apps/api/src/main.ts > docs/_evidence/api_v6.log 2>&1 &
fi
API_PID=$!

echo "Waiting for API (PID $API_PID)..."
for i in {1..20}; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "API is UP"
        break
    fi
    sleep 2
done

# Start Worker
cd apps/workers
HMAC_TRACE=1 WORKER_ID=gate-worker-v6 WORKER_API_KEY="$VALID_KEY" WORKER_API_SECRET="$API_SECRET_KEY" npx ts-node --transpile-only -r tsconfig-paths/register src/main.ts > ../../worker_v6.log 2>&1 &
WORKER_PID=$!
cd ../..

echo "Worker started (PID $WORKER_PID). Running Gate..."
bash tools/gate/gates/gate-ce11_timeline_preview.sh 2>&1 | tee docs/_evidence/ce11_definitive_v6.log

# Cleanup
echo "Cleaning up..."
kill $WORKER_PID || true
kill $API_PID || true
pkill -9 -f "ts-node.*workers" || true
