#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Gate: CE01 Protocol Instantiation# - 实例化调用
# - 产生 referenceSheetId
# - 幂等复用验证
# - JobEngineBinding 元数据完整性


# macOS 兼容的 HMAC 计算工具
sha256_hex() {
  # stdin -> sha256 hex (lowercase)
  shasum -a 256 | awk }

hmac_sha256_hex() {
  # $1=secret, stdin=message -> hmac-sha256 hex
  local secret="$1"
  openssl dgst -sha256 -hmac "$secret" | awk }

make_nonce() {
  # macOS 自带 uuidgen
  uuidgen | tr }

now_ms() {
  # macOS date 没有 %3N，用 python 保底
  python3 - <<import time
print(int(time.time()*1000))
PY
}

# 统一构造签名头 (HMAC V1)
build_hmac_headers() {
  local method="$1"
  local path="$2"
  local body="$3"

  local ts nonce body_hash msg sig
  ts="$(now_ms)"
  nonce="$(make_nonce)"

  # body_hash 必须基于 body 原始字节；空串也要算
  body_hash="$(printf 
  # V1 message: method\npath\ntimestamp\nnonce\nbodyHash
  msg="${method}\n${path}\n${ts}\n${nonce}\n${body_hash}"

  sig="$(printf 
  # 输出给调用方：ts nonce sig
  echo "$ts" "$nonce" "$sig"
}

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TEST_TOKEN="${TEST_TOKEN}"
PROJECT_ID="${CE01_TEST_PROJECT_ID}"
CHARACTER_ID="${CE01_TEST_CHARACTER_ID}"

if [[ -z "$TEST_TOKEN" ]]; then
  echo "❌ TEST_TOKEN not set"
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ CE01_TEST_PROJECT_ID not set"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "=================================================="
echo "Gate: CE01 Protocol Instantiation (HMAC V1)"
echo "=================================================="
echo "API: $BASE_URL"
echo "Project: $PROJECT_ID"
echo "Character: $CHARACTER_ID"
echo ""

# ============================================
# STEP 0: HMAC Ping 自检
# ============================================
echo "[STEP 0] HMAC PING 自检"
PING_PATH="/api/_internal/hmac-ping"
PING_BODY=""
read -r PING_TS PING_NONCE PING_SIG <<<"$(build_hmac_headers "GET" "$PING_PATH" "$PING_BODY")"

PING_RESP="$(curl -sS -i "${BASE_URL}${PING_PATH}" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${PING_TS}" \
  -H "x-nonce: ${PING_NONCE}" \
  -H "x-signature: ${PING_SIG}" \
  | head -n 30
)"

echo "$PING_RESP" | head -n 30
if ! echo "$PING_RESP" | grep -qE   echo "❌ HMAC PING FAILED (Path: $PING_PATH)"
  exit 1
fi
echo "✅ HMAC PING SUCCESSFUL"
echo ""

# ============================================
# STEP 1: 第一次实例化调用
# ============================================
echo "[STEP 1] 调用 CE01 实例化接口 (第一次)"
INSTANTIATE_PATH="/api/jobs/ce01/instantiate"
BODY="$(printf 
read -r TS NONCE SIG <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_1=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS}" \
  -H "x-nonce: ${NONCE}" \
  -H "x-signature: ${SIG}" \
  -d "$BODY")

echo "Response: $RESPONSE_1"

# 提取 referenceSheetId
REF_SHEET_ID_1=$(echo "$RESPONSE_1" | jq -r FINGERPRINT_1=$(echo "$RESPONSE_1" | jq -r ENGINE_KEY_1=$(echo "$RESPONSE_1" | jq -r 
if [[ -z "$REF_SHEET_ID_1" ]]; then
  echo "❌ STEP 1 FAILED: No referenceSheetId returned"
  exit 1
fi

echo "✅ STEP 1 PASSED: referenceSheetId=$REF_SHEET_ID_1"
echo "   Fingerprint: $FINGERPRINT_1"
echo "   EngineKey: $ENGINE_KEY_1"
echo ""

# ============================================
# STEP 2: 验证 JobEngineBinding 存在
# ============================================
echo "[STEP 2] 验证 JobEngineBinding 记录存在"
DB_COUNT=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT COUNT(*) FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "0")

DB_COUNT=$(echo "$DB_COUNT" | xargs)

if [[ "$DB_COUNT" != "1" ]]; then
  echo "❌ STEP 2 FAILED: JobEngineBinding not found (count=$DB_COUNT)"
  exit 1
fi

echo "✅ STEP 2 PASSED: JobEngineBinding exists"
echo ""

# ============================================
# STEP 3: 验证 metadata 包含 fingerprint
# ============================================
echo "[STEP 3] 验证 JobEngineBinding.metadata 包含 fingerprint"
METADATA=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT metadata::text FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "{}")

METADATA=$(echo "$METADATA" | xargs)

if [[ ! "$METADATA" =~ "$FINGERPRINT_1" ]]; then
  echo "❌ STEP 3 FAILED: metadata does not contain fingerprint"
  echo "   Metadata: $METADATA"
  exit 1
fi

echo "✅ STEP 3 PASSED: Metadata contains fingerprint"
echo ""

# ============================================
# STEP 4: 幂等性验证 (第二次调用)
# ============================================
echo "[STEP 4] 调用 CE01 实例化接口 (第二次，验证幂等)"
read -r TS2 NONCE2 SIG2 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_2=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS2}" \
  -H "x-nonce: ${NONCE2}" \
  -H "x-signature: ${SIG2}" \
  -d "$BODY")

