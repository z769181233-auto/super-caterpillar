#!/usr/bin/env bash
# P6-1-5 一键启动服务并验证

set -euo pipefail

export REPO_ROOT="$(pwd)"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/scu"

echo "========================================="
echo "P6-1-5 启动服务并验证计费闭环"
echo "========================================="
echo ""

# 1. 停止旧进程
echo "[1/6] 清理旧进程..."
source tools/gate/common/safe_proc.sh
kill_port 3000
kill_port 3001
sleep 1

# 2. 启动 API（后台）
echo "[2/6] 启动 API..."
mkdir -p logs .data/pids
cd apps/api
pnpm dev > ../../logs/api_p6_1_5.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"
echo $API_PID > ../../.data/pids/api_p6_1_5.pid
cd ../..
sleep 3

# 3. 启动 Worker（后台）
echo "[3/6] 启动 Worker..."
cd apps/workers
pnpm dev > ../../logs/worker_p6_1_5.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"
echo $WORKER_PID > ../../.data/pids/worker_p6_1_5.pid
cd ../..
sleep 3

# 4. 等待 API 健康
echo "[4/6] 等待 API 健康检查（最多 60s）..."
for i in $(seq 1 60); do
  if curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✅ API 健康"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "❌ API 健康检查超时"
    echo "=== API 日志（最后 50 行）==="
    tail -50 logs/api_p6_1_5.log || true
    exit 1
  fi
  sleep 1
done
echo ""

# 5. 查询 billing_ledgers 状态
echo "[5/6] 查询 Billing Ledgers..."
POSTED_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c \
  "SELECT COUNT(*) FROM billing_ledgers WHERE status='POSTED';" | xargs)

echo "Posted Count: $POSTED_COUNT"
echo ""

if [ "$POSTED_COUNT" -gt 0 ]; then
  echo "✅ 已有 $POSTED_COUNT 条 POSTED 记录（之前的验证已生效）"
  echo ""
  echo "最新 10 条记录："
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c \
    "SELECT \"traceId\", \"chargeCode\", amount, \"createdAt\"
     FROM billing_ledgers
     WHERE status='POSTED'
     ORDER BY \"createdAt\" DESC
     LIMIT 10;"
  echo ""
else
  echo "⚠️  未发现 POSTED 记录，需要触发 CE06 Job"
  echo "执行 CE06 Smoke Gate..."
  
  if [ -f "tools/gate/gates/gate_ce06_smoke_v1.sh" ]; then
    bash tools/gate/gates/gate_ce06_smoke_v1.sh || true
  else
    echo "❌ gate_ce06_smoke_v1.sh 不存在"
  fi
fi

# 6. 执行 Strict Reconcile
echo "[6/6] 执行 Strict Reconcile Gate..."
if bash tools/gate/gates/gate_billing_reconciliation.sh; then
  echo ""
  echo "========================================="
  echo "🎉 P6-1-5 验证通过！"
  echo "========================================="
  echo ""
  echo "下一步："
  echo "1. 执行负向测试: bash tools/gate/gates/gate_billing_negative.sh"
  echo "2. 生成证据包"
  echo "3. 标记 P6-1-5 为 BUSINESS SEALED"
else
  echo "❌ Reconcile Gate 失败，请检查日志"
  exit 1
fi
