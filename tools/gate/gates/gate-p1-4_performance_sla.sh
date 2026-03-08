#!/usr/bin/env bash
# tools/gate/gates/gate-p1-4_performance_sla.sh
# P24-0: Performance Hard Seal (Quantified SLA)
# 目的：验证核心引擎在大并发（N=20）下的 P95 延迟符合 Bible 规范。

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# 1. Environment Configuration
export NODE_ENV="development"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu}"
export SHOT_RENDER_PROVIDER="mock"
export BIBLE_INTERNAL_ALIAS_ENABLED=1
export THROTTLER_LIMIT=999999
export BICLE_THROTTLER_DISABLED=1
export WORKER_MAX_CONCURRENCY=20
export LOG_LEVEL="info"

LOG_DIR="docs/_evidence/p24_0_performance_$(date +%s)"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gate_p24.log"
API_LOG="$LOG_DIR/api.log"
WORKER_LOG="$LOG_DIR/worker.log"

log_info() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $1" | tee -a "$LOG_FILE"
}

log_info "=== GATE P24-0 [PERFORMANCE_SLA] START ==="

# 2. Cleanup & Initial Auth Seed
log_info "Cleaning up existing processes..."
lsof -t -i:3000 -i:3333 -i:9099 | xargs kill -9 || true

log_info "Seeding Auth & Database..."
source tools/gate/lib/gate_auth_seed.sh
# Standardize for stress test
export API_KEY="${VALID_API_KEY_ID}"
export API_SECRET="${API_SECRET}"
export API_URL="http://127.0.0.1:3000"

log_info "Flushing stale job queue..."
pnpm exec tsx tools/gate/lib/flush_jobs.ts

log_info "Starting API..."
export PORT=3000
BIBLE_INTERNAL_ALIAS_ENABLED=1 pnpm --filter ./apps/api dev > "$API_LOG" 2>&1 &
API_PID=$!

# Wait for API
log_info "Waiting for API to be ready..."
for i in {1..90}; do
  if curl -s http://127.0.0.1:3000/health | grep -q '"status":"ok"'; then
    log_info "API is UP."
    break
  fi
  if [ $i -eq 90 ]; then
    log_info "❌ API failed to start within 90s"
    kill $API_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

log_info "Starting Worker..."
export API_URL="http://127.0.0.1:3000"
export WORKER_METRICS_PORT=9099
export WORKER_SUPPORTED_ENGINES="ce03_visual_density,ce04_visual_enrichment,ce06_novel_parsing,shot_render,timeline_render"
pnpm --filter ./apps/workers dev > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!

log_info "Waiting for Worker to register..."
sleep 10

# 3. Run Stress Test (Phase 1 to 20)
log_info "Running Stress Test (N=1, 5, 10, 20)..."
export API_URL="http://127.0.0.1:3000"
export PROJ_ID="${PROJ_ID}"
# We use tsx to run the stress test script
if ! pnpm exec tsx tools/stress/p1-4_engine_latency_stress.ts >> "$LOG_FILE" 2>&1; then
    log_info "❌ Stress Test Script Failed"
    kill $API_PID $WORKER_PID 2>/dev/null || true
    exit 1
fi

# 4. Verify SLA via Prometheus Metrics
log_info "Verifying SLA Assertions from Worker Metrics..."

function check_p95() {
    ENGINE=$1
    SLA=$2
    METRICS=$(curl -s http://localhost:9099/metrics)
    TOTAL=$(echo "$METRICS" | grep "scu_engine_exec_duration_seconds_count{engine=\"$ENGINE\",mode=\"gate\"}" | awk '{print $NF}')
    
    if [ -z "$TOTAL" ] || [ "$TOTAL" -eq "0" ]; then
        log_info "❌ $ENGINE: No metrics found (TOTAL=0)"
        exit 1
    fi

    # Histogram buckets: scu_engine_exec_duration_seconds_bucket{le="2",engine="...",mode="..."}
    BUCKET_COUNT=$(echo "$METRICS" | grep "scu_engine_exec_duration_seconds_bucket{le=\"$SLA\",engine=\"$ENGINE\",mode=\"gate\"}" | awk '{print $NF}')
    
    if [ -z "$BUCKET_COUNT" ]; then
        BUCKET_COUNT=0
    fi

    PCT=$(echo "scale=4; $BUCKET_COUNT / $TOTAL" | bc)
    
    if (( $(echo "$PCT >= 0.95" | bc -l) )); then
        log_info "✅ $ENGINE P95 <= ${SLA}s (Actual: ${PCT} packets satisfied)"
    else
        log_info "❌ $ENGINE P95 > ${SLA}s (Actual: only ${PCT} <= $SLA)"
        exit 1
    fi
}

# SLA Defined in Bible
check_p95 "ce06_novel_parsing" "1.5"
check_p95 "ce03_visual_density" "2"
check_p95 "ce04_visual_enrichment" "3"

log_info "=== FINAL EVIDENCE SEALED ==="
log_info "GATE P24-0 [PERFORMANCE_SLA]: PASS"
log_info "Evidence saved to: $LOG_DIR"

kill $API_PID $WORKER_PID 2>/dev/null || true
exit 0
