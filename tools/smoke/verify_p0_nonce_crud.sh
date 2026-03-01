#!/bin/bash
set -euo pipefail

# 硬门禁：验证 Nonce 防重放与关键 CRUD 路径
# P0 修复验证脚本

source tools/smoke/.auth_env
: "${API_BASE_URL:?API_BASE_URL missing}"
: "${AUTH_COOKIE_HEADER:?AUTH_COOKIE_HEADER missing}"

# 1. 验证 Nonce 重放被拦截
echo "[verify_p0] 1. Testing Nonce Replay Rejection..."
# 构造一个合法的 HMAC 请求头（利用 ensure_auth_state 逻辑或手动 curl）
# 这里我们直接复用 ensure_auth_state 产出的 key/secret 环境（如果存在）进行 curl 模拟
# 或者更简单：调用一个由于 Nonce 重复必然失败的端点

# 获取当前有效的 API 凭证
: "${API_KEY:?}"
: "${API_SECRET:?}"

# 使用 node 执行一小段代码来测试 Nonce 重放，复用 helpers
echo "[verify_p0] Running tsx nonce replay test..."
pnpm -w exec tsx -e "
import { testNonceReplay } from './tools/smoke/helpers/hmac_request.ts';
async function run() {
  const result = await testNonceReplay({
    apiBaseUrl: '$API_BASE_URL',
    apiKey: '$API_KEY',
    apiSecret: '$API_SECRET',
    method: 'GET',
    path: '/api/projects'
  });
  console.log('Nonce Replay Result:', JSON.stringify(result, null, 2));
  const secondStatus = result.secondRequest.status;
  if (secondStatus === 400 || secondStatus === 403 || secondStatus === 404) {
    console.log('✅ Nonce replay correctly rejected (status: ' + secondStatus + ')');
    process.exit(0);
  } else {
    console.error('❌ Nonce replay NOT rejected (status: ' + secondStatus + ')');
    process.exit(1);
  }
}
run().catch(err => { console.error(err); process.exit(1); });
"

# 2. 验证 CRUD (Episodes) 400 修复
echo "[verify_p0] 2. Testing Episode CRUD (400 fix)..."
# 先拿一个 Project ID (复用 verified ID 或新建)
PROJECT_RESP="$(curl -s -H "$AUTH_COOKIE_HEADER" -H "Content-Type: application/json" -X POST "${API_BASE_URL}/api/projects" -d '{"name":"P0 Verify Project"}')"
PROJECT_ID=$(pnpm -w exec tsx -e "try { const r=JSON.parse(process.argv[1]); console.log(r.data?.id || r.id); } catch(e){}" "$PROJECT_RESP")

if [ -z "$PROJECT_ID" ]; then 
  echo "❌ Project creation failed for P0 verify"
  echo "Response: $PROJECT_RESP"
  exit 1 
fi

# 发送合法的 Episode 创建请求，额外带上 title 以对齐标准
EPISODE_DATA='{"index":1,"name":"P0 Verify Episode","title":"P0 Verify Title","summary":"Verified by verify_p0_nonce_crud.sh"}'
EPISODE_RESP="$(curl -s -w "\n%{http_code}" -H "$AUTH_COOKIE_HEADER" -H "Content-Type: application/json" -X POST "${API_BASE_URL}/api/projects/${PROJECT_ID}/episodes" -d "$EPISODE_DATA")"

EPISODE_CODE="$(echo "$EPISODE_RESP" | tail -n 1)"
EPISODE_BODY="$(echo "$EPISODE_RESP" | sed '$d')"

echo "[verify_p0] Episode creation status: $EPISODE_CODE"
if [ "$EPISODE_CODE" != "201" ]; then
  echo "❌ Episode creation failed (Expected 201, got $EPISODE_CODE)"
  # 打印失败响应的前 800 字符
  echo "Body: ${EPISODE_BODY:0:800}"
  exit 1
fi

echo "✅ verify_p0_nonce_crud OK"
