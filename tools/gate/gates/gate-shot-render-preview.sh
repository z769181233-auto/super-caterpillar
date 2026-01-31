#!/bin/bash
# gate-shot-render-preview.sh
# P13-1: Shot Render 真实预览闭环门禁

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
set -x

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="SHOT_PREVIEW"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/shot_preview_$TS"
mkdir -p "$EVIDENCE_DIR"

# P13-1: Force Mock Provider
export SHOT_RENDER_PROVIDER=mock
export GATE_MODE=1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting P13-1 Shot Render Preview Gate..."

# Auth & Seeding
source tools/gate/lib/gate_auth_seed.sh

generate_headers() {
    local method=$1
    local path=$2
    local body=$3
    node -e "
        const crypto = require('crypto');
        const secret = '$API_SECRET';
        const method = '$method';
        const path = '$path';
        const body = '$body';
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 'nonce_${TS}_' + Math.random().toString(36).substring(7);
        const apiKey = '$VALID_API_KEY_ID';
        // For GET requests with no body, body is empty string.
        // HmacAuthService logic: if body is empty string, hash is sha256('')? Or specific?
        // Usually, if no body, we might skip content-sha256 or hash empty string.
        // We will assume hashing empty string matches backend logic for now.
        const contentSha256 = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
        const payload = apiKey + nonce + timestamp + (body || '');
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        process.stdout.write(\`X-Api-Key: \${apiKey}\n\`);
        process.stdout.write(\`X-Nonce: \${nonce}\n\`);
        process.stdout.write(\`X-Timestamp: \${timestamp}\n\`);
        process.stdout.write(\`X-Content-SHA256: \${contentSha256}\n\`);
        process.stdout.write(\`X-Signature: \${signature}\n\`);
    "
}

# 1. Setup Data
log "--- [PHASE 1] Setup Data ---"
# Seed script already seeded Org/Proj/User/Season/Ep/Scene via PSQL.
# We will create 5 NEW shots in the seeded Scene ($SCENE_ID) via PSQL.
# Note: gate_auth_seed.sh exports SCENE_ID but we need to rely on the environment variables it set.
# Actually, the sourced script EXPORTS them.

log "Using Scene ID: $SCENE_ID"

# 1.5. Configure Mock Engine for SHOT_RENDER (Run ONCE)
# CRITICAL: Disable any existing engine with key 'shot_render' first to avoid conflicts.
psql "$DATABASE_URL" -c "UPDATE engines SET \"isActive\"=false WHERE \"engineKey\"='shot_render';"
psql "$DATABASE_URL" -c "INSERT INTO engines (id, name, code, \"engineKey\", enabled, \"isActive\", mode, \"adapterName\", \"adapterType\", type, config, \"createdAt\", \"updatedAt\") VALUES ('eng_mock_shot_render_${TS}', 'Mock Shot Render', 'mock_shot_render', 'shot_render', true, true, 'process', 'mock', 'mock', 'process', '{}', NOW(), NOW()) ON CONFLICT (code) DO UPDATE SET \"adapterType\"='mock', \"adapterName\"='mock', \"engineKey\"='shot_render', \"isActive\"=true;"

SHOT_IDS=()
for i in {1..5}; do
    # Create Shot via PSQL
    SHOT_TITLE="Gate P13-1 Shot $i"
    ENRICHED="Detailed prompt for shot $i with visual details"
    
    # Using psql to insert. Note quoting for camelCase columns if strictly needed, 
    # but based on schema view, enrichedPrompt is camelCase in Prisma. 
    # In Postgres, if created via Prisma without map, it is usually "enrichedPrompt".
    
    # Create Shot via PSQL
    SHOT_TITLE="Gate P13-1 Shot $i"
    ENRICHED="Detailed prompt for shot $i with visual details"
    
    INSERT_SQL="INSERT INTO shots (id, \"sceneId\", index, type, \"reviewStatus\", \"enrichedPrompt\", \"organizationId\") VALUES (gen_random_uuid(), '$SCENE_ID', $((i+100)), 'MEDIUM_SHOT', 'APPROVED', '$ENRICHED', '$ORG_ID') RETURNING id;"

    SHOT_ID=$(psql "$DATABASE_URL" -t -c "$INSERT_SQL" | grep -v "INSERT" | awk '{print $1}' | xargs)
    
    if [ -z "$SHOT_ID" ]; then
        log "❌ Failed to create shot via PSQL"
        exit 1
    fi
    
    SHOT_IDS+=("$SHOT_ID")
    log "Created Shot $i: $SHOT_ID"
done

# 2. Trigger & Poll Loop (Double Pass)
run_pass() {
    PASS_NUM=$1
    log "--- [PHASE 2] Executing Pass $PASS_NUM ---"
    
    JOB_IDS=()
    for SHOT_ID in "${SHOT_IDS[@]}"; do
        TRACE_ID="gate-p13-1-pass${PASS_NUM}-${SHOT_ID}"
        RUN_ID="run-pass${PASS_NUM}-${SHOT_ID}"
        
        # Insert Job directly to trigger Worker
        JOB_ID=$(psql "$DATABASE_URL" -t -c "INSERT INTO shot_jobs (id, \"projectId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\") VALUES (gen_random_uuid(), '$PROJ_ID', '$SHOT_ID', 'SHOT_RENDER', 'PENDING', '{\"traceId\":\"$TRACE_ID\",\"pipelineRunId\":\"$RUN_ID\",\"projectId\":\"$PROJ_ID\"}', NOW(), NOW(), '$ORG_ID') RETURNING id;" | grep -v "INSERT" | awk '{print $1}' | xargs)
        JOB_IDS+=("$JOB_ID")
        log "Dispatched Job: $JOB_ID"
    done
    
    # Poll
    log "Waiting for completions..."
    for JOB_ID in "${JOB_IDS[@]}"; do
        STATUS="PENDING"
        for r in {1..30}; do
            sleep 2
            STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
            if [ "$STATUS" == "SUCCEEDED" ] || [ "$STATUS" == "FAILED" ]; then break; fi
            echo -ne "."
        done
        echo ""
        if [ "$STATUS" != "SUCCEEDED" ]; then
            log "❌ Job $JOB_ID failed/timeout: $STATUS"
            psql "$DATABASE_URL" -c "SELECT * FROM shot_jobs WHERE id='$JOB_ID';"
            exit 1
        fi
        log "Job $JOB_ID SUCCEEDED"
    done
    
    # Assert
    log "Verifying Results..."
    for i in "${!SHOT_IDS[@]}"; do
        SHOT_ID=${SHOT_IDS[$i]}
        # Check Shot
        ROW=$(psql "$DATABASE_URL" -t -c "SELECT \"render_status\", \"result_image_url\" FROM shots WHERE id='$SHOT_ID';")
        R_STATUS=$(echo "$ROW" | awk -F '|' '{print $1}' | xargs)
        R_URL=$(echo "$ROW" | awk -F '|' '{print $2}' | xargs)
        
        if [ "$R_STATUS" != "COMPLETED" ]; then log "❌ Shot Status: $R_STATUS"; exit 1; fi
        if [ -z "$R_URL" ]; then log "❌ Shot URL empty"; exit 1; fi
        
        # Check Asset
        ASSET_ROW=$(psql "$DATABASE_URL" -t -c "SELECT id, status, checksum FROM assets WHERE \"ownerId\"='$SHOT_ID' AND type='IMAGE';")
        ASSET_STATUS=$(echo "$ASSET_ROW" | awk -F '|' '{print $2}' | xargs)
        CHECKSUM=$(echo "$ASSET_ROW" | awk -F '|' '{print $3}' | xargs)
        
        if [ "$ASSET_STATUS" != "GENERATED" ]; then log "❌ Asset Status: $ASSET_STATUS"; exit 1; fi
        if [ -z "$CHECKSUM" ]; then log "❌ Asset Checksum empty"; exit 1; fi
        
        # Verify URL Access (Internal API)
        # Use storage key from R_URL (which is storageKey)
        KEY="$R_URL"
        PATH_GET="/api/_internal/assets/by-storage-key?key=$KEY"
        
        HEADERS=$(generate_headers "GET" "$PATH_GET" "")
        CURL_H=()
        while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"
        
        RESP_JSON=$(curl -s "${CURL_H[@]}" "${API_URL}${PATH_GET}")
        ACCESS_URL=$(echo "$RESP_JSON" | jq -r '.url')
        
        if [ "$ACCESS_URL" == "null" ] || [ -z "$ACCESS_URL" ]; then
             log "❌ Failed to retrieve Signed URL via Internal API"
             echo "Response: $RESP_JSON"
             exit 1
        fi
        
        # Verify Physical Availability (curl -I)
        HTTP_CODE=$(curl -I -s -o /dev/null -w "%{http_code}" "$ACCESS_URL")
        if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
             log "❌ Access URL not reachable: $HTTP_CODE"
             exit 1
        fi
        
        # FFprobe check (Download first)
        curl -s -L -o "$EVIDENCE_DIR/shot_${PASS_NUM}_$i.png" "$ACCESS_URL"
        RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$EVIDENCE_DIR/shot_${PASS_NUM}_$i.png")
        if [[ ! "$RES" =~ ^[0-9]+x[0-9]+$ ]]; then
             log "❌ FFprobe failed on image: $RES"
             exit 1
        fi
        log "Shot $i: VALID ($RES)"
    done
}

run_pass 1
log "First pass complete. Sleeping 2s..."
sleep 2
run_pass 2

# Final Stats
log "--- [PHASE 3] Finalizing ---"
psql "$DATABASE_URL" -c "SELECT id, \"render_status\", \"result_image_url\" FROM shots WHERE id IN ('${SHOT_IDS[0]}','${SHOT_IDS[1]}','${SHOT_IDS[2]}','${SHOT_IDS[3]}','${SHOT_IDS[4]}');" > "$EVIDENCE_DIR/shots_dump.txt"
psql "$DATABASE_URL" -c "SELECT id, status, checksum, \"storageKey\" FROM assets WHERE \"ownerId\" IN ('${SHOT_IDS[0]}','${SHOT_IDS[1]}','${SHOT_IDS[2]}','${SHOT_IDS[3]}','${SHOT_IDS[4]}') AND type='IMAGE';" > "$EVIDENCE_DIR/assets_dump.txt"

find "$EVIDENCE_DIR" -type f -print0 | xargs -0 sha256sum > "$EVIDENCE_DIR/SHA256SUMS.txt"
log "🏆 P13-1 SHOT RENDER REVIEW PASSED."
exit 0
