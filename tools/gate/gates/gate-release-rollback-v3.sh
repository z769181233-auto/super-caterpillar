#!/bin/bash
# gate-release-rollback-v3.sh
# V3 Release & Rollback Gate: Verify Release Safety & Rollback Capability
# Usage: ./tools/gate/gates/gate-release-rollback-v3.sh

set -u # Do not set -e here to allow matrix collection

# ==============================================================================
# Configuration
# ==============================================================================
GATE_NAME="RELEASE_ROLLBACK_V3"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/release_rollback_v3_$TS"
mkdir -p "$EVIDENCE_DIR"

API_URL=${API_URL:-"http://localhost:3000"}
CHECK_INTERVAL=2
MAX_WAIT=60

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

# ==============================================================================
# Phase 0: Environment Audit
# ==============================================================================
log "Phase 0: Environment Audit"

# 0.1 Git Clean Check
GIT_STATUS=$(git status --porcelain)
echo "$GIT_STATUS" > "$EVIDENCE_DIR/GIT_STATUS_BEFORE.txt"
if [ -n "$GIT_STATUS" ]; then
    log "❌ Error: Git workspace is NOT clean. Please commit or stash changes before running release gate."
    log "Dirty Files:"
    echo "$GIT_STATUS"
    exit 1
fi
log "✅ Git workspace is clean."

# 0.2 Version Anchors
ORIGINAL_HEAD=$(git rev-parse HEAD)
echo "$ORIGINAL_HEAD" > "$EVIDENCE_DIR/GIT_HEAD_BEFORE.txt"
log "Current HEAD: $ORIGINAL_HEAD"

# 0.3 Resolve Rollback Tag
# Support seal/v3_production_ready_p10_1_*
ROLLBACK_TAG=$(git tag -l "seal/v3_production_ready_p10_1_*" | sort -V | tail -n 1)
if [ -z "$ROLLBACK_TAG" ]; then
    log "❌ Error: Could not find any ROLLBACK_TAG matching seal/v3_production_ready_p10_1_*"
    exit 1
fi
echo "$ROLLBACK_TAG" > "$EVIDENCE_DIR/SELECTED_ROLLBACK_TAG.txt"
log "Selected Rollback Tag: $ROLLBACK_TAG"

# ==============================================================================
# Helpers: Service Lifecycle
# ==============================================================================
stop_services() {
    log "Stopping API and Worker processes..."
    # Kill processes listening on typical ports
    lsof -t -i :3000 | xargs kill -9 2>/dev/null || true
    lsof -t -i :3001 | xargs kill -9 2>/dev/null || true
    # Grep based kill for safety
    ps aux | grep -E "apps/api|apps/worker" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 2
}

start_services() {
    local label=$1
    log "Starting services for [$label] (Direct Seq Start)..."
    export $(grep -v '^#' .env | xargs)
    
    # 1. API (Direct)
    log "Launching API via apps/api..."
    (cd apps/api && pnpm dev) > "$EVIDENCE_DIR/api_start_${label}.log" 2>&1 &
    
    # 2. Sequential Health Check for API
    log "Waiting for API health..."
    local api_up=false
    for ((i=1; i<=MAX_WAIT; i+=CHECK_INTERVAL)); do
        if curl -s -f "$API_URL/api/health" > /dev/null; then
            log "✅ API is UP."
            api_up=true
            break
        fi
        sleep $CHECK_INTERVAL
    done
    
    if [ "$api_up" == "false" ]; then
        log "❌ API Health Check TIMEOUT for [$label]."
        return 1
    fi
    
    # 3. Worker & Mock Engine (Direct)
    log "Launching Worker via apps/workers..."
    (cd apps/workers && pnpm dev) > "$EVIDENCE_DIR/worker_start_${label}.log" 2>&1 &
    
    log "Launching Mock Engine..."
    pnpm mock:http-engine > "$EVIDENCE_DIR/mock_engine_start_${label}.log" 2>&1 &
    
    # Stabilize
    sleep 5
    return 0
}

# ==============================================================================
# EXEC-P11-0: Destructive Clean Safeguard (Double-Lock)
# ==============================================================================
safe_truncate_jobs() {
    local label=$1
    local db_name=$(echo "$DATABASE_URL" | sed -E 's/.*\/([^?]+).*/\1/')
    local log_file="$EVIDENCE_DIR/DESTRUCTIVE_GUARD_${label}.txt"
    
    echo "TIMESTAMP: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "$log_file"
    echo "DATABASE_TARGET: $db_name" >> "$log_file"
    echo "GATE_MODE: ${GATE_MODE:-0}" >> "$log_file"
    echo "ALLOW_DATABASE_DESTRUCTIVE_CLEAN: ${ALLOW_DATABASE_DESTRUCTIVE_CLEAN:-false}" >> "$log_file"

    local is_safe=false
    if [ "${GATE_MODE:-0}" == "1" ] && \
       [ "${ALLOW_DATABASE_DESTRUCTIVE_CLEAN:-false}" == "true" ] && \
       ([[ "$db_name" == *"_gate"* ]] || [[ "$db_name" == *"_test"* ]]); then
        is_safe=true
    fi

    echo "DECISION_SAFE: $is_safe" >> "$log_file"

    if [ "$is_safe" == "true" ]; then
        log "✅ [SAFEGUARD] Double-lock PASSED for DB [$db_name]. Executing TRUNCATE..."
        psql "$DATABASE_URL" -c "TRUNCATE shot_jobs CASCADE;" >> "$log_file" 2>&1
    else
        log "⚠️ [SAFEGUARD] Double-lock REJECTED for DB [$db_name]. Skipping TRUNCATE to protect data."
        echo "REASON: Env vars or DB name mismatch (Requires GATE_MODE=1, ALLOW_CLEAN=true, name~_gate|_test)" >> "$log_file"
    fi
}

