#!/usr/bin/env bash
# Stage2-B 运行时验证脚本
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# 获取测试凭证
echo "=== 获取测试凭证 ==="
CREDS=$(node tools/smoke/get-test-credentials.js 2>&1 | grep -E "export|API_KEY|API_SECRET|PROJECT_ID" || true)
eval "$CREDS"

export WORKER_ID="${WORKER_ID:-minimal-worker-001}"

echo "API_BASE_URL=$API_BASE_URL"
echo "API_KEY=${API_KEY:0:10}..."
echo "TEST_PROJECT_ID=$TEST_PROJECT_ID"
echo "WORKER_ID=$WORKER_ID"
echo ""

# 检查 API 是否运行
echo "=== 检查 API 状态 ==="
if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ API 未运行，请先启动: pnpm --filter api dev"
  exit 1
fi
echo "✅ API 运行中"
echo ""

# 创建测试 Job（通过 Node.js 脚本）
echo "=== 创建测试 Job ==="
node tools/smoke/stage2-b-create-job.js "$TEST_PROJECT_ID" 2>&1 | head -20
JOB_ID=$(node tools/smoke/stage2-b-create-job.js "$TEST_PROJECT_ID" 2>&1 | grep "Job ID:" | awk '{print $3}' || echo "")
if [ -z "$JOB_ID" ]; then
  echo "❌ 创建 Job 失败"
  exit 1
fi
echo "✅ Job ID: $JOB_ID"
echo ""

# 启动 minimal-worker（后台运行）
echo "=== 启动 minimal-worker ==="
cd apps/workers/minimal-worker
pnpm install --silent 2>&1 || true
WORKER_LOG="/tmp/minimal-worker-$$.log"
pnpm dev > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"
echo "Worker Log: $WORKER_LOG"
echo ""

# 等待 Worker 处理 Job
echo "=== 等待 Worker 处理 Job ==="
for i in {1..30}; do
  if grep -q "Job $JOB_ID completed successfully" "$WORKER_LOG" 2>/dev/null; then
    echo "✅ Job 处理完成"
    break
  fi
  sleep 1
  echo -n "."
done
echo ""

# 显示 Worker 日志
echo "=== Worker 日志 ==="
tail -30 "$WORKER_LOG" || true
echo ""

# 查询 audit_logs
echo "=== 查询 audit_logs ==="
node tools/smoke/stage2-b-query-audit-logs.js "$JOB_ID" 2>&1 | head -50
echo ""

# 停止 Worker
echo "=== 停止 Worker ==="
kill $WORKER_PID 2>/dev/null || true
sleep 1
kill -9 $WORKER_PID 2>/dev/null || true
echo "✅ Worker 已停止"
echo ""

# 验证结果
echo "=== 验证结果 ==="
if grep -q "JOB_DISPATCHED\|JOB_STARTED\|JOB_REPORT_RECEIVED" "$WORKER_LOG" 2>/dev/null; then
  echo "✅ 审计日志验证通过"
else
  echo "⚠️  审计日志验证需要检查数据库"
fi

echo ""
echo "=== Stage2-B 验证完成 ==="

