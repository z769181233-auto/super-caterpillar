#!/bin/bash
# tools/gate/gates/gate-ce23-identity-consistency.sh
# P13-0 (CE23) Identity Consistency Gate
# Usage: ./gate-ce23-identity-consistency.sh

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# ==============================================================================
# 0. Configuration & Initialization
# ==============================================================================
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="CE23_IDENTITY"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ce23_identity_$TS"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting CE23 Identity Consistency Gate..."
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
        const contentSha256 = body ? crypto.createHash('sha256').update(body, 'utf8').digest('hex') : 'UNSIGNED';
        const payload = apiKey + nonce + timestamp + body;
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        process.stdout.write(\`X-Api-Key: \${apiKey}\n\`);
        process.stdout.write(\`X-Nonce: \${nonce}\n\`);
        process.stdout.write(\`X-Timestamp: \${timestamp}\n\`);
        process.stdout.write(\`X-Content-SHA256: \${contentSha256}\n\`);
        process.stdout.write(\`X-Signature: \${signature}\n\`);
    "
}

# ==============================================================================
# 1. Setup: Create Anchor
# ==============================================================================
log "--- [PHASE 1] Setup Identity Anchor ---"

CHAR_ID="char_ce23_$TS"
ANCHOR_ASSET_ID="asset_anchor_$TS"
MD5_ANCHOR=$(echo -n "$ANCHOR_ASSET_ID" | md5sum | awk '{print $1}')
IDENTITY_HASH="hash_v1_$MD5_ANCHOR"

log "Creating IdentityAnchor in DB..."
psql "$DATABASE_URL" -c "INSERT INTO identity_anchors (project_id, character_id, reference_asset_id, identity_hash) VALUES ('$PROJ_ID', '$CHAR_ID', '$ANCHOR_ASSET_ID', '$IDENTITY_HASH');"

# Get Anchor ID
ANCHOR_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM identity_anchors WHERE character_id='$CHAR_ID' LIMIT 1;" | xargs)
log "Anchor ID: $ANCHOR_ID"

if [ -z "$ANCHOR_ID" ]; then log "❌ Failed to create anchor"; exit 1; fi

# ==============================================================================
# 2. Execution: 5-Shot Loop
# ==============================================================================
log "--- [PHASE 2] 5-Shot Consistency Loop ---"

SCORE_pass_count=0
SCORE_total_count=5

for i in {1..5}; do
    SHOT_ID="shot_ce23_${TS}_$i"
    TARGET_ASSET_ID="asset_ce23_${TS}_$i"
    
    # Call Internal Scoring API
    PATH_SCORE="/api/_internal/ce23/score-and-record"
    BODY_SCORE="{\"projectId\": \"$PROJ_ID\", \"characterId\": \"$CHAR_ID\", \"referenceAssetId\": \"$ANCHOR_ASSET_ID\", \"targetAssetId\": \"$TARGET_ASSET_ID\", \"shotId\": \"$SHOT_ID\", \"referenceAnchorId\": \"$ANCHOR_ID\"}"
    
    HEADERS=$(generate_headers "POST" "$PATH_SCORE" "$BODY_SCORE")
    CURL_H=()
    while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"
    
    RESP_FILE="$EVIDENCE_DIR/score_resp_$i.json"
    HTTP_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" "${CURL_H[@]}" -H "Content-Type: application/json" -X POST "$API_URL$PATH_SCORE" -d "$BODY_SCORE")
    
    if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "200" ]; then
        log "❌ API Call Failed ($HTTP_CODE)"
        cat "$RESP_FILE"
        exit 1
    fi
    
    SCORE=$(jq -r ".score" "$RESP_FILE")
    VERDICT=$(jq -r ".verdict" "$RESP_FILE")
    log "Shot $i: Score=$SCORE Verdict=$VERDICT"
    
    # Assert > 0.85
    if (( $(echo "$SCORE > 0.85" | bc -l) )); then
        ((SCORE_pass_count++))
    else
        log "❌ Shot $i Score too low: $SCORE"
    fi
done

if [ "$SCORE_pass_count" -ne "$SCORE_total_count" ]; then
    log "❌ Consistency Check Failed: Only $SCORE_pass_count/$SCORE_total_count passed."
    exit 1
fi
log "✅ All 5 shots passed consistency threshold (>0.85)."

# ==============================================================================
# 3. Audit: Database Verification
# ==============================================================================
log "--- [PHASE 3] Database Audit ---"

DB_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM shot_identity_scores WHERE reference_anchor_id='$ANCHOR_ID';" | xargs)
log "DB Records Found: $DB_COUNT"

if [ "$DB_COUNT" -ne "5" ]; then
    log "❌ DB Audit Failed: Expected 5 records, found $DB_COUNT."
    exit 1
fi

# Dump Evidence
psql "$DATABASE_URL" -c "SELECT * FROM shot_identity_scores WHERE reference_anchor_id='$ANCHOR_ID';" > "$EVIDENCE_DIR/db_dump.txt"

# ==============================================================================
# 4. Final Seal
# ==============================================================================
log "--- [PHASE 4] Evidence Packaging ---"
find "$EVIDENCE_DIR" -type f -print0 | xargs -0 sha256sum > "$EVIDENCE_DIR/SHA256SUMS.txt"
log "🏆 CE23 IDENTITY CONSISTENCY PASSED."
exit 0
