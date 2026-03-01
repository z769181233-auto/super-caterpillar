#!/bin/bash
# gate-ops-feature-flag.sh
# V3 Ops Readiness: Assert feature flags and engine offline protection
# Usage: ./gate-ops-feature-flag.sh

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# ==============================================================================
# Configuration
# ==============================================================================
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="OPS_FEATURE_FLAG"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ops_ff_$TS"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

# ==============================================================================
# 0. Setup
# ==============================================================================
log "Initializing Auth..."
source tools/gate/lib/gate_auth_seed.sh

generate_hmac_headers() {
    local method=$1
    local path=$2
    local body=$3
    local apiKey=$4
    local secret=$5
    node -e "
        const crypto = require('crypto');
        const secret = '$secret';
        const method = '$method';
        const path = '$path';
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 'nonce_${TS}_' + Math.random().toString(36).substring(7);
        const apiKey = '$apiKey';
        const body = '$body';
        const contentSha256 = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
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
# 1. Assert BLOCKED Org (403 Forbidden)
# ==============================================================================
BLOCKED_ORG="blocked_org_$TS"
log "Testing Blocked Org: $BLOCKED_ORG"

# Update seed but use restricted ID in header
PATH_PARSE="/v3/story/parse"
BODY_PARSE="{\"project_id\": \"$PROJ_ID\", \"raw_text\": \"The sun sets.\", \"title\": \"Gate FF\"}"
HEADERS_RAW=$(generate_hmac_headers "POST" "$PATH_PARSE" "$BODY_PARSE" "$VALID_API_KEY_ID" "$API_SECRET")

CURL_HEADERS=()
while IFS= read -r line; do CURL_HEADERS+=(-H "$line"); done <<< "$HEADERS_RAW"
CURL_HEADERS+=(-H "Content-Type: application/json")
CURL_HEADERS+=(-H "x-scu-org-id: $BLOCKED_ORG")

RESP_FILE_403="$EVIDENCE_DIR/resp_403.json"
HTTP_CODE_403=$(curl -s -o "$RESP_FILE_403" -w "%{http_code}" \
    -X POST "$API_URL$PATH_PARSE" \
    "${CURL_HEADERS[@]}" \
    -d "$BODY_PARSE")

log "Response Code (Blocked): $HTTP_CODE_403"
if [ "$HTTP_CODE_403" != "403" ]; then
    log "❌ Failed to block restricted organization (Expected 403, got $HTTP_CODE_403)"
    cat "$RESP_FILE_403"
    exit 1
fi
log "✅ Correctly blocked restricted Org."

# ==============================================================================
# 2. Assert Engine OFFLINE (503 Service Unavailable)
# ==============================================================================
log "Testing Engine Offline Protection (503)..."
log "Disabling 'story_parse' engine in DB..."
psql "$DATABASE_URL" -c "UPDATE engines SET enabled=false WHERE \"engineKey\"='default_novel_analysis';"

HEADERS_RAW_REAL=$(generate_hmac_headers "POST" "$PATH_PARSE" "$BODY_PARSE" "$VALID_API_KEY_ID" "$API_SECRET")
CURL_HEADERS_REAL=()
while IFS= read -r line; do CURL_HEADERS_REAL+=(-H "$line"); done <<< "$HEADERS_RAW_REAL"
CURL_HEADERS_REAL+=(-H "Content-Type: application/json")
CURL_HEADERS_REAL+=(-H "x-scu-org-id: $ORG_ID")

RESP_FILE_503="$EVIDENCE_DIR/resp_503.json"
HTTP_CODE_503=$(curl -s -o "$RESP_FILE_503" -w "%{http_code}" \
    -X POST "$API_URL$PATH_PARSE" \
    "${CURL_HEADERS_REAL[@]}" \
    -d "$BODY_PARSE")

log "Response Code (Offline): $HTTP_CODE_503"
# Restore engine
psql "$DATABASE_URL" -c "UPDATE engines SET enabled=true WHERE \"engineKey\"='default_novel_analysis';"

if [ "$HTTP_CODE_503" != "503" ]; then
    log "❌ Failed to trigger 503 for offline engine (Expected 503, got $HTTP_CODE_503)"
    cat "$RESP_FILE_503"
    exit 1
fi

ERROR_CODE=$(jq -r ".error_code" "$RESP_FILE_503")
if [ "$ERROR_CODE" != "ERR_ENGINE_OFFLINE" ]; then
    log "❌ Incorrect error code for offline engine: $ERROR_CODE"
    exit 1
fi

log "✅ Correctly triggered 503 with ERR_ENGINE_OFFLINE."
log "🏆 OPS FEATURE FLAG PASSED."
exit 0
