#!/bin/bash
set -e

cd "$(dirname "$0")/../.."


# Define the target database URL explicitly for the reset process
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu?schema=public"
export JWT_SECRET="smoke_jwt_secret_dev_only_change_me"
export REDIS_URL="redis://localhost:6379"

echo "➡️ Stopping processes..."
pkill -f "next dev" || true
pkill -f "@scu/worker" || true
pkill -f "nest" || true
pkill -f "ts-node" || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "➡️ Flushing Redis..."
redis-cli ping >/dev/null 2>&1 && redis-cli FLUSHALL || true

echo "➡️ Recreating DB (via Node.js)..."
node tools/admin/clean_db.js

echo "➡️ Installing Dependencies..."
pnpm -w install

echo "➡️ Rebuilding Schema & Pushing DB..."
# Run prisma commands via the database package script
pnpm --filter database db:generate
pnpm --filter database db:push

echo "✅ Environment Reset Complete."
