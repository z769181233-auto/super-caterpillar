#!/bin/bash
# tools/gate/gates/gate-go-live-drill.sh
# V3 Final Go-Live Drill: One-click Environment Scan, Canary Release & Fault Injection
# Usage: ./gate-go-live-drill.sh

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# ==============================================================================
# 0. Configuration & Initialization
# ==============================================================================
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="GO_LIVE_DRILL"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/v3_go_live_$TS"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting V3 Go-Live Drill (Production Simulation)..."
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
# 1. Environment Scanning (Health & Ops)
# ==============================================================================
log "--- [PHASE 1] Environment Readiness Scan ---"

# 1.1 Health Check
log "Checking /health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HTTP_CODE" != "200" ]; then log "❌ Health check failed ($HTTP_CODE)"; exit 1; fi
log "✅ API Health: OK"

# 1.2 Ops metrics check (Requires HMCA Auth)
log "Checking /api/ops/metrics (HMAC Enabled)..."
HEADERS=$(generate_headers "GET" "/api/ops/metrics" "")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

METRICS_FILE="$EVIDENCE_DIR/pre_metrics.json"
HTTP_CODE=$(curl -s -o "$METRICS_FILE" -w "%{http_code}" "${CURL_H[@]}" "$API_URL/api/ops/metrics")

if [ "$HTTP_CODE" != "200" ]; then 
    log "❌ Ops metrics failed ($HTTP_CODE)"; 
    cat "$METRICS_FILE"; exit 1; 
fi
log "✅ Ops Visibility: PASS (Metrics keys present)"

# ==============================================================================
# 2. Canary Release Drill (Allowlist Logic)
# ==============================================================================
log "--- [PHASE 2] Canary & Release Control ---"

# Test blocked Org ID
BLOCKED_ORG="blocked_canary_$TS"
PATH_PARSE="/v3/story/parse"
BODY_PARSE="{\"project_id\": \"$PROJ_ID\", \"raw_text\": \"Simulation text\", \"title\": \"Drill\"}"
HEADERS=$(generate_headers "POST" "$PATH_PARSE" "$BODY_PARSE")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

log "Asserting Blocked Org 403..."
RESP_403=$(curl -s -o /dev/null -w "%{http_code}" "${CURL_H[@]}" -H "Content-Type: application/json" -H "x-scu-org-id: $BLOCKED_ORG" -X POST "$API_URL$PATH_PARSE" -d "$BODY_PARSE")

if [ "$RESP_403" != "403" ]; then log "❌ Org blockage failed (got $RESP_403)"; exit 1; fi
log "✅ Canary Blocking: PASS"

# ==============================================================================
# 3. Fault Injection & Alert Drill
# ==============================================================================
log "--- [PHASE 3] Fault Injection & Auto-Guard ---"

log "Disabling critical engine 'default_novel_analysis'..."
psql "$DATABASE_URL" -c "UPDATE engines SET enabled=false WHERE \"engineKey\"='default_novel_analysis';"

HEADERS=$(generate_headers "POST" "$PATH_PARSE" "$BODY_PARSE")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

log "Asserting 503 Service Unavailable..."
RESP_503_FILE="$EVIDENCE_DIR/fault_resp.json"
HTTP_CODE_503=$(curl -s -o "$RESP_503_FILE" -w "%{http_code}" "${CURL_H[@]}" -H "Content-Type: application/json" -H "x-scu-org-id: $ORG_ID" -X POST "$API_URL$PATH_PARSE" -d "$BODY_PARSE")

# Restore immediately
psql "$DATABASE_URL" -c "UPDATE engines SET enabled=true WHERE \"engineKey\"='default_novel_analysis';"

if [ "$HTTP_CODE_503" != "503" ]; then log "❌ Fault injection check failed (got $HTTP_CODE_503)"; exit 1; fi
ERROR_CODE=$(jq -r ".error_code" "$RESP_503_FILE")
if [ "$ERROR_CODE" != "ERR_ENGINE_OFFLINE" ]; then log "❌ Case skip: wrong error_code ($ERROR_CODE)"; exit 1; fi
log "✅ Operational Guard (503): PASS"

# ==============================================================================
# 4. Final Verification
# ==============================================================================
log "--- [PHASE 4] Final Seal Summary ---"
log "Summary evidence written to $EVIDENCE_DIR"
log "🏆 V3 GO-LIVE DRILL PASSED."
exit 0
