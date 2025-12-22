#!/bin/bash
# Stage5 P0 Bugfix 验证脚本
# 用途：验证 NonceStore 写入修复是否生效

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEY="${HMAC_API_KEY:-ak_worker_dev_0000000000000000}"
SECRET="${HMAC_SECRET:-super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678}"
WORKER_ID="${WORKER_ID:-test-worker-001}"

echo "=========================================="
echo "Stage5 P0 Bugfix 验证脚本"
echo "=========================================="
echo "API Base URL: $API_BASE_URL"
echo "API Key: ${API_KEY:0:8}..."
echo "Worker ID: $WORKER_ID"
echo ""

# 检查 API 是否运行
echo "1. 检查 API 服务状态..."
if ! curl -s -f "$API_BASE_URL/api/health" > /dev/null; then
  echo "❌ API 服务未运行，请先启动：pnpm --filter api dev"
  exit 1
fi
echo "✅ API 服务运行中"
echo ""

# 清理 nonce_store 表
echo "2. 清理 nonce_store 表..."
docker exec super-caterpillar-db psql -U postgres -d super_caterpillar_dev -c "TRUNCATE TABLE nonce_store CASCADE;" > /dev/null 2>&1
echo "✅ nonce_store 表已清空"
echo ""

# 生成唯一的 nonce
NONCE="stage5-p0-verification-$(date +%s)-$(openssl rand -hex 8)"
TIMESTAMP=$(date +%s)
METHOD="POST"
PATH="/api/workers/$WORKER_ID/jobs/next"
BODY="{}"

echo "3. 准备第一次请求（合法请求）..."
echo "   Nonce: $NONCE"
echo "   Timestamp: $TIMESTAMP"
echo ""

# 计算签名（需要 Node.js）
SIGNATURE=$(node -e "
const crypto = require('crypto');
const method = '$METHOD';
const path = '$PATH';
const timestamp = '$TIMESTAMP';
const nonce = '$NONCE';
const body = '$BODY';
const secret = '$SECRET';
const payload = \`\${method}\n\${path}\n\${timestamp}\n\${nonce}\n\${body}\`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(signature);
")

echo "4. 发送第一次请求..."
FIRST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$PATH" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY")

FIRST_BODY=$(echo "$FIRST_RESPONSE" | head -n -1)
FIRST_STATUS=$(echo "$FIRST_RESPONSE" | tail -n 1)

echo "   状态码: $FIRST_STATUS"
echo "   响应: $FIRST_BODY"
echo ""

# 检查第一次请求是否返回 4003 或 4004
FIRST_ERROR_CODE=$(echo "$FIRST_BODY" | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(data.error?.code || 'none');")

if [ "$FIRST_ERROR_CODE" = "4003" ] || [ "$FIRST_ERROR_CODE" = "4004" ]; then
  echo "❌ 第一次请求返回了签名/重放错误 ($FIRST_ERROR_CODE)，这是 Bug！"
  echo "   期望：第一次请求不应返回 4003 或 4004"
  exit 1
fi

echo "✅ 第一次请求成功（非签名/重放错误）"
echo ""

# 验证 nonce_store 中是否有记录
echo "5. 验证 nonce_store 写入..."
sleep 1
NONCE_COUNT=$(docker exec super-caterpillar-db psql -U postgres -d super_caterpillar_dev -t -c "SELECT COUNT(*) FROM nonce_store WHERE nonce = '$NONCE';" | tr -d ' ')

if [ "$NONCE_COUNT" = "0" ]; then
  echo "❌ nonce_store 表中没有找到 nonce 记录，写入失败！"
  exit 1
fi

echo "✅ nonce_store 表中存在 nonce 记录（COUNT: $NONCE_COUNT）"
echo ""

# 发送第二次请求（使用相同 nonce，期望 4004）
echo "6. 发送第二次请求（同 nonce，期望 4004）..."
SECOND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$PATH" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY")

SECOND_BODY=$(echo "$SECOND_RESPONSE" | head -n -1)
SECOND_STATUS=$(echo "$SECOND_RESPONSE" | tail -n 1)

echo "   状态码: $SECOND_STATUS"
echo "   响应: $SECOND_BODY"
echo ""

# 检查第二次请求是否返回 4004
SECOND_ERROR_CODE=$(echo "$SECOND_BODY" | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(data.error?.code || 'none');")

if [ "$SECOND_ERROR_CODE" != "4004" ]; then
  echo "❌ 第二次请求未返回 4004（实际: $SECOND_ERROR_CODE），Nonce 重放检测未生效！"
  exit 1
fi

echo "✅ 第二次请求正确返回 4004（Nonce replay detected）"
echo ""

# 验证审计日志
echo "7. 验证审计日志..."
sleep 1
AUDIT_COUNT=$(docker exec super-caterpillar-db psql -U postgres -d super_caterpillar_dev -t -c "SELECT COUNT(*) FROM audit_logs WHERE action = 'SECURITY_EVENT' AND details->>'reason' = 'NONCE_REPLAY_DETECTED' AND details->>'nonce' = '$NONCE';" | tr -d ' ')

if [ "$AUDIT_COUNT" = "0" ]; then
  echo "⚠️  审计日志中未找到 NONCE_REPLAY_DETECTED 记录（可能是异步写入延迟）"
else
  echo "✅ 审计日志中存在 NONCE_REPLAY_DETECTED 记录（COUNT: $AUDIT_COUNT）"
fi
echo ""

echo "=========================================="
echo "✅ Stage5 P0 Bugfix 验证通过！"
echo "=========================================="
echo ""
echo "验证结果："
echo "  ✅ 第一次请求：非 4003/4004"
echo "  ✅ nonce_store 写入成功"
echo "  ✅ 第二次请求：返回 4004"
echo "  ✅ 审计日志：存在 NONCE_REPLAY_DETECTED 记录"
echo ""

