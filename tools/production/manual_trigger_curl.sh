
#!/bin/bash
# Manual SHOT_RENDER trigger using curl
# Shot 1: 8649ebe8-f991-4796-ad81-f09314fb5afd

export API_KEY="ak_worker_dev_0000000000000000"
export SECRET="scu_smoke_key"
export WORKER_ID="local-worker"
export TIMESTAMP=$(date +%s)
export NONCE="curl-test-$(date +%s)"
export BODY='{"type":"SHOT_RENDER","payload":{"prompt":"Test Shot 1","traceId":"curl-test"},"organizationId":"org-wangu-prod"}'

# Calculate HMAC (requires openssl)
# Message = apiKey + nonce + timestamp + body
MESSAGE="${API_KEY}${NONCE}${TIMESTAMP}${BODY}"
SIGNATURE=$(echo -n "${MESSAGE}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.* //')
BODY_HASH=$(echo -n "${BODY}" | openssl dgst -sha256 | sed 's/^.* //')

echo "Testing SHOT_RENDER trigger via curl..."
echo "Shot ID: 8649ebe8-f991-4796-ad81-f09314fb5afd"

curl -X POST "http://127.0.0.1:3000/api/shots/8649ebe8-f991-4796-ad81-f09314fb5afd/jobs" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${API_KEY}" \
  -H "X-Timestamp: ${TIMESTAMP}" \
  -H "X-Nonce: ${NONCE}" \
  -H "X-Signature: ${SIGNATURE}" \
  -H "X-Content-SHA256: ${BODY_HASH}" \
  -H "x-worker-id: ${WORKER_ID}" \
  -H "x-organization-id: org-wangu-prod" \
  -d "${BODY}"
