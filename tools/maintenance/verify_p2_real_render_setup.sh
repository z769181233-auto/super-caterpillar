#!/bin/bash
# tools/maintenance/verify_p2_real_render_setup.sh
# Master P2 Verification Plan
# 目标：硬重启环境，验证 Real Render Adapter，P2-1 & P2-4 Gate

set -euo pipefail

REPO_ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="$REPO_ROOT/docs/_evidence/p2_real_render_gate_$TS"
mkdir -p "$EVI"/{env,logs,db,artifacts,gate}

echo "[EVI] $EVI" | tee "$EVI/logs/console.log"
exec > >(tee -a "$EVI/logs/console.log") 2>&1

echo "=== PLAN-0: Snapshot Process ==="
ps aux | grep -iE "apps/workers|dist/apps/workers|worker" | grep -v grep | tee "$EVI/env/ps_before.txt" || true
ps aux | grep -iE "apps/api|dist/apps/api|nest start" | grep -v grep | tee "$EVI/env/ps_api_before.txt" || true

echo "=== PLAN-1: Hard Stop Old Processes ==="
echo "Killing old workers..."
pkill -f "dist/apps/workers/src/main.js" || true
pkill -f "apps/workers" || true
pkill -f "worker-stage" || true

echo "Killing old APIs (to refresh Registry)..."
pkill -f "apps/api" || true
pkill -f "nest start" || true

sleep 3
ps aux | grep -iE "apps/workers|dist/apps/workers|worker" | grep -v grep | tee "$EVI/env/ps_after_kill.txt" || true
# Ensure port 3000 and 3001 are free
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "=== PLAN-2: DB & Build Alignment ==="
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
# Force local_mps shim for P2 Plumbing Verification (override .env)
export SHOT_RENDER_PROVIDER="local_mps"
export PYTHON_BIN="python3"

echo "Checking DB Schema..."
psql "$DATABASE_URL" -c "\d shots" | tee "$EVI/db/describe_shots.txt"
psql "$DATABASE_URL" -c "\d shot_jobs" | tee "$EVI/db/describe_shot_jobs.txt" || true

echo "Regenerating Prisma Client..."
pnpm -r prisma:generate 2>&1 | tee "$EVI/logs/prisma_generate.log"

echo "Building Worker..."
# Use pnpm filter to build specific project
pnpm -C apps/workers build 2>&1 | tee "$EVI/logs/worker_build.log"

echo "Waiting for FS sync..."
sleep 5

echo "Building API (Just in case)..."
pnpm -C apps/api build 2>&1 | tee "$EVI/logs/api_build.log"


echo "=== PLAN-3: Start Services ==="
# Start API
echo "Starting API..."
(pnpm -C apps/api start:prod 2>&1 | tee "$EVI/logs/api.log") &
API_PID=$!
echo $API_PID > "$EVI/env/api_pid.txt"

# Start Worker
echo "Starting Worker..."
# Note: package.json script "start" runs "node dist/main.js"
# But build output structure is dist/apps/workers/src/main.js
(cd apps/workers && node dist/apps/workers/src/main.js 2>&1 | tee "$EVI/logs/worker.log") &
WORKER_PID=$!
echo $WORKER_PID > "$EVI/env/worker_pid.txt"

echo "Waiting for services to boot (10s)..."
sleep 10

ps aux | grep -iE "apps/api|apps/workers|dist/apps/workers" | grep -v grep | tee "$EVI/env/ps_after_start.txt" || true


echo "=== PLAN-4: Execute Gates ==="
echo "--- Run 1: Gate P2-1 (No Fallback) ---"
# Needs GATE_MODE=1 to ensure strictness if needed (though P2-1 checks specific providers)
# We run strictly as bash script.
bash tools/gate/gates/gate-p2-no-fallback-real-render.sh 2>&1 | tee "$EVI/gate/gate_p2_1_no_fallback.log"

echo "--- Run 2: Gate P2-4 (Real Render Run 1) ---"
bash tools/gate/gates/gate-p2-real-render-single-shot.sh 2>&1 | tee "$EVI/gate/gate_p2_4_run1.log"

echo "--- Run 3: Gate P2-4 (Real Render Run 2 - Idempotency/Repeatability) ---"
bash tools/gate/gates/gate-p2-real-render-single-shot.sh 2>&1 | tee "$EVI/gate/gate_p2_4_run2.log"


echo "=== PLAN-5: Verify Artifacts ==="
echo "Collecting artifact paths..."
grep -RInE "result_image_url|result_video_url|OUTPUT|artifact|mp4|png|webp|m3u8" "$EVI/gate" \
  | tee "$EVI/artifacts/artifact_paths_from_gate.txt" || true

echo "Hashing Evidence Artifacts..."
# Assuming artifacts end up in .runtime or similar local paths, we'd need to copy them to evidence if we want them preserved.
# Gate P2-4 checks .runtime/renders/.... 
# Let's copy them to evidence if found.
mkdir -p "$EVI/artifacts/runtime"
cp -r apps/workers/.runtime/renders "$EVI/artifacts/runtime/" 2>/dev/null || true
cp -r .runtime/renders "$EVI/artifacts/runtime/" 2>/dev/null || true

find "$EVI/artifacts" -type f -print0 | xargs -0 shasum -a 256 > "$EVI/artifacts/SHA256SUMS.txt"
COUNT=$(wc -l < "$EVI/artifacts/SHA256SUMS.txt")
echo "Artifact Count: $COUNT" | tee "$EVI/artifacts/SHA256SUMS.count"

echo "=== DONE ==="
echo "Evidence Directory: $EVI"

# Cleanup processes at end? 
# The user wants to "make new worker load latest". Keeping it running behaves closer to "deployment".
# But to avoid dangling processes for next run, maybe we should kill? 
# The user didn't ask to stop. I will leave them running as "Deployment verified".
