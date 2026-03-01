#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo "=== 安全降噪与规范化改进运行时验证 ==="
echo "API_BASE_URL=$API_BASE_URL"
echo ""

# 1) 检查 API 是否运行
echo "== Step 1: 检查 API 状态 =="
if ! curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" > /dev/null 2>&1; then
  echo "⚠️  API 未运行，请先启动："
  echo "   pnpm --filter api dev"
  echo ""
  echo "或使用后台启动："
  echo "   pnpm --filter api dev > /tmp/api_dev.log 2>&1 &"
  exit 1
fi
echo "✅ API 正在运行"
echo ""

# 2) 白名单路径测试（不应触发签名错误）
echo "== Step 2: 白名单路径测试（/health, /metrics, /ping） =="
echo ""

echo "2.1) GET /health"
curl -i "$API_BASE_URL/health" 2>&1 | head -15
echo ""

echo "2.2) GET /metrics"
curl -i "$API_BASE_URL/metrics" 2>&1 | head -15
echo ""

echo "2.3) GET /ping"
curl -i "$API_BASE_URL/ping" 2>&1 | head -15
echo ""

# 3) 未签名访问受保护接口（预期 4003/401/403，无堆栈洪水）
echo "== Step 3: 未签名访问受保护接口（预期 4003/401/403） =="
echo ""

echo "3.1) POST /api/story/parse (无签名头)"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE_URL/api/story/parse" \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"test"}' 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | head -20
echo ""

# 4) Nonce 重放测试（预期第二次请求返回 4004）
echo "== Step 4: Nonce 重放测试 =="
echo ""

NONCE="replay_test_nonce_$(date +%s)_$$"
TS=$(date +%s)

echo "4.1) 第一次请求（NONCE=$NONCE, TS=$TS）"
FIRST_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE_URL/api/story/parse" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: dummy" \
  -H "X-Nonce: $NONCE" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: dummy" \
  -d '{"raw_text":"test"}' 2>&1)
FIRST_HTTP_CODE=$(echo "$FIRST_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
FIRST_BODY=$(echo "$FIRST_RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $FIRST_HTTP_CODE"
echo "Response Body (first 20 lines):"
echo "$FIRST_BODY" | head -20
echo ""

sleep 1

echo "4.2) 第二次请求（相同 NONCE，预期 4004）"
SECOND_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE_URL/api/story/parse" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: dummy" \
  -H "X-Nonce: $NONCE" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: dummy" \
  -d '{"raw_text":"test"}' 2>&1)
SECOND_HTTP_CODE=$(echo "$SECOND_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
SECOND_BODY=$(echo "$SECOND_RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $SECOND_HTTP_CODE"
echo "Response Body (first 20 lines):"
echo "$SECOND_BODY" | head -20
echo ""

if [[ "$SECOND_HTTP_CODE" == "403" ]] || echo "$SECOND_BODY" | grep -q "4004"; then
  echo "✅ 重放检测成功：第二次请求返回 4004/403"
else
  echo "⚠️  重放检测可能未生效：第二次请求状态码为 $SECOND_HTTP_CODE"
fi
echo ""

# 5) 查询 audit_logs（确认安全事件已记录）
echo "== Step 5: 查询 audit_logs（安全事件记录） =="
echo ""

if command -v node >/dev/null 2>&1; then
  node tools/smoke/query-security-audit-logs.js 2>&1 | head -100
else
  echo "⚠️  Node.js 不可用，跳过 audit_logs 查询"
  echo "   请手动执行 SQL："
  echo "   SELECT id, action, resource_type, resource_id, ip, user_agent, created_at, details"
  echo "   FROM audit_logs"
  echo "   WHERE action IN ('API_SIGNATURE_ERROR', 'API_NONCE_REPLAY', 'API_FORBIDDEN', 'API_UNAUTHORIZED')"
  echo "   ORDER BY created_at DESC"
  echo "   LIMIT 50;"
fi
echo ""

echo "=== 验证完成 ==="
echo ""
echo "验证要点："
echo "1. ✅ 白名单路径（/health, /metrics, /ping）不应触发签名错误"
echo "2. ✅ 未签名访问应返回 4003/401/403，且日志无堆栈洪水（仅 warn/结构化字段）"
echo "3. ✅ Nonce 重放应返回 4004，且 audit_logs 中有对应记录"
echo ""