echo "Response: $RESPONSE_2"

REF_SHEET_ID_2=$(echo "$RESPONSE_2" | jq -r 
if [[ "$REF_SHEET_ID_1" != "$REF_SHEET_ID_2" ]]; then
  echo "❌ STEP 4 FAILED: Idempotency broken (ID changed)"
  echo "   First:  $REF_SHEET_ID_1"
  echo "   Second: $REF_SHEET_ID_2"
  exit 1
fi

echo "✅ STEP 4 PASSED: Idempotency verified (same ID returned)"
echo ""

# ============================================
# STEP 5: 验证新参数产生新实例
# ============================================
echo "[STEP 5] 调用 CE01 实例化接口 (不同参数，应产生新 ID)"
BODY3="$(printf read -r TS3 NONCE3 SIG3 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY3")"

RESPONSE_3=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS3}" \
  -H "x-nonce: ${NONCE3}" \
  -H "x-signature: ${SIG3}" \
  -d "$BODY3")

REF_SHEET_ID_3=$(echo "$RESPONSE_3" | jq -r 
if [[ "$REF_SHEET_ID_1" == "$REF_SHEET_ID_3" ]]; then
  echo "❌ STEP 5 FAILED: New parameters did not produce new ID"
  exit 1
fi

echo "✅ STEP 5 PASSED: Different parameters => different ID"
echo "   Original: $REF_SHEET_ID_1"
echo "   New:      $REF_SHEET_ID_3"
echo ""

# ============================================
# STEP 6: E4 下游拦截 - 缺 referenceSheetId 被拒绝
# ============================================
echo "[STEP 6] E4: 验证缺 referenceSheetId 的 SHOT_RENDER 被拒绝"
SHOT_ID="00000000-0000-0000-0000-000000000099"
JOBS_PATH="/api/shots/$SHOT_ID/jobs"
JOBS_BODY=
read -r TS4 NONCE4 SIG4 <<<"$(build_hmac_headers "POST" "$JOBS_PATH" "$JOBS_BODY")"

REJECT_RESPONSE=$(curl -sS -i "${BASE_URL}${JOBS_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS4}" \
  -H "x-nonce: ${NONCE4}" \
  -H "x-signature: ${SIG4}" \
  -d "$JOBS_BODY")

# 提取 HTTP Code
HTTP_CODE=$(echo "$REJECT_RESPONSE" | head -n1 | awk BODY=$(echo "$REJECT_RESPONSE" | sed 
if [[ "$HTTP_CODE" != "400" && "$HTTP_CODE" != "422" ]]; then
  echo "❌ STEP 6 FAILED: Expected 400/422, got $HTTP_CODE"
  echo "   Body: $BODY"
  exit 1
fi

ERROR_CODE=$(echo "$BODY" | jq -r if [[ "$ERROR_CODE" != "REFERENCE_SHEET_REQUIRED" ]]; then
  echo "❌ STEP 6 FAILED: Expected error code REFERENCE_SHEET_REQUIRED, got $ERROR_CODE"
  echo "   Body: $BODY"
  exit 1
fi

echo "✅ STEP 6 PASSED: Missing referenceSheetId correctly rejected (HTTP $HTTP_CODE, code=$ERROR_CODE)"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "=================================================="
echo "✅ CE01 PROTOCOL INSTANTIATION GATE PASSED"
echo "=================================================="
echo "验证项："
echo "  ✓ HMAC Ping 自检通过"
echo "  ✓ 实例化调用成功"
echo "  ✓ referenceSheetId 生成"
echo "  ✓ JobEngineBinding 记录存在"
echo "  ✓ Metadata 包含 fingerprint"
echo "  ✓ 幂等性验证通过"
echo "  ✓ 新参数产生新实例"
echo "  ✓ E4 下游拦截：缺 referenceSheetId 被拒绝"
echo ""
echo "Sealed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

exit 0

# macOS 兼容的 HMAC 计算工具
sha256_hex() {
  # stdin -> sha256 hex (lowercase)
  shasum -a 256 | awk }

hmac_sha256_hex() {
  # $1=secret, stdin=message -> hmac-sha256 hex
  local secret="$1"
  openssl dgst -sha256 -hmac "$secret" | awk }

make_nonce() {
  # macOS 自带 uuidgen
  uuidgen | tr }

now_ms() {
  # macOS date 没有 %3N，用 python 保底
  python3 - <<import time
print(int(time.time()*1000))
PY
}

# 统一构造签名头 (HMAC V1)
build_hmac_headers() {
  local method="$1"
  local path="$2"
  local body="$3"

  local ts nonce body_hash msg sig
  ts="$(now_ms)"
  nonce="$(make_nonce)"

  # body_hash 必须基于 body 原始字节；空串也要算
  body_hash="$(printf 
  # V1 message: method\npath\ntimestamp\nnonce\nbodyHash
  msg="${method}\n${path}\n${ts}\n${nonce}\n${body_hash}"

  sig="$(printf 
  # 输出给调用方：ts nonce sig
  echo "$ts" "$nonce" "$sig"
}

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TEST_TOKEN="${TEST_TOKEN}"
PROJECT_ID="${CE01_TEST_PROJECT_ID}"
CHARACTER_ID="${CE01_TEST_CHARACTER_ID}"

if [[ -z "$TEST_TOKEN" ]]; then
  echo "❌ TEST_TOKEN not set"
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ CE01_TEST_PROJECT_ID not set"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "=================================================="
echo "Gate: CE01 Protocol Instantiation (HMAC V1)"
echo "=================================================="
echo "API: $BASE_URL"
echo "Project: $PROJECT_ID"
echo "Character: $CHARACTER_ID"
echo ""

# ============================================
# STEP 0: HMAC Ping 自检
# ============================================
echo "[STEP 0] HMAC PING 自检"
PING_PATH="/api/_internal/hmac-ping"
PING_BODY=""
read -r PING_TS PING_NONCE PING_SIG <<<"$(build_hmac_headers "GET" "$PING_PATH" "$PING_BODY")"

PING_RESP="$(curl -sS -i "${BASE_URL}${PING_PATH}" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${PING_TS}" \
  -H "x-nonce: ${PING_NONCE}" \
  -H "x-signature: ${PING_SIG}" \
  | head -n 30
)"

echo "$PING_RESP" | head -n 30
if ! echo "$PING_RESP" | grep -qE   echo "❌ HMAC PING FAILED (Path: $PING_PATH)"
  exit 1
fi
echo "✅ HMAC PING SUCCESSFUL"
echo ""

# ============================================
# STEP 1: 第一次实例化调用
# ============================================
echo "[STEP 1] 调用 CE01 实例化接口 (第一次)"
INSTANTIATE_PATH="/api/jobs/ce01/instantiate"
BODY="$(printf 
read -r TS NONCE SIG <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_1=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS}" \
  -H "x-nonce: ${NONCE}" \
  -H "x-signature: ${SIG}" \
  -d "$BODY")

echo "Response: $RESPONSE_1"

# 提取 referenceSheetId
REF_SHEET_ID_1=$(echo "$RESPONSE_1" | jq -r FINGERPRINT_1=$(echo "$RESPONSE_1" | jq -r ENGINE_KEY_1=$(echo "$RESPONSE_1" | jq -r 
if [[ -z "$REF_SHEET_ID_1" ]]; then
  echo "❌ STEP 1 FAILED: No referenceSheetId returned"
  exit 1
fi

echo "✅ STEP 1 PASSED: referenceSheetId=$REF_SHEET_ID_1"
echo "   Fingerprint: $FINGERPRINT_1"
echo "   EngineKey: $ENGINE_KEY_1"
echo ""

# ============================================
# STEP 2: 验证 JobEngineBinding 存在
# ============================================
echo "[STEP 2] 验证 JobEngineBinding 记录存在"
DB_COUNT=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT COUNT(*) FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "0")

DB_COUNT=$(echo "$DB_COUNT" | xargs)

if [[ "$DB_COUNT" != "1" ]]; then
  echo "❌ STEP 2 FAILED: JobEngineBinding not found (count=$DB_COUNT)"
  exit 1
fi

echo "✅ STEP 2 PASSED: JobEngineBinding exists"
echo ""

# ============================================
# STEP 3: 验证 metadata 包含 fingerprint
# ============================================
echo "[STEP 3] 验证 JobEngineBinding.metadata 包含 fingerprint"
METADATA=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT metadata::text FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "{}")

METADATA=$(echo "$METADATA" | xargs)

if [[ ! "$METADATA" =~ "$FINGERPRINT_1" ]]; then
  echo "❌ STEP 3 FAILED: metadata does not contain fingerprint"
  echo "   Metadata: $METADATA"
  exit 1
fi

echo "✅ STEP 3 PASSED: Metadata contains fingerprint"
echo ""

# ============================================
# STEP 4: 幂等性验证 (第二次调用)
# ============================================
echo "[STEP 4] 调用 CE01 实例化接口 (第二次，验证幂等)"
read -r TS2 NONCE2 SIG2 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_2=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS2}" \
  -H "x-nonce: ${NONCE2}" \
  -H "x-signature: ${SIG2}" \
  -d "$BODY")

echo "Response: $RESPONSE_2"

REF_SHEET_ID_2=$(echo "$RESPONSE_2" | jq -r 
if [[ "$REF_SHEET_ID_1" != "$REF_SHEET_ID_2" ]]; then
  echo "❌ STEP 4 FAILED: Idempotency broken (ID changed)"
  echo "   First:  $REF_SHEET_ID_1"
  echo "   Second: $REF_SHEET_ID_2"
  exit 1
fi

echo "✅ STEP 4 PASSED: Idempotency verified (same ID returned)"
echo ""

# ============================================
# STEP 5: 验证新参数产生新实例
# ============================================
echo "[STEP 5] 调用 CE01 实例化接口 (不同参数，应产生新 ID)"
BODY3="$(printf read -r TS3 NONCE3 SIG3 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY3")"

RESPONSE_3=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS3}" \
  -H "x-nonce: ${NONCE3}" \
  -H "x-signature: ${SIG3}" \
  -d "$BODY3")

REF_SHEET_ID_3=$(echo "$RESPONSE_3" | jq -r 
if [[ "$REF_SHEET_ID_1" == "$REF_SHEET_ID_3" ]]; then
  echo "❌ STEP 5 FAILED: New parameters did not produce new ID"
  exit 1
fi

echo "✅ STEP 5 PASSED: Different parameters => different ID"
echo "   Original: $REF_SHEET_ID_1"
echo "   New:      $REF_SHEET_ID_3"
echo ""

# ============================================
# STEP 6: E4 下游拦截 - 缺 referenceSheetId 被拒绝
# ============================================
echo "[STEP 6] E4: 验证缺 referenceSheetId 的 SHOT_RENDER 被拒绝"
SHOT_ID="00000000-0000-0000-0000-000000000099"
JOBS_PATH="/api/shots/$SHOT_ID/jobs"
JOBS_BODY=
read -r TS4 NONCE4 SIG4 <<<"$(build_hmac_headers "POST" "$JOBS_PATH" "$JOBS_BODY")"

REJECT_RESPONSE=$(curl -sS -i "${BASE_URL}${JOBS_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS4}" \
  -H "x-nonce: ${NONCE4}" \
  -H "x-signature: ${SIG4}" \
  -d "$JOBS_BODY")

# 提取 HTTP Code
HTTP_CODE=$(echo "$REJECT_RESPONSE" | head -n1 | awk BODY=$(echo "$REJECT_RESPONSE" | sed 
if [[ "$HTTP_CODE" != "400" && "$HTTP_CODE" != "422" ]]; then
  echo "❌ STEP 6 FAILED: Expected 400/422, got $HTTP_CODE"
  echo "   Body: $BODY"
  exit 1
fi

ERROR_CODE=$(echo "$BODY" | jq -r if [[ "$ERROR_CODE" != "REFERENCE_SHEET_REQUIRED" ]]; then
  echo "❌ STEP 6 FAILED: Expected error code REFERENCE_SHEET_REQUIRED, got $ERROR_CODE"
  echo "   Body: $BODY"
  exit 1
fi

echo "✅ STEP 6 PASSED: Missing referenceSheetId correctly rejected (HTTP $HTTP_CODE, code=$ERROR_CODE)"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "=================================================="
echo "✅ CE01 PROTOCOL INSTANTIATION GATE PASSED"
echo "=================================================="
echo "验证项："
echo "  ✓ HMAC Ping 自检通过"
echo "  ✓ 实例化调用成功"
echo "  ✓ referenceSheetId 生成"
echo "  ✓ JobEngineBinding 记录存在"
echo "  ✓ Metadata 包含 fingerprint"
echo "  ✓ 幂等性验证通过"
echo "  ✓ 新参数产生新实例"
echo "  ✓ E4 下游拦截：缺 referenceSheetId 被拒绝"
echo ""
echo "Sealed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

exit 0

# macOS 兼容的 HMAC 计算工具
sha256_hex() {
  # stdin -> sha256 hex (lowercase)
  shasum -a 256 | awk }

hmac_sha256_hex() {
  # $1=secret, stdin=message -> hmac-sha256 hex
  local secret="$1"
  openssl dgst -sha256 -hmac "$secret" | awk }

make_nonce() {
  # macOS 自带 uuidgen
  uuidgen | tr }

now_ms() {
  # macOS date 没有 %3N，用 python 保底
  python3 - <<import time
print(int(time.time()*1000))
PY
}

# 统一构造签名头 (HMAC V1)
build_hmac_headers() {
  local method="$1"
  local path="$2"
  local body="$3"

  local ts nonce body_hash msg sig
  ts="$(now_ms)"
  nonce="$(make_nonce)"

  # body_hash 必须基于 body 原始字节；空串也要算
  body_hash="$(printf 
  # V1 message: method\npath\ntimestamp\nnonce\nbodyHash
  msg="${method}\n${path}\n${ts}\n${nonce}\n${body_hash}"

  sig="$(printf 
  # 输出给调用方：ts nonce sig
  echo "$ts" "$nonce" "$sig"
}

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TEST_TOKEN="${TEST_TOKEN}"
PROJECT_ID="${CE01_TEST_PROJECT_ID}"
CHARACTER_ID="${CE01_TEST_CHARACTER_ID}"

if [[ -z "$TEST_TOKEN" ]]; then
  echo "❌ TEST_TOKEN not set"
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ CE01_TEST_PROJECT_ID not set"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "=================================================="
echo "Gate: CE01 Protocol Instantiation (HMAC V1)"
echo "=================================================="
echo "API: $BASE_URL"
echo "Project: $PROJECT_ID"
echo "Character: $CHARACTER_ID"
echo ""

# ============================================
# STEP 0: HMAC Ping 自检
# ============================================
echo "[STEP 0] HMAC PING 自检"
PING_PATH="/api/_internal/hmac-ping"
PING_BODY=""
read -r PING_TS PING_NONCE PING_SIG <<<"$(build_hmac_headers "GET" "$PING_PATH" "$PING_BODY")"

PING_RESP="$(curl -sS -i "${BASE_URL}${PING_PATH}" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${PING_TS}" \
  -H "x-nonce: ${PING_NONCE}" \
  -H "x-signature: ${PING_SIG}" \
  | head -n 30
)"

echo "$PING_RESP" | head -n 30
if ! echo "$PING_RESP" | grep -qE   echo "❌ HMAC PING FAILED (Path: $PING_PATH)"
  exit 1
fi
echo "✅ HMAC PING SUCCESSFUL"
echo ""

# ============================================
# STEP 1: 第一次实例化调用
# ============================================
echo "[STEP 1] 调用 CE01 实例化接口 (第一次)"
INSTANTIATE_PATH="/api/jobs/ce01/instantiate"
BODY="$(printf 
read -r TS NONCE SIG <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_1=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS}" \
  -H "x-nonce: ${NONCE}" \
  -H "x-signature: ${SIG}" \
  -d "$BODY")

echo "Response: $RESPONSE_1"

# 提取 referenceSheetId
REF_SHEET_ID_1=$(echo "$RESPONSE_1" | jq -r FINGERPRINT_1=$(echo "$RESPONSE_1" | jq -r ENGINE_KEY_1=$(echo "$RESPONSE_1" | jq -r 
if [[ -z "$REF_SHEET_ID_1" ]]; then
  echo "❌ STEP 1 FAILED: No referenceSheetId returned"
  exit 1
fi

echo "✅ STEP 1 PASSED: referenceSheetId=$REF_SHEET_ID_1"
echo "   Fingerprint: $FINGERPRINT_1"
echo "   EngineKey: $ENGINE_KEY_1"
echo ""

# ============================================
# STEP 2: 验证 JobEngineBinding 存在
# ============================================
echo "[STEP 2] 验证 JobEngineBinding 记录存在"
DB_COUNT=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT COUNT(*) FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "0")

DB_COUNT=$(echo "$DB_COUNT" | xargs)

if [[ "$DB_COUNT" != "1" ]]; then
  echo "❌ STEP 2 FAILED: JobEngineBinding not found (count=$DB_COUNT)"
  exit 1
fi

echo "✅ STEP 2 PASSED: JobEngineBinding exists"
echo ""

# ============================================
# STEP 3: 验证 metadata 包含 fingerprint
# ============================================
echo "[STEP 3] 验证 JobEngineBinding.metadata 包含 fingerprint"
METADATA=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT metadata::text FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "{}")

METADATA=$(echo "$METADATA" | xargs)

if [[ ! "$METADATA" =~ "$FINGERPRINT_1" ]]; then
  echo "❌ STEP 3 FAILED: metadata does not contain fingerprint"
  echo "   Metadata: $METADATA"
  exit 1
fi

echo "✅ STEP 3 PASSED: Metadata contains fingerprint"
echo ""

# ============================================
# STEP 4: 幂等性验证 (第二次调用)
# ============================================
echo "[STEP 4] 调用 CE01 实例化接口 (第二次，验证幂等)"
read -r TS2 NONCE2 SIG2 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_2=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS2}" \
  -H "x-nonce: ${NONCE2}" \
  -H "x-signature: ${SIG2}" \
  -d "$BODY")

echo "Response: $RESPONSE_2"

REF_SHEET_ID_2=$(echo "$RESPONSE_2" | jq -r 
if [[ "$REF_SHEET_ID_1" != "$REF_SHEET_ID_2" ]]; then
  echo "❌ STEP 4 FAILED: Idempotency broken (ID changed)"
  echo "   First:  $REF_SHEET_ID_1"
  echo "   Second: $REF_SHEET_ID_2"
  exit 1
fi

echo "✅ STEP 4 PASSED: Idempotency verified (same ID returned)"
echo ""

# ============================================
# STEP 5: 验证新参数产生新实例
# ============================================
echo "[STEP 5] 调用 CE01 实例化接口 (不同参数，应产生新 ID)"
BODY3="$(printf read -r TS3 NONCE3 SIG3 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY3")"

RESPONSE_3=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS3}" \
  -H "x-nonce: ${NONCE3}" \
  -H "x-signature: ${SIG3}" \
  -d "$BODY3")

REF_SHEET_ID_3=$(echo "$RESPONSE_3" | jq -r 
if [[ "$REF_SHEET_ID_1" == "$REF_SHEET_ID_3" ]]; then
  echo "❌ STEP 5 FAILED: New parameters did not produce new ID"
  exit 1
fi

echo "✅ STEP 5 PASSED: Different parameters => different ID"
echo "   Original: $REF_SHEET_ID_1"
echo "   New:      $REF_SHEET_ID_3"
echo ""

# ============================================
# STEP 6: E4 下游拦截 - 缺 referenceSheetId 被拒绝
# ============================================
echo "[STEP 6] E4: 验证缺 referenceSheetId 的 SHOT_RENDER 被拒绝"
SHOT_ID="00000000-0000-0000-0000-000000000099"
JOBS_PATH="/api/shots/$SHOT_ID/jobs"
JOBS_BODY=
read -r TS4 NONCE4 SIG4 <<<"$(build_hmac_headers "POST" "$JOBS_PATH" "$JOBS_BODY")"

REJECT_RESPONSE=$(curl -sS -i "${BASE_URL}${JOBS_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS4}" \
  -H "x-nonce: ${NONCE4}" \
  -H "x-signature: ${SIG4}" \
  -d "$JOBS_BODY")

# 提取 HTTP Code
HTTP_CODE=$(echo "$REJECT_RESPONSE" | head -n1 | awk BODY=$(echo "$REJECT_RESPONSE" | sed 
if [[ "$HTTP_CODE" != "400" && "$HTTP_CODE" != "422" ]]; then
  echo "❌ STEP 6 FAILED: Expected 400/422, got $HTTP_CODE"
  echo "   Body: $BODY"
  exit 1
fi

ERROR_CODE=$(echo "$BODY" | jq -r if [[ "$ERROR_CODE" != "REFERENCE_SHEET_REQUIRED" ]]; then
  echo "❌ STEP 6 FAILED: Expected error code REFERENCE_SHEET_REQUIRED, got $ERROR_CODE"
  echo "   Body: $BODY"
  exit 1
fi

echo "✅ STEP 6 PASSED: Missing referenceSheetId correctly rejected (HTTP $HTTP_CODE, code=$ERROR_CODE)"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "=================================================="
echo "✅ CE01 PROTOCOL INSTANTIATION GATE PASSED"
echo "=================================================="
echo "验证项："
echo "  ✓ HMAC Ping 自检通过"
echo "  ✓ 实例化调用成功"
echo "  ✓ referenceSheetId 生成"
echo "  ✓ JobEngineBinding 记录存在"
echo "  ✓ Metadata 包含 fingerprint"
echo "  ✓ 幂等性验证通过"
echo "  ✓ 新参数产生新实例"
echo "  ✓ E4 下游拦截：缺 referenceSheetId 被拒绝"
echo ""
echo "Sealed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

exit 0

# macOS 兼容的 HMAC 计算工具
sha256_hex() {
  # stdin -> sha256 hex (lowercase)
  shasum -a 256 | awk }

hmac_sha256_hex() {
  # $1=secret, stdin=message -> hmac-sha256 hex
  local secret="$1"
  openssl dgst -sha256 -hmac "$secret" | awk }

make_nonce() {
  # macOS 自带 uuidgen
  uuidgen | tr }

now_ms() {
  # macOS date 没有 %3N，用 python 保底
  python3 - <<import time
print(int(time.time()*1000))
PY
}

# 统一构造签名头 (HMAC V1)
build_hmac_headers() {
  local method="$1"
  local path="$2"
  local body="$3"

  local ts nonce body_hash msg sig
  ts="$(now_ms)"
  nonce="$(make_nonce)"

  # body_hash 必须基于 body 原始字节；空串也要算
  body_hash="$(printf 
  # V1 message: method\npath\ntimestamp\nnonce\nbodyHash
  msg="${method}\n${path}\n${ts}\n${nonce}\n${body_hash}"

  sig="$(printf 
  # 输出给调用方：ts nonce sig
  echo "$ts" "$nonce" "$sig"
}

BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TEST_TOKEN="${TEST_TOKEN}"
PROJECT_ID="${CE01_TEST_PROJECT_ID}"
CHARACTER_ID="${CE01_TEST_CHARACTER_ID}"

if [[ -z "$TEST_TOKEN" ]]; then
  echo "❌ TEST_TOKEN not set"
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ CE01_TEST_PROJECT_ID not set"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "=================================================="
echo "Gate: CE01 Protocol Instantiation (HMAC V1)"
echo "=================================================="
echo "API: $BASE_URL"
echo "Project: $PROJECT_ID"
echo "Character: $CHARACTER_ID"
echo ""

# ============================================
# STEP 0: HMAC Ping 自检
# ============================================
echo "[STEP 0] HMAC PING 自检"
PING_PATH="/api/_internal/hmac-ping"
PING_BODY=""
read -r PING_TS PING_NONCE PING_SIG <<<"$(build_hmac_headers "GET" "$PING_PATH" "$PING_BODY")"

PING_RESP="$(curl -sS -i "${BASE_URL}${PING_PATH}" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${PING_TS}" \
  -H "x-nonce: ${PING_NONCE}" \
  -H "x-signature: ${PING_SIG}" \
  | head -n 30
)"

echo "$PING_RESP" | head -n 30
if ! echo "$PING_RESP" | grep -qE   echo "❌ HMAC PING FAILED (Path: $PING_PATH)"
  exit 1
fi
echo "✅ HMAC PING SUCCESSFUL"
echo ""

# ============================================
# STEP 1: 第一次实例化调用
# ============================================
echo "[STEP 1] 调用 CE01 实例化接口 (第一次)"
INSTANTIATE_PATH="/api/jobs/ce01/instantiate"
BODY="$(printf 
read -r TS NONCE SIG <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_1=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS}" \
  -H "x-nonce: ${NONCE}" \
  -H "x-signature: ${SIG}" \
  -d "$BODY")

echo "Response: $RESPONSE_1"

# 提取 referenceSheetId
REF_SHEET_ID_1=$(echo "$RESPONSE_1" | jq -r FINGERPRINT_1=$(echo "$RESPONSE_1" | jq -r ENGINE_KEY_1=$(echo "$RESPONSE_1" | jq -r 
if [[ -z "$REF_SHEET_ID_1" ]]; then
  echo "❌ STEP 1 FAILED: No referenceSheetId returned"
  exit 1
fi

echo "✅ STEP 1 PASSED: referenceSheetId=$REF_SHEET_ID_1"
echo "   Fingerprint: $FINGERPRINT_1"
echo "   EngineKey: $ENGINE_KEY_1"
echo ""

# ============================================
# STEP 2: 验证 JobEngineBinding 存在
# ============================================
echo "[STEP 2] 验证 JobEngineBinding 记录存在"
DB_COUNT=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT COUNT(*) FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "0")

DB_COUNT=$(echo "$DB_COUNT" | xargs)

if [[ "$DB_COUNT" != "1" ]]; then
  echo "❌ STEP 2 FAILED: JobEngineBinding not found (count=$DB_COUNT)"
  exit 1
fi

echo "✅ STEP 2 PASSED: JobEngineBinding exists"
echo ""

# ============================================
# STEP 3: 验证 metadata 包含 fingerprint
# ============================================
echo "[STEP 3] 验证 JobEngineBinding.metadata 包含 fingerprint"
METADATA=$(psql "$DATABASE_URL" -t -c " # $gate$
  SELECT metadata::text FROM job_engine_bindings WHERE id = " 2>/dev/null || echo "{}")

METADATA=$(echo "$METADATA" | xargs)

if [[ ! "$METADATA" =~ "$FINGERPRINT_1" ]]; then
  echo "❌ STEP 3 FAILED: metadata does not contain fingerprint"
  echo "   Metadata: $METADATA"
  exit 1
fi

echo "✅ STEP 3 PASSED: Metadata contains fingerprint"
echo ""

# ============================================
# STEP 4: 幂等性验证 (第二次调用)
# ============================================
echo "[STEP 4] 调用 CE01 实例化接口 (第二次，验证幂等)"
read -r TS2 NONCE2 SIG2 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY")"

RESPONSE_2=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS2}" \
  -H "x-nonce: ${NONCE2}" \
  -H "x-signature: ${SIG2}" \
  -d "$BODY")

echo "Response: $RESPONSE_2"

REF_SHEET_ID_2=$(echo "$RESPONSE_2" | jq -r 
if [[ "$REF_SHEET_ID_1" != "$REF_SHEET_ID_2" ]]; then
  echo "❌ STEP 4 FAILED: Idempotency broken (ID changed)"
  echo "   First:  $REF_SHEET_ID_1"
  echo "   Second: $REF_SHEET_ID_2"
  exit 1
fi

echo "✅ STEP 4 PASSED: Idempotency verified (same ID returned)"
echo ""

# ============================================
# STEP 5: 验证新参数产生新实例
# ============================================
echo "[STEP 5] 调用 CE01 实例化接口 (不同参数，应产生新 ID)"
BODY3="$(printf read -r TS3 NONCE3 SIG3 <<<"$(build_hmac_headers "POST" "$INSTANTIATE_PATH" "$BODY3")"

RESPONSE_3=$(curl -sS "${BASE_URL}${INSTANTIATE_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS3}" \
  -H "x-nonce: ${NONCE3}" \
  -H "x-signature: ${SIG3}" \
  -d "$BODY3")

REF_SHEET_ID_3=$(echo "$RESPONSE_3" | jq -r 
if [[ "$REF_SHEET_ID_1" == "$REF_SHEET_ID_3" ]]; then
  echo "❌ STEP 5 FAILED: New parameters did not produce new ID"
  exit 1
fi

echo "✅ STEP 5 PASSED: Different parameters => different ID"
echo "   Original: $REF_SHEET_ID_1"
echo "   New:      $REF_SHEET_ID_3"
echo ""

# ============================================
# STEP 6: E4 下游拦截 - 缺 referenceSheetId 被拒绝
# ============================================
echo "[STEP 6] E4: 验证缺 referenceSheetId 的 SHOT_RENDER 被拒绝"
SHOT_ID="00000000-0000-0000-0000-000000000099"
JOBS_PATH="/api/shots/$SHOT_ID/jobs"
JOBS_BODY=
read -r TS4 NONCE4 SIG4 <<<"$(build_hmac_headers "POST" "$JOBS_PATH" "$JOBS_BODY")"

REJECT_RESPONSE=$(curl -sS -i "${BASE_URL}${JOBS_PATH}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TEST_TOKEN}" \
  -H "x-timestamp: ${TS4}" \
  -H "x-nonce: ${NONCE4}" \
  -H "x-signature: ${SIG4}" \
  -d "$JOBS_BODY")

# 提取 HTTP Code
HTTP_CODE=$(echo "$REJECT_RESPONSE" | head -n1 | awk BODY=$(echo "$REJECT_RESPONSE" | sed 
if [[ "$HTTP_CODE" != "400" && "$HTTP_CODE" != "422" ]]; then
  echo "❌ STEP 6 FAILED: Expected 400/422, got $HTTP_CODE"
  echo "   Body: $BODY"
  exit 1
fi

ERROR_CODE=$(echo "$BODY" | jq -r if [[ "$ERROR_CODE" != "REFERENCE_SHEET_REQUIRED" ]]; then
  echo "❌ STEP 6 FAILED: Expected error code REFERENCE_SHEET_REQUIRED, got $ERROR_CODE"
  echo "   Body: $BODY"
  exit 1
fi

echo "✅ STEP 6 PASSED: Missing referenceSheetId correctly rejected (HTTP $HTTP_CODE, code=$ERROR_CODE)"
echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "=================================================="
echo "✅ CE01 PROTOCOL INSTANTIATION GATE PASSED"
echo "=================================================="
echo "验证项："
echo "  ✓ HMAC Ping 自检通过"
echo "  ✓ 实例化调用成功"
echo "  ✓ referenceSheetId 生成"
echo "  ✓ JobEngineBinding 记录存在"
echo "  ✓ Metadata 包含 fingerprint"
echo "  ✓ 幂等性验证通过"
echo "  ✓ 新参数产生新实例"
echo "  ✓ E4 下游拦截：缺 referenceSheetId 被拒绝"
echo ""
echo "Sealed: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

exit 0
