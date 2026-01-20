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
# Phase 1: Dependency Matrix
# ==============================================================================
log "Phase 1: Dependency Matrix"

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
        PROFILE=mock bash "$path" > "$EVIDENCE_DIR/gate_${label}.log" 2>&1
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

# Close JSON (remove last comma manually is hard in sh, so we just add a timestamp)
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" >> "$MATRIX_FILE"
echo "}" >> "$MATRIX_FILE"

if [ ${#FAILED_GATES[@]} -gt 0 ]; then
    log "❌ Phase 1 Dependency Check FAILED. Evidence archived."
    # We continue if possible for the drill, but the gate will fail at the end.
fi

# ==============================================================================
# Phase 2: Rollback Drill
# ==============================================================================
log "Phase 2: Rollback Drill"

stop_services() {
    log "Stopping API and Worker processes..."
    # Kill processes listening on typical ports
    lsof -t -i :3000 | xargs kill -9 2>/dev/null || true
    lsof -t -i :3001 | xargs kill -9 2>/dev/null || true
    # Grep based kill for safety
    ps aux | grep -E "apps/api|apps/worker" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 2
}

wait_for_health() {
    log "Waiting for service health check at $API_URL/api/health..."
    for ((i=1; i<=MAX_WAIT; i+=CHECK_INTERVAL)); do
        if curl -s -f "$API_URL/api/health" > /dev/null; then
            log "✅ Service is HEALTHY."
            return 0
        fi
        sleep $CHECK_INTERVAL
    done
    log "❌ Service Health Check TIMEOUT."
    return 1
}

run_receipt_gate() {
    local label=$1
    log "Running Receipt Verification for $label..."
    bash tools/gate/gates/gate-v3-production-receipt.sh > "$EVIDENCE_DIR/receipt_verification_${label}.log" 2>&1
    return $?
}

DRILL_SUCCESS=true

# --- 2.1 Drill: Rollback ---
log ">>> Drill Part A: Rollback to $ROLLBACK_TAG"
git checkout "$ROLLBACK_TAG" --quiet
stop_services
# Start services at the old tag (Assumes standard package scripts)
log "Starting services at $ROLLBACK_TAG..."
export $(grep -v '^#' .env | xargs) && pnpm dev:api > "$EVIDENCE_DIR/api_start_rollback.log" 2>&1 &
export $(grep -v '^#' .env | xargs) && pnpm dev:worker > "$EVIDENCE_DIR/worker_start_rollback.log" 2>&1 &

if ! wait_for_health; then
    log "❌ Rollback Health Check Failed."
    DRILL_SUCCESS=false
else
    if ! run_receipt_gate "ROLLBACK"; then
        log "❌ Rollback Receipt Verification Failed."
        DRILL_SUCCESS=false
    fi
fi

# --- 2.2 Drill: Recovery (HEAD) ---
log ">>> Drill Part B: Return to HEAD ($ORIGINAL_HEAD)"
git checkout "$ORIGINAL_HEAD" --quiet
stop_services
log "Starting services at HEAD..."
export $(grep -v '^#' .env | xargs) && pnpm dev:api > "$EVIDENCE_DIR/api_start_head.log" 2>&1 &
export $(grep -v '^#' .env | xargs) && pnpm dev:worker > "$EVIDENCE_DIR/worker_start_head.log" 2>&1 &

if ! wait_for_health; then
    log "❌ HEAD Health Check Failed."
    DRILL_SUCCESS=false
else
    if ! run_receipt_gate "HEAD"; then
        log "❌ HEAD Receipt Verification Failed."
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
