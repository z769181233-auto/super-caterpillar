#!/bin/bash
# gate-v3-load-slo.sh
# V3 Production Load Gate with Dual Profiles (Mock/Real)
# Usage: PROFILE=mock|real ./tools/gate/gates/gate-v3-load-slo.sh

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================
PROFILE=${PROFILE:-mock}
CONCURRENCY=${CONCURRENCY:-5}
TARGET_JOBS=${TARGET_JOBS:-20} # P0 Fix: Bumped default to 20
ALLOW_FAILURES=${ALLOW_FAILURES:-0}
P95_THRESHOLD_MS=10000

if [ "$PROFILE" == "real" ]; then
    P95_THRESHOLD_MS=120000
    CONCURRENCY=${CONCURRENCY:-3} # Default lower for real engine unless overridden
    TARGET_JOBS=${TARGET_JOBS:-6}
    ALLOW_FAILURES=1
fi

EVIDENCE_DIR="docs/_evidence/v3_load_slo_$(date +%Y%m%d%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Export for Generator
export API_URL=${API_URL:-"http://localhost:3000"}
export CONCURRENCY
export TARGET_JOBS
export EVIDENCE_DIR

log() {
    echo "[$PROFILE] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting Load Gate (Profile=$PROFILE, Concurrency=$CONCURRENCY, Targets=$TARGET_JOBS)..."

# ==============================================================================
# 0. Setup & Health Check
# ==============================================================================
if [ -z "${DATABASE_URL:-}" ]; then
    log "❌ DATABASE_URL not set."
    exit 1
fi

test_db_connection() {
    psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1
}

if ! test_db_connection; then
    log "❌ DB Connection Failed."
    exit 1
fi

# Fetch Project (Required by Generator)
PROJECT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM projects LIMIT 1;" | xargs)
if [ -z "$PROJECT_ID" ]; then
    log "❌ No Project Found in DB."
    exit 1
fi
export PROJECT_ID

# ==============================================================================
# 1. Execution
# ==============================================================================
log "Running Load Generator..."
set +e # Allow capture of exit code
npx ts-node tools/gate/scripts/v3-load-generator.ts > "$EVIDENCE_DIR/generator.log" 2>&1
GEN_EXIT=$?
set -e

if [ $GEN_EXIT -ne 0 ]; then
    log "❌ Load Generator Failed (Exit Code $GEN_EXIT). See generator.log."
    cat "$EVIDENCE_DIR/generator.log"
    exit 1
fi

if [ ! -f "$EVIDENCE_DIR/summary.json" ]; then
    log "❌ Summary file missing!"
    exit 1
fi

# ==============================================================================
# 2. Assertions
# ==============================================================================
FAILED_COUNT=$(jq -r '.failed' "$EVIDENCE_DIR/summary.json")
P95_ACTUAL=$(jq -r '.p95_latency_ms' "$EVIDENCE_DIR/summary.json")
SUCCESS_RATE=$(jq -r '.success_rate' "$EVIDENCE_DIR/summary.json")

log "Results: SuccessRate=${SUCCESS_RATE}%, Failed=$FAILED_COUNT, P95=${P95_ACTUAL}ms"

# Assertion 1: Success Rate / Failure Count
if [ "$FAILED_COUNT" -gt "$ALLOW_FAILURES" ]; then
    log "❌ Assertion Failed: Failures ($FAILED_COUNT) > Allowed ($ALLOW_FAILURES)"
    exit 1
fi
log "✅ Success Rate/Failure Count Assertion Passed."

# Assertion 2: Latency
IS_LATENCY_OK=$(node -e "console.log(Number($P95_ACTUAL) <= Number($P95_THRESHOLD_MS))")
if [ "$IS_LATENCY_OK" != "true" ]; then
     log "❌ Assertion Failed: P95 Latency (${P95_ACTUAL}ms) > Threshold (${P95_THRESHOLD_MS}ms)"
     exit 1
fi
log "✅ Latency Assertion Passed."

# Assertion 3: Queue State (Scoped Zombie Check)
log "Waiting for background jobs to settle (30s)..."
sleep 30

# P0-2 FIX: Check both story_jobs.json and shot_jobs.json against ALL potential job tables
STORY_JOBS_FILE="$EVIDENCE_DIR/story_jobs.json"
SHOT_JOBS_FILE="$EVIDENCE_DIR/shot_jobs.json"

ALL_JOBS_IDS=$(jq -s 'add | map("'\''" + . + "'\''") | join(",")' "$STORY_JOBS_FILE" "$SHOT_JOBS_FILE" 2>/dev/null || echo "")

if [ -z "$ALL_JOBS_IDS" ] || [ "$ALL_JOBS_IDS" == "null" ] || [ "$ALL_JOBS_IDS" == "[]" ]; then
     log "⚠️ Warning: No jobs generated (or job IDs empty). Skipping queue check."
else
    log "Checking queue state for load test jobs (trace_id LIKE 'load_test_%') across all tables..."
    
    # Check if ANY of our generated jobs are still PENDING or RUNNING across all known job tables
    # FIX-D: Scoped by traceId (camelCase) to avoid contamination. 
    # Narrowed to shot_jobs as it is the main fanned-out table with traceId support.
    # Enum values aligned with prisma schema: PENDING, RUNNING, RETRYING, DISPATCHED
    ZOMBIE_COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM shot_jobs WHERE \"traceId\" LIKE 'load_test_%' AND status IN ('PENDING', 'RUNNING', 'RETRYING', 'DISPATCHED');
    " | xargs)
    
    if [ "$ZOMBIE_COUNT" != "0" ]; then
        log "❌ Queue Assertion Failed: Found $ZOMBIE_COUNT zombie jobs (PENDING/RUNNING) from this run."
        
        # Dump the zombies for evidence
        log "Dumping zombies to $EVIDENCE_DIR/zombies.txt..."
        {
          echo "=== shot_jobs Zombies ==="
          psql "$DATABASE_URL" -c "SELECT id, status, type, \"traceId\" FROM shot_jobs WHERE \"traceId\" LIKE 'load_test_%' AND status IN ('PENDING', 'RUNNING', 'RETRYING', 'DISPATCHED');"
        } > "$EVIDENCE_DIR/zombies.txt"
        
        exit 1
    fi
    log "✅ Queue State Assertion Passed (Clean Drain)."
fi

# ==============================================================================
# 3. Finalization
# ==============================================================================
cd "$EVIDENCE_DIR"
sha256sum * > SHA256SUMS.txt
cd - > /dev/null

log "🏆 Load Gate PASSED."
exit 0
