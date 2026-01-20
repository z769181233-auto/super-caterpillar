#!/bin/bash
# gate-ops-metrics-smoke.sh
# V3 Ops Readiness: Assert metrics endpoint health & structure
# Usage: ./gate-ops-metrics-smoke.sh

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="OPS_METRICS_SMOKE"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ops_metrics_smoke_$TS"
mkdir -p "$EVIDENCE_DIR"

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

# ==============================================================================
# 1. Environment & Auth Setup
# ==============================================================================
log "Initializing Auth & Seed..."
source tools/gate/lib/gate_auth_seed.sh

# ==============================================================================
# 2. Execution & Assertion
# ==============================================================================
log "Fetching Ops Metrics via GET /api/ops/metrics..."

METRICS_PATH="/api/ops/metrics"
# Use HMAC headers via common tool logic or direct curl if token available
# For OPS, we use the VALID_API_KEY_ID from seed.
HEADERS_RAW=$(node -e "
    const crypto = require('crypto');
    const secret = '$API_SECRET';
    const method = 'GET';
    const path = '$METRICS_PATH';
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 'nonce_${TS}';
    const apiKey = '$VALID_API_KEY_ID';
    const body = '';
    const contentSha256 = 'UNSIGNED'; // GET requests
    const payload = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    process.stdout.write(\`X-Api-Key: \${apiKey}\n\`);
    process.stdout.write(\`X-Nonce: \${nonce}\n\`);
    process.stdout.write(\`X-Timestamp: \${timestamp}\n\`);
    process.stdout.write(\`X-Content-SHA256: \${contentSha256}\n\`);
    process.stdout.write(\`X-Signature: \${signature}\n\`);
")

CURL_HEADERS=()
while IFS= read -r line; do CURL_HEADERS+=(-H "$line"); done <<< "$HEADERS_RAW"

RESP_FILE="$EVIDENCE_DIR/metrics_resp.json"
HTTP_CODE=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
    "$API_URL$METRICS_PATH" \
    "${CURL_HEADERS[@]}")

log "API Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
    log "❌ Metrics Endpoint Failed with HTTP $HTTP_CODE"
    cat "$RESP_FILE"
    exit 1
fi

# Assert JSON Structure (Key check)
log "Validating Metric Keys..."
REQUIRED_KEYS=("job_success_rate_15m" "job_counts_by_type" "queue_depth" "oldest_pending_age_ms" "published_assets_24h" "cost_by_engineKey_24h")

for key in "${REQUIRED_KEYS[@]}"; do
    VAL=$(jq -r ".$key" "$RESP_FILE")
    if [ "$VAL" == "null" ]; then
        log "❌ Missing required metric key: $key"
        exit 1
    fi
    log "  ✅ Found $key: $VAL"
done

# Assert Data Types
log "Validating Metric Data Types..."
SUCCESS_RATE=$(jq -r ".job_success_rate_15m" "$RESP_FILE")
if ! [[ "$SUCCESS_RATE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    log "❌ Success Rate is not a number: $SUCCESS_RATE"
    exit 1
fi

log "🏆 OPS METRICS SMOKE PASSED."
exit 0