# Cleanup Trap
trap "git checkout $ORIGINAL_HEAD --quiet; stop_services" EXIT

# ==============================================================================
# Phase 1: Dependency Matrix
# ==============================================================================
log "Phase 1: Dependency Matrix"

# Ensure services are up for Phase 1 (HEAD)
stop_services
safe_truncate_jobs "PHASE1_HEAD"
if ! start_services "PHASE1_HEAD"; then
    log "❌ Phase 1 Initial Startup Failed."
    exit 1
fi

# Using indexed arrays for Bash 3.2 compatibility (macOS default)
GATES_LABELS=("P10.1_RECEIPT" "P11.2_LOAD_SLO" "P9_CONTRACT_PUB" "PHASE3_COMMERCIAL")
GATES_PATHS=(
    "tools/gate/gates/gate-v3-production-receipt.sh"
    "tools/gate/gates/gate-v3-load-slo.sh"
    "tools/gate/gates/gate-v3-contract-to-published.sh"
    "tools/gate/gates/gate-phase3-commercial-e2e.sh"
)

MATRIX_FILE="$EVIDENCE_DIR/dependency_matrix.json"
echo "{" > "$MATRIX_FILE"

FAILED_GATES=()
for ((i=0; i<${#GATES_LABELS[@]}; i++)); do
    label="${GATES_LABELS[$i]}"
    path="${GATES_PATHS[$i]}"
    log "Running $label ($path)..."
    
    # Custom runner for load-slo to use mock profile
    if [ "$label" == "P11.2_LOAD_SLO" ]; then
        PROFILE=mock P95_THRESHOLD_MS=120000 bash "$path" > "$EVIDENCE_DIR/gate_${label}.log" 2>&1
    else
        bash "$path" > "$EVIDENCE_DIR/gate_${label}.log" 2>&1
    fi
    EXIT_CODE=$?
    
    echo "  \"$label\": $EXIT_CODE," >> "$MATRIX_FILE"
    if [ $EXIT_CODE -ne 0 ]; then
        log "❌ $label FAILED (Code $EXIT_CODE)"
        FAILED_GATES+=("$label")
    else
        log "✅ $label PASSED"
    fi
done

# Close JSON
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" >> "$MATRIX_FILE"
echo "}" >> "$MATRIX_FILE"

if [ ${#FAILED_GATES[@]} -gt 0 ]; then
    log "⚠️ Phase 1 Dependency Check has failures. Will continue to Drill but final result will be FAIL."
fi

# ==============================================================================
# Phase 2: Rollback Drill
# ==============================================================================
log "Phase 2: Rollback Drill"

run_receipt_gate() {
    local label=$1
    log "Running Receipt Verification for $label..."
    MOCK_SCRIPT_PATH=/tmp/ POLL_INTERVAL=60 bash tools/gate/gates/gate-v3-production-receipt.sh > "$EVIDENCE_DIR/receipt_verification_${label}.log" 2>&1
    return $?
}

DRILL_SUCCESS=true

# --- 2.1 Drill: Rollback ---
log ">>> Drill Part A: Rollback to $ROLLBACK_TAG"
stop_services
git checkout -f "$ROLLBACK_TAG"
safe_truncate_jobs "ROLLBACK"
if ! start_services "ROLLBACK"; then
    log "❌ Rollback Startup Failed."
    DRILL_SUCCESS=false
else
    if ! run_receipt_gate "ROLLBACK"; then
        log "❌ Rollback Receipt Verification Failed."
        DRILL_SUCCESS=false
    fi
fi

# --- 2.2 Drill: Recovery (HEAD) ---
log ">>> Drill Part B: Return to HEAD ($ORIGINAL_HEAD)"
stop_services
git checkout -f "$ORIGINAL_HEAD"
safe_truncate_jobs "HEAD_VERIFY"
if ! start_services "HEAD_VERIFY"; then
    log "❌ HEAD Recovery Startup Failed."
    DRILL_SUCCESS=false
else
    if ! run_receipt_gate "HEAD"; then
        log "❌ HEAD Recovery Receipt Verification Failed."
        DRILL_SUCCESS=false
    fi
fi

# ==============================================================================
# Phase 3: Final Judgment & Sealing
# ==============================================================================
log "Phase 3: Final Judgment & Sealing"

# Final Hash Index
cd "$EVIDENCE_DIR"
find . -type f ! -name "EVIDENCE_HASH_INDEX.json" -exec sha256sum {} + > "SHA256SUMS.txt"
jq -R -s -c 'split("\n") | map(select(length > 0))' "SHA256SUMS.txt" > "EVIDENCE_HASH_INDEX.json"
cd - > /dev/null

RESULT="PASS"
[ ${#FAILED_GATES[@]} -gt 0 ] && RESULT="FAIL"
[ "$DRILL_SUCCESS" == "false" ] && RESULT="FAIL"

log "=========================================================="
log "FINAL JUDGMENT: $RESULT"
log "=========================================================="

if [ "$RESULT" == "PASS" ]; then
    log "🏆 ALL CRITICAL RELEASE CHECKS PASSED."
    exit 0
else
    log "❌ GATE FAILED. Please check dependency_matrix.json and drill logs."
    exit 1
fi
