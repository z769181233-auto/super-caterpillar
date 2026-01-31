#!/bin/bash
# tools/gate/gates/gate-p25-1_full_novel_e2e_3m.sh
# P25-1: 3M Words Full Novel E2E & Delivery Audit
# Evidence: docs/_evidence/p25_1_full_3m_<TS>

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# 1. Environment Setup
if [ -f .env.local ]; then
  source .env.local
  export DATABASE_URL
fi
source tools/gate/lib/gate_auth_seed.sh
LOG_DIR="docs/_evidence/p25_1_full_3m_$(date +%s)"
mkdir -p "$LOG_DIR"

API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $1" | tee -a "$LOG_DIR/gate.log"
}

# 2. Start Services
log_info "=== GATE P25-1 [FULL_NOVEL_E2E] START ==="
log_info "Target: 3,000,000 Words + L3 Audit"
log_info "Evidence: $LOG_DIR"

log_info "Cleaning up..."
pnpm exec tsx tools/gate/lib/flush_jobs.ts
# Flush Permission Cache
redis-cli flushall || echo "Redis flush skipped (not installed?)"

log_info "Starting API/Worker (Concurrency=50)..."
# Ensure port is free
lsof -ti:3000 | xargs kill -9 || true
sleep 2

# Start API
export WORKER_MAX_CONCURRENCY=50
export GATE_MODE=1

# Start API
# Use standard dev for simple setup but ensure logs are flushed
PORT=3000 BIBLE_INTERNAL_ALIAS_ENABLED=1 \
NODE_ENV=development pnpm --filter ./apps/api dev > "$API_LOG" 2>&1 &
API_PID=$!

log_info "Waiting for API (PID=$API_PID)..."
for i in {1..45}; do
  if nc -z localhost 3000; then
    log_info "API is UP."
    break
  fi
  sleep 1
done
sleep 5

# Start Worker
GATE_MODE=1 pnpm exec tsx apps/workers/src/gate/gate-worker-app.ts > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!

sleep 10

# 3. Execution (Single Pass with deep audit)
log_info ">>> Starting 3M Execution Pass..."
# We wrap the runner to capture the projectId from stdout
RUN_OUT=$(pnpm exec tsx tools/stress/p25/run_p25_tier.ts \
    --tier=p25_1 \
    --words=3000000 \
    --seed="p25_1_full_$(date +%s)" \
    --concurrency=50 \
    --out="$LOG_DIR" \
    --label="E2E")

echo "$RUN_OUT" > "$LOG_DIR/run_stdout.log"

# Extract projectId for audit
PROJ_ID=$(echo "$RUN_OUT" | grep "PROJECT_ID=" | cut -d= -f2 || true)

if [ -z "$PROJ_ID" ]; then
    log_info "❌ Failed to extract ProjectID from runner output"
    kill $API_PID $WORKER_PID 2>/dev/null || true
    exit 1
fi

log_info "ProjectID detected: $PROJ_ID"

# 4. Final Snapshot & L3 Audit
log_info ">>> Initiating Standardized Final Snapshot (PLAN-0)..."
# Use a combined seed based on timestamp if not provided, but here we can fix it for R1/R2 consistency
FIXED_SEED="p25_1_final_snapshot_$(date +%Y%m%d)"
if ! bash tools/ops/finalize_p25_1_snapshot.sh --projectId="$PROJ_ID" --out="$LOG_DIR/E2E" --seed="$FIXED_SEED"; then
    log_info "❌ Finalization or L3 Audit Failed"
    kill $API_PID $WORKER_PID 2>/dev/null || true
    exit 1
fi

log_info "✅ P25-1 E2E SUCCESS: Final Snapshots Generated."
log_info "Evidence: $LOG_DIR/E2E/"
ls -F "$LOG_DIR/E2E/"

kill $API_PID $WORKER_PID 2>/dev/null || true
exit 0
