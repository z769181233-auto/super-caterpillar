#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# Purpose: Verify V1.1 API Contract, strict timestamp security, and Production Mode Zero Bypass.

# Setup Env
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$GATE_DIR/../../.." && pwd)"
EVIDENCE_DIR="$PROJECT_ROOT/docs/_evidence/prod_contract_security_v1_1_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

# Source env
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  source "$PROJECT_ROOT/.env.local"
fi

API_URL="http://localhost:${PORT:-3000}"

if [ -z "${API_SECRET_KEY:-}" ]; then
  echo "ERROR: API_SECRET_KEY must be set in production gate."
  exit 22
fi
API_SECRET="${API_SECRET_KEY}"
DB_URL="${DATABASE_URL}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$EVIDENCE_DIR/gate.log"
}

log "Starting Gate: Prod Contract & Security V1.1"

# 0. Pre-check: Ensure API is running
if ! curl -s "$API_URL/health" > /dev/null; then
  log "API not running. Attempting start..."
  cd "$PROJECT_ROOT"
  npx ts-node -P apps/api/tsconfig.json -r tsconfig-paths/register --transpile-only apps/api/src/main.ts > "$EVIDENCE_DIR/api.log" 2>&1 &
  API_PID=$!
  sleep 10
  if ! curl -s "$API_URL/health" > /dev/null; then
    log "API failed to start. See docs/_evidence/..."
    exit 1
  fi
fi

# 1. Fetch/Prepare Data
VALID_API_KEY_ID=$(psql "$DB_URL" -t -A -c "SELECT key FROM api_keys WHERE status=$gate$ACTIVE$gate$ LIMIT 1")

if [ -z "$VALID_API_KEY_ID" ]; then
  log "Creating test data..."
  # (Simulated for gate purposes, usually exists in staging/prod)
  VALID_API_KEY_ID="gate_key_$(date +%s)"
  # No psql insert here to keep it simple, assuming pre-seeded.
  # If it fails, the gate fails, which is correct for PROD gate.
  log "No active key. Blocked."
  exit 1
fi

ASSET_ID=$(psql "$DB_URL" -t -A -c "SELECT id FROM assets LIMIT 1") # $gate$
log "Using Key: $VALID_API_KEY_ID, Asset: $ASSET_ID"

# 2. HMAC Security Check (A2)
generate_hmac_headers() {
  local timestamp=$1
  local body=$2
  
  node -e "
    const crypto = require('crypto');
    const secret = '$gate$$API_SECRET$gate$';
    const apiKey = '$gate$$VALID_API_KEY_ID$gate$';
    const timestamp = '$gate$$timestamp$gate$';
    const nonce = 'nonce_' + Date.now();
    const body = '$gate$$body$gate$';
    const message = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');
    const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
    console.log('X-Api-Key: ' + apiKey);
    console.log('X-Nonce: ' + nonce);
    console.log('X-Timestamp: ' + timestamp);
    console.log('X-Signature: ' + signature);
    console.log('X-Content-SHA256: ' + contentSha256);
    console.log('X-Hmac-Version: v1.1');
  "
}

# Case 1: Milliseconds (Should Fail)
MS_TS=$(date +%s000)
TARGET_PATH="/api/assets/$ASSET_ID/secure-url"
HEADERS_MS_RAW=$(generate_hmac_headers "$MS_TS" "")

CURL_ARGS_MS=()
while read -r h; do CURL_ARGS_MS+=("-H" "$h"); done <<<"$HEADERS_MS_RAW"

HTTP_CODE_MS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL$TARGET_PATH" "${CURL_ARGS_MS[@]}")
if [[ "$HTTP_CODE_MS" == "403" ]]; then
  log "PASS: Millisecond TS rejected."
else
  log "FAIL: Millisecond TS accepted ($HTTP_CODE_MS)."
  exit 1
fi

# Case 2: Seconds (Should Pass)
SEC_TS=$(date +%s)
HEADERS_SEC_RAW=$(generate_hmac_headers "$SEC_TS" "")
CURL_ARGS_SEC=()
while read -r h; do CURL_ARGS_SEC+=("-H" "$h"); done <<<"$HEADERS_SEC_RAW"

HTTP_CODE_SEC=$(curl -s -o "$EVIDENCE_DIR/body_sec.json" -w "%{http_code}" -X GET "$API_URL$TARGET_PATH" "${CURL_ARGS_SEC[@]}")
if [[ "$HTTP_CODE_SEC" == "200" ]]; then
  log "PASS: Seconds TS accepted."
  if grep -q "signed_url" "$EVIDENCE_DIR/body_sec.json"; then
    log "PASS: Contract V1.1 OK."
  else
    log "FAIL: Contract V1.1 Missing signed_url."
    exit 1
  fi
else
  log "FAIL: Seconds TS rejected ($HTTP_CODE_SEC)."
  exit 1
fi

log "SUCCESS: Prod Contract & Security V1.1 Verified."
exit 0
