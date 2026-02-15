#!/usr/bin/env bash
# P6-1-5 业务计费闭环快速验证脚本
# 用于确认计费逻辑是否生效（醒来后第一步）

set -euo pipefail

echo "========================================="
echo "P6-1-5 业务计费闭环快速验证"
echo "========================================="
echo ""

# 1. 检查 API 健康状态
echo "[1/5] 检查 API 健康状态..."
if curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "✅ API 运行正常"
  curl -sS http://127.0.0.1:3000/api/health | jq .
else
  echo "❌ API 未运行或不健康"
  echo "需要重新启动服务，请运行："
  echo "  cd apps/api && pnpm dev"
  exit 1
fi
echo ""

# 2. 查询 billing_ledgers 表中 POSTED 记录数
echo "[2/5] 查询 Billing Ledgers POSTED 记录..."
POSTED_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c \
  "SELECT COUNT(*) FROM billing_ledgers WHERE status='POSTED';")

echo "Posted Count: $POSTED_COUNT"
if [ "$POSTED_COUNT" -gt 0 ]; then
  echo "✅ 发现 $POSTED_COUNT 条 POSTED 记录，计费逻辑已生效！"
else
  echo "❌ 未发现 POSTED 记录，计费逻辑可能未触发"
  echo "需要执行 CE06 Smoke Gate"
fi
echo ""

# 3. 显示最新的 10 条 POSTED 记录
if [ "$POSTED_COUNT" -gt 0 ]; then
  echo "[3/5] 最新 10 条 POSTED 记录："
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c \
    "SELECT \"traceId\", \"chargeCode\", amount, status, \"createdAt\"
     FROM billing_ledgers
     WHERE status='POSTED'
     ORDER BY \"createdAt\" DESC
     LIMIT 10;"
  echo ""
fi

# 4. 检查 Schema 迁移状态（owner_id / organization_id 列是否存在）
echo "[4/5] 检查数据库 Schema 状态..."
OWNER_ID_EXISTS=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c \
  "SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='organizations' AND column_name='owner_id';")

if [ "$OWNER_ID_EXISTS" -gt 0 ]; then
  echo "✅ organizations.owner_id 列存在"
else
  echo "❌ organizations.owner_id 列不存在，需要执行 prisma migrate deploy"
fi
echo ""

# 5. 执行 Strict Reconcile Gate（如果有 POSTED 记录）
if [ "$POSTED_COUNT" -gt 0 ]; then
  echo "[5/5] 执行 Strict Reconcile Gate..."
  if bash tools/gate/gates/gate_billing_reconciliation.sh; then
    echo "✅ Strict Reconcile Gate 通过！"
    echo ""
    echo "========================================="
    echo "🎉 P6-1-5 业务计费闭环验证成功！"
    echo "========================================="
    echo ""
    echo "下一步："
    echo "1. 执行负向测试: bash tools/gate/gates/gate_billing_negative.sh"
    echo "2. 生成证据包并 BUSINESS SEALED"
  else
    echo "❌ Strict Reconcile Gate 失败"
    echo "请查看日志分析原因"
  fi
else
  echo "[5/5] 跳过 Reconcile Gate（无 POSTED 记录）"
  echo ""
  echo "========================================="
  echo "⚠️  需要先执行 CE06 Smoke Gate"
  echo "========================================="
  echo ""
  echo "运行命令: bash tools/gate/gates/gate_ce06_smoke_v1.sh"
fi
