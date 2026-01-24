#!/bin/bash
source tools/gate/lib/gate_auth_seed.sh
API_BASE="http://localhost:3000"
sys_token="$VALID_API_KEY_ID"
sys_key="$VALID_API_KEY_ID"
sys_secret="$API_SECRET"

generate_headers() {
  local method="$1"
  local url_path="$2"
  local body_content="$3"
  local timestamp=$(date +%s)
  local nonce="nonce_${timestamp}_$RANDOM"
  local body_hash
  if [ -z "$body_content" ]; then
    body_hash=$(echo -n "" | openssl dgst -sha256 -binary | xxd -p -c 256)
  else
    body_hash=$(echo -n "$body_content" | openssl dgst -sha256 -binary | xxd -p -c 256)
  fi
  local sig_string="${method}${url_path}${timestamp}${nonce}${body_hash}"
  local signature=$(echo -n "$sig_string" | openssl dgst -sha256 -hmac "$sys_secret" -binary | xxd -p -c 256)
  echo "-H \"x-api-key: $sys_key\" -H \"x-timestamp: $timestamp\" -H \"x-nonce: $nonce\" -H \"x-signature: $signature\" -H \"Content-Type: application/json\""
}

# Use seeded shot (Using variables exported by source)
if [ -n "$1" ]; then
  SHOT_ID="$1"
else
  SHOT_ID="$SHOT_ID_1"
fi
echo "Triggering for $SHOT_ID"

BODY="{\"shotId\": \"${SHOT_ID}\", \"traceId\": \"shadow-metric-test\"}"
HEADERS=$(generate_headers "POST" "/api/quality/score" "$BODY")
eval curl -v -X POST "${API_BASE}/api/quality/score" $HEADERS -d \'"$BODY"\'
