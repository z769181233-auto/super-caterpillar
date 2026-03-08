#!/usr/bin/env bash
# P6-1-5 触发 CE06 并验证计费（最终版）

set -euo pipefail

echo "====================================="
echo "P6-1-5: 触发 CE06 并验证计费"
echo "====================================="
echo ""

# 1. API Health
echo "[1/5] 检查 API 健康..."
if ! curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "❌ API 未运行，请先启动："
  echo "  cd apps/api && pnpm dev"
  exit 1
fi
echo "✅ API 健康"
echo ""

# 2. 检查 Worker 进程
echo "[2/5] 检查 Worker 进程..."
if pgrep -f "node.*workers.*worker-app" >/dev/null; then
  echo "✅ Worker 进程运行中"
else
  echo "⚠️  Worker 进程未找到，请确认是否启动"
fi
echo ""

# 3. 触发 CE06 Smoke Gate
echo "[3/5] 触发 CE06 Smoke Gate..."
bash tools/gate/gates/gate_ce06_smoke_v1.sh
echo ""

# 4. 查询 billing_ledger
echo "[4/5] 查询 billing_ledger POSTED..."
POSTED_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c \
  "SELECT COUNT(*) FROM billing_ledger WHERE status='POSTED';")

echo "Posted Count: $POSTED_COUNT"
echo ""

if [ "$POSTED_COUNT" -gt 0 ]; then
  echo "✅ 计费记录已生成！"
  echo ""
  echo "样本记录："
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c \
    "SELECT \"traceId\", \"chargeCode\", amount, \"createdAt\"
     FROM billing_ledger
     WHERE status='POSTED'
     ORDER BY \"createdAt\" DESC
     LIMIT 5;"
  echo ""
  
  # 5. 执行 Strict Reconcile
  echo "[5/5] 执行 Strict Reconcile Gate..."
  if bash tools/gate/gates/gate_billing_reconciliation.sh; then
    echo ""
    echo "====================================="
    echo "🎉 P6-1-5 验证通过！"
    echo "====================================="
    echo ""
    echo "下一步："
    echo "1. 执行负向测试: bash tools/gate/gates/gate_billing_negative.sh"
    echo "2. 提交并打 tag"
    echo "3. 标记 P6-1-5 为 BUSINESS SEALED"
  else
    echo "❌ Reconcile Gate 失败"
    exit 1
  fi
else
  echo "❌ 未生成计费记录，请检查："
  echo "  1. CE06 Job 是否 SUCCEEDED"
  echo "  2. Worker 日志是否有错误"
  
  # 查看最近的 Job 状态
  echo ""
  echo "最近的 CE06 Jobs:"
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c \
    "SELECT id, status, \"createdAt\"
     FROM shot_jobs
     WHERE type='CE06_NOVEL_PARSING'
     ORDER BY \"createdAt\" DESC
     LIMIT 5;"
  exit 1
fi
