#!/usr/bin/env bash
set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[GATE] CE03/CE04 Mother Engine Adoption${NC}"

# 1. 静态扫描非法 Import
echo "[1/3] Static scan for illegal provider imports..."
ILLEGAL_PATTERN="CE04EngineSelector|ShotRenderSelector|@scu/engines-ce04|@scu/engines-shot-render"
if grep -rE "${ILLEGAL_PATTERN}" apps/workers/src/ce-core-processor.ts | grep -v "Original Selector"; then
  echo -e "${RED}[FAIL] Direct provider import detected in ce-core-processor.ts${NC}"
  exit 1
fi
echo -e "${GREEN}[OK] No direct provider imports found.${NC}"

# 2. 真实调用验证
echo "[2/3] Triggering real Hub invocations (HMAC)..."
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_TOKEN="scu_smoke_key"
TEST_SECRET="scu_smoke_secret"

sha256_hex() { shasum -a 256 | awk '{print $1}'; }
hmac_sha256_hex() { local secret="$1"; openssl dgst -sha256 -hmac "$secret" | awk '{print $2}'; }
now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }
make_nonce() { uuidgen | tr '[:upper:]' '[:lower:]'; }

invoke_hub() {
  local engine_key="$1"
  local job_type="$2"
  local path="/api/_internal/engine/invoke"
  local body="{\"engineKey\":\"$engine_key\",\"payload\":{\"projectId\":\"gate-test-proj\"}}"
  
  local ts="$(now_ms)"
  local nonce="$(make_nonce)"
  local body_hash="$(printf '%s' "$body" | sha256_hex)"
  local msg="POST\n$path\n$ts\n$nonce\n$body_hash"
  local sig="$(printf '%b' "$msg" | hmac_sha256_hex "$TEST_SECRET")"

  echo "    API Response for $engine_key:"
  curl -sS "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TEST_TOKEN}" \
    -H "x-timestamp: ${ts}" \
    -H "x-nonce: ${nonce}" \
    -H "x-signature: ${sig}" \
    -d "$body" | jq .
}

echo "  -> Triggering CE04_VISUAL_ENRICHMENT..."
invoke_hub "ce04_visual_enrichment" "CE04_VISUAL_ENRICHMENT"
echo "  -> Triggering SHOT_RENDER..."
invoke_hub "shot_render" "SHOT_RENDER"

echo "  -> Waiting for DB sync..."
sleep 3

# 3. 审计验证 (不再假绿)
echo "[3/3] Verify audit trail via Mother Engine Hub..."
# 注意：API 端的 EngineInvokerHubService 会在 details->request->engineKey 记录原始请求 Key
DB_CHECK=$(psql "${DATABASE_URL}" -t -c "SELECT count(*) FROM audit_logs WHERE action = 'ENGINE_HUB_INVOKE' AND details->'request'->>'engineKey' IN ('ce04_visual_enrichment', 'shot_render');" | xargs)

if [ "${DB_CHECK}" -ge 1 ]; then
    echo -e "${GREEN}[OK] Mother Engine Hub invocation verified (Log count check passed: ${DB_CHECK}).${NC}"
else
    echo -e "${RED}[FAIL] No audit log found for CE03/CE04 Hub invocation (count: ${DB_CHECK}).${NC}"
    exit 1
fi

echo -e "${GREEN}[PASS] Mother Engine adoption locked.${NC}"
