#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# gate-bible-v3-contract.sh
# Purpose: Verify strict V3 Bible Contract compliance (DB Views & API)

GATE_NAME="V3_CONTRACT_GATE"
TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/v3_contract_gate_$TS"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/gate.log"
}

log "Starting V3 Contract Facade Verification..."

# 1. DB VIEW SCHEMA CHECK (Snake Case Validation)

check_view() {
    local view_name=$1
    local expected_cols=$2
    
    log "Checking View: $view_name"
    ACTUAL=$(psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='$view_name' ORDER BY column_name;")
    ACTUAL_FLAT=$(echo $ACTUAL | xargs)
    
    # Sort for comparison
    EXP_SORTED=$(echo $expected_cols | tr ' ' '\n' | sort | xargs)
    ACT_SORTED=$(echo $ACTUAL_FLAT | tr ' ' '\n' | sort | xargs)

    if [ "$EXP_SORTED" == "$ACT_SORTED" ]; then
        log "✅ [DB] $view_name matches contract."
    else
        log "❌ [DB] $view_name MISMATCH."
        log "   Expected: $EXP_SORTED"
        log "   Actual:   $ACT_SORTED"
        return 1
    fi
}

PASS_DB=true

# v3_novels
if ! check_view "v3_novels" "id project_id title author raw_file_url total_tokens status created_at updated_at"; then PASS_DB=false; fi

# v3_novel_chapters
if ! check_view "v3_novel_chapters" "id novel_id volume_id index title raw_content created_at"; then PASS_DB=false; fi

# v3_scenes
if ! check_view "v3_scenes" "id chapter_id index title enriched_text visual_density status created_at"; then PASS_DB=false; fi

# v3_shots
if ! check_view "v3_shots" "id scene_id index shot_type visual_prompt camera_movement duration_sec render_status result_image_url"; then PASS_DB=false; fi


if [ "$PASS_DB" = false ]; then
    log "❌ DB View Check Failed."
    exit 1
fi

# 2. API CONTRACT CHECK (Thin Adapter)
API_URL="http://localhost:3000"

# Fetch a valid Project ID for testing
PROJECT_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM projects LIMIT 1;" | xargs)
if [ -z "$PROJECT_ID" ]; then
    log "❌ [API] No Project found in DB. Cannot test /v3/story/parse."
    exit 1
fi
log "Using Project ID: $PROJECT_ID"

# 2.1 Story Parse (Real)
log "Checking POST /v3/story/parse"
# Ensure we capture output even if curl fails
if RESP=$(curl -s -f -X POST "$API_URL/v3/story/parse" -H "Content-Type: application/json" -d "{\"project_id\": \"$PROJECT_ID\", \"raw_text\": \"Test Story Content\"}"); then
    KEYS=$(echo $RESP | jq -r 'keys | sort | join(" ")')
    # V3 keys include note, trace_id, job_id, status
    # Note: sort order: job_id note status trace_id
    EXP_KEYS="job_id note status trace_id"
    
    if [ "$KEYS" == "$EXP_KEYS" ]; then
        log "✅ [API] /v3/story/parse matches contract."
        
        # 2.1.1 Check Job Status (Polling)
        JOB_ID=$(echo $RESP | jq -r '.job_id')
        log "Checking GET /v3/story/job/$JOB_ID"
        if JOB_RESP=$(curl -s -f "$API_URL/v3/story/job/$JOB_ID"); then
             J_KEYS=$(echo $JOB_RESP | jq -r 'keys | sort | join(" ")')
             EXP_J_KEYS="created_at id progress status updated_at"
             if [ "$J_KEYS" == "$EXP_J_KEYS" ]; then
                log "✅ [API] /v3/story/job/:id matches contract."
             else
                log "❌ [API] /v3/story/job/:id MISMATCH. Got: $J_KEYS"
                exit 1
             fi
        else
             log "❌ [API] GET /v3/story/job/$JOB_ID Failed."
             exit 1
        fi
        
    else
        log "❌ [API] /v3/story/parse MISMATCH. Got: $KEYS"
        exit 1
    fi
else
    log "❌ [API] /v3/story/parse Request Failed (Is API running?)"
    exit 1
fi

# 2.2 Shot Batch (Mock)
log "Checking POST /v3/shot/batch-generate"
if RESP=$(curl -s -f -X POST "$API_URL/v3/shot/batch-generate" -H "Content-Type: application/json" -d '{}'); then
    KEYS=$(echo $RESP | jq -r 'keys | sort | join(" ")')
    if [ "$KEYS" == "batch_id status" ]; then
       log "✅ [API] /v3/shot/batch-generate matches contract."
    else
       log "❌ [API] /v3/shot/batch-generate MISMATCH. Got: $KEYS"
       exit 1
    fi
else
    log "❌ [API] /v3/shot/batch-generate Request Failed."
    exit 1
fi

# 3. Evidence Hash
log "Generating Evidence Hash..."
( cd "$EVIDENCE_DIR" && echo "PASS" > exitcode && find . -type f | sort | xargs shasum -a 256 > SHA256SUMS.txt )

log "🏆 V3 CONTRACT GATE PASSED."
exit 0
