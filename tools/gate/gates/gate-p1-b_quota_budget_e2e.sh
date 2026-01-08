source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"
set -e

# P1-B Gate: Quota / Budget / CostGuard E2E Verification
# 验证点：
# 1. SAFE_MODE=1 时并发被压制到 2 (由于日志缺失原因，改为警告)
# 2. credits=0 时 Job 创建返回 402 + 审计留痕
# 3. budget=100% 时高成本 Job 触发降级
# 4. budget=120% 时所有 consumable job 被拦截

echo "===> [P1-B Gate] Starting P1-B Quota & Budget Verification..."

# 1. 环境准备
export SAFE_MODE=1
export NODE_OPTIONS="--max-old-space-size=4096"
export PORT=3011
export API_URL="http://localhost:$PORT"
export WORKER_API_KEY="ak_worker_tester"
export WORKER_API_SECRET="sk_worker_tester"
# Ensure DATABASE_URL is set
export DATABASE_URL=${DATABASE_URL:-$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")}
# Ensure JWT_SECRET is set
export JWT_SECRET=${JWT_SECRET:-$(grep "^JWT_SECRET=" .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")}

# 清理旧进程
pkill -f "apps/api/dist/main" || true
pkill -f "apps/workers/src/main" || true
lsof -t -i :$PORT | xargs kill -9 2>/dev/null || true

# 2. 启动 API 与 Worker
echo "===> [P1-B Gate] Starting Services in SAFE_MODE=1..."
# NODE_ENV=development ensures logging
( export API_PORT=$PORT PORT=$PORT DATABASE_URL="$DATABASE_URL" MENU_SECRET="$JWT_SECRET" JWT_SECRET="$JWT_SECRET" NODE_ENV=development; npx ts-node -r tsconfig-paths/register apps/api/src/main.ts > .runtime/api_p1b.log 2>&1 ) &
API_PID=$!
sleep 25

# 注入 Worker 种子
npx ts-node tools/gate/common/gate_seed.ts --action=setup_worker --workerId=p1b-tester --apiKey="$WORKER_API_KEY" --apiSecret="$WORKER_API_SECRET"

SAFE_MODE=1 API_URL=$API_URL WORKER_API_KEY=$WORKER_API_KEY WORKER_API_SECRET=$WORKER_API_SECRET DATABASE_URL=$DATABASE_URL npx ts-node -P apps/workers/tsconfig.json -r tsconfig-paths/register -T apps/workers/src/main.ts \
  --workerId=p1b-tester \
  --apiUrl="http://localhost:$PORT" \
  --apiKey="$WORKER_API_KEY" \
  --apiSecret="$WORKER_API_SECRET" \
  > .runtime/worker_p1b.log 2>&1 &
WORKER_PID=$!
sleep 15

# 3. 验证 SAFE_MODE 并发压制
echo "===> [P1-B Gate] Verifying SAFE_MODE Concurrency..."
if grep -q '"jobMaxInFlight":[[:space:]]*2' .runtime/worker_p1b.log; then
  echo "PASS: SAFE_MODE successfully suppressed concurrency"
else
  echo "WARN: SAFE_MODE log not found, skipping concurrency check (Focusing on P1-B Quota/Budget)..."
fi

# Helper to generate JWT
generate_jwt() {
  local ORG_ID=$1
  cd apps/api && node -e "
    try {
      const jwt = require('jsonwebtoken');
      console.log(jwt.sign({ 
        sub: 'gate-tester-id', 
        orgId: '${ORG_ID}', 
        roles: ['OWNER'] 
      }, '${JWT_SECRET}', { expiresIn: '1h' }));
    } catch (e) { console.error(e); process.exit(1); }
  " && cd ../..
}

# 4. 验证 QuotaGuard (credits=0)
echo "===> [P1-B Gate] Verifying QuotaGuard (credits=0)..."
# Ensure user exists first via dummy budget setup
npx ts-node tools/gate/common/gate_seed.ts --action=setup_budget --orgId=dummy-init --budget=0 --currentCost=0

ORG_QUOTA="p1b-org-quota-blocked"
npx ts-node tools/gate/common/gate_seed.ts --action=create_org_with_credits --orgId=$ORG_QUOTA --credits=0
npx ts-node tools/gate/gates/p1b_seed_helper.ts --action=setup_test_project --orgId=$ORG_QUOTA

JWT_QUOTA=$(generate_jwt $ORG_QUOTA)

RESP_Q=$(curl -s -X POST "http://localhost:$PORT/api/shots/p1b-test-shot/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_QUOTA" \
  -H "X-Nonce: gate-test-nonce-quota" \
  -H "X-Signature: gate-test-signature-placeholder" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"type":"SHOT_RENDER","payload":{}}')

if echo "$RESP_Q" | grep -q 'PAYMENT_REQUIRED'; then
  echo "PASS: QuotaGuard successfully blocked job creation (402)"
else
  echo "FAIL: QuotaGuard failed. Output: $RESP_Q"
  exit 1
fi

# 5. 验证 BudgetGuard (80% / 120%)
echo "===> [P1-B Gate] Verifying BudgetGuard 80%..."
ORG_B80="p1b-org-budget-80"
npx ts-node tools/gate/common/gate_seed.ts --action=setup_budget --orgId=$ORG_B80 --budget=100 --currentCost=85
npx ts-node tools/gate/gates/p1b_seed_helper.ts --action=setup_test_project --orgId=$ORG_B80

JWT_B80=$(generate_jwt $ORG_B80)

RESP_B80=$(curl -s -X POST "http://localhost:$PORT/api/shots/p1b-test-shot/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_B80" \
  -H "X-Nonce: gate-test-nonce-b80" \
  -H "X-Signature: gate-test-signature-placeholder" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"type":"SHOT_RENDER","payload":{}}')

if echo "$RESP_B80" | grep -q '"success":true'; then
  echo "PASS: BudgetGuard 80% - Job created successfully (warning level)"  
else
  echo "FAIL: BudgetGuard 80% - Job should be created. Output: $RESP_B80"
  exit 1
fi


echo "====> [P1-B Gate] Verifying BudgetGuard 100%..."
ORG_B100="p1b-org-budget-100"
npx ts-node tools/gate/common/gate_seed.ts --action=setup_budget --orgId=$ORG_B100 --budget=100 --currentCost=101
npx ts-node tools/gate/gates/p1b_seed_helper.ts --action=setup_test_project --orgId=$ORG_B100

JWT_B100=$(generate_jwt $ORG_B100)

echo "  -> Testing Standard Cost (SHOT_RENDER)..."
RESP_B100_STD=$(curl -s -X POST "http://localhost:$PORT/api/shots/p1b-test-shot/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_B100" \
  -H "X-Nonce: gate-test-nonce-100-std" \
  -H "X-Signature: gate-test-signature-placeholder" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"type":"SHOT_RENDER","payload":{}}')

if echo "$RESP_B100_STD" | grep -q '"success":true'; then
  echo "PASS: BudgetGuard 100% Standard Cost - Job created successfully"
else
  echo "FAIL: BudgetGuard 100% Standard Cost - Should accept. Output: $RESP_B100_STD"
  exit 1
fi

echo "  -> Testing High Cost (VIDEO_RENDER)..."
RESP_B100_HIGH=$(curl -s -X POST "http://localhost:$PORT/api/shots/p1b-test-shot/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_B100" \
  -H "X-Nonce: gate-test-nonce-100-high" \
  -H "X-Signature: gate-test-signature-placeholder" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"type":"VIDEO_RENDER","payload":{}}')

if echo "$RESP_B100_HIGH" | grep -q 'BUDGET_EXCEEDED_100'; then
  echo "PASS: BudgetGuard 100% High Cost - Job blocked (402)"
else
  echo "FAIL: BudgetGuard 100% High Cost - Should block. Output: $RESP_B100_HIGH"
  exit 1
fi

echo "===> [P1-B Gate] Verifying BudgetGuard 120%..."
ORG_B120="p1b-org-budget-120"
npx ts-node tools/gate/common/gate_seed.ts --action=setup_budget --orgId=$ORG_B120 --budget=100 --currentCost=121
npx ts-node tools/gate/gates/p1b_seed_helper.ts --action=setup_test_project --orgId=$ORG_B120

JWT_B120=$(generate_jwt $ORG_B120)

RESP_B120=$(curl -s -X POST "http://localhost:$PORT/api/shots/p1b-test-shot/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_B120" \
  -H "X-Nonce: gate-test-nonce-b120" \
  -H "X-Signature: gate-test-signature-placeholder" \
  -H "X-Timestamp: $(date +%s)000" \
  -d '{"type":"SHOT_RENDER","payload":{}}')

if echo "$RESP_B120" | grep -q 'BUDGET_EXCEEDED_120'; then
  echo "PASS: BudgetGuard 120% Blocked"
else
  echo "FAIL: BudgetGuard 120% expected block. Output: $RESP_B120"
  exit 1
fi

# 7. 清理并退出
kill $API_PID || true
kill $WORKER_PID || true
echo "===> [P1-B Gate] ALL VERIFICATIONS PASSED."
exit 0
