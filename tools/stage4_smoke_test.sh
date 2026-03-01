#!/usr/bin/env bash
set -euo pipefail

# Stage4 Close-MVP smoke test
# Requirements: curl, jq, openssl (for HMAC if needed), psql (optional), docker (optional)
# Env vars (must be provided by caller):
#   API_BASE_URL
#   JWT_TOKEN           # high-privilege JWT (PROJECT_READ/PROJECT_GENERATE)
#   LOW_JWT_TOKEN       # low-privilege JWT (expect 401/403)
#   WORKER_ID           # worker id for HMAC route
#   HMAC_APIKEY         # api key id
#   HMAC_SECRET         # api key secret
#   PROJECT_ID, SCENE_ID, SHOT_ID

api() { curl -s -D /tmp/stage4_headers.txt -w "HTTP_CODE:%{http_code}\n" "$@"; }
auth_hdr() { echo "Authorization: Bearer ${JWT_TOKEN}"; }
low_auth_hdr() { echo "Authorization: Bearer ${LOW_JWT_TOKEN}"; }

require_env() {
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then
      echo "MISSING ENV: $v" >&2
      exit 1
    fi
  done
}

require_env API_BASE_URL JWT_TOKEN LOW_JWT_TOKEN WORKER_ID PROJECT_ID SCENE_ID SHOT_ID HMAC_APIKEY HMAC_SECRET

echo "== Stage4 smoke =="

step() { echo; echo "---- $* ----"; }

step "A) migrate status/deploy (expected already run manually)"
echo "(info only) migrations should have been applied before running this script."

step "B) 6 interfaces (JWT)"
for desc in \
  "GET Scene Semantic|GET|/api/projects/${PROJECT_ID}/scenes/${SCENE_ID}/semantic-enhancement" \
  "POST Scene Semantic|POST|/api/projects/${PROJECT_ID}/scenes/${SCENE_ID}/semantic-enhancement" \
  "GET Shot Planning|GET|/api/projects/${PROJECT_ID}/shots/${SHOT_ID}/shot-planning" \
  "POST Shot Planning|POST|/api/projects/${PROJECT_ID}/shots/${SHOT_ID}/shot-planning" \
  "GET Structure QA|GET|/api/projects/${PROJECT_ID}/structure-quality/report" \
  "POST Structure QA|POST|/api/projects/${PROJECT_ID}/structure-quality/assess"
do
  name="${desc%%|*}"; rest="${desc#*|}"; method="${rest%%|*}"; path="${rest#*|}"
  echo "[${name}] ${method} ${API_BASE_URL}${path}"
  api -X "${method}" -H "$(auth_hdr)" "${API_BASE_URL}${path}" | head -n 20
done

step "C) low-privilege check (expected 401/403)"
api -H "$(low_auth_hdr)" "${API_BASE_URL}/api/projects/${PROJECT_ID}/structure-quality/report" | head -n 20

step "D) HMAC route (workers/:workerId/jobs/next)"
nonce1=$(uuidgen)
ts1=$(date +%s%3N)
body='{}'
sig_payload="${ts1}.${nonce1}.${body}"
sig1=$(printf "%s" "${sig_payload}" | openssl dgst -sha256 -hmac "${HMAC_SECRET}" -binary | base64)
echo "[HMAC valid] POST /api/workers/${WORKER_ID}/jobs/next"
api -X POST \
  -H "X-SCU-APIKEY: ${HMAC_APIKEY}" \
  -H "X-SCU-NONCE: ${nonce1}" \
  -H "X-SCU-TIMESTAMP: ${ts1}" \
  -H "X-SCU-SIGNATURE: ${sig1}" \
  -H "Content-Type: application/json" \
  -d "${body}" \
  "${API_BASE_URL}/api/workers/${WORKER_ID}/jobs/next" | head -n 20

echo "[HMAC replay] reuse same nonce/timestamp/signature"
api -X POST \
  -H "X-SCU-APIKEY: ${HMAC_APIKEY}" \
  -H "X-SCU-NONCE: ${nonce1}" \
  -H "X-SCU-TIMESTAMP: ${ts1}" \
  -H "X-SCU-SIGNATURE: ${sig1}" \
  -H "Content-Type: application/json" \
  -d "${body}" \
  "${API_BASE_URL}/api/workers/${WORKER_ID}/jobs/next" | head -n 20

step "E) audit query (requires psql; optional if not installed)"
if command -v psql >/dev/null 2>&1; then
  psql -h localhost -p 5432 -U postgres -d super_caterpillar_dev -c "\d audit_logs" | head -n 30 || true
  psql -h localhost -p 5432 -U postgres -d super_caterpillar_dev -c "SELECT action, resource_type, resource_id, user_id, created_at FROM audit_logs WHERE action IN ('SEMANTIC_ENHANCEMENT_RUN','SHOT_PLANNING_RUN','STRUCTURE_QA_RUN') ORDER BY created_at DESC LIMIT 10;" || true
else
  echo "psql not installed; skip audit query"
fi

echo "== smoke test complete =="
