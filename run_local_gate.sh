#!/bin/bash
set -e
export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu"
export PRISMA_CLIENT_ENGINE_TYPE=library

echo "Running prisma tools..."
npx prisma generate --schema=./packages/database/prisma/schema.prisma || true
npx prisma db push --schema=./packages/database/prisma/schema.prisma --accept-data-loss || true

echo "Seeding user-gate, gate-org and ak_smoke_test_key_v1 via psql..."
psql "$DATABASE_URL" -c "
INSERT INTO \"users\" (id, email, \"passwordHash\", role, \"createdAt\", \"updatedAt\") 
VALUES ('user-gate', 'gate@example.com', 'dummy-hash', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
            
INSERT INTO \"organizations\" (id, name, \"ownerId\", \"createdAt\", \"updatedAt\")
VALUES ('gate-org', 'Gate Organization', 'user-gate', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
            
INSERT INTO \"api_keys\" (id, key, \"ownerOrgId\", \"ownerUserId\", name, status, \"createdAt\", \"updatedAt\")
VALUES ('api_key_gate', 'ak_smoke_test_key_v1', 'gate-org', 'user-gate', 'Smoke Gate Key', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
"

mkdir -p .data/logs .data/pids
export PORT=3000
export API_PORT=3000
export NODE_ENV=staging
export JWT_SECRET="dummy-secret-for-ci"
export REDIS_URL="redis://127.0.0.1:6379"

pnpm --filter api start > .data/logs/api.log 2>&1 &
echo $! > .data/pids/api.pid

echo "Waiting for API on port 3000..."
for i in $(seq 1 45); do
  if curl -s http://127.0.0.1:3000/health; then
    echo "API is ready."
    break
  fi
  sleep 2
done

export GATE_ENV_MODE=ci
export API_URL=http://127.0.0.1:3000
export API_KEY=ak_smoke_test_key_v1
export P6_2='1'
bash tools/gate/run_launch_gates.sh > launch_gates_repro_local.txt 2>&1 || true

kill $(cat .data/pids/api.pid) || true
