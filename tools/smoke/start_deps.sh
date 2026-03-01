#!/bin/bash
# 启动依赖服务（DB/Redis）
# 使用 docker-compose 或现有脚本

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== 启动依赖服务 ==="
echo ""

# 检查是否有 docker-compose.yml
if [ -f "docker-compose.yml" ]; then
  echo "使用 docker-compose 启动服务..."
  docker-compose up -d db redis || {
    echo "❌ docker-compose 启动失败"
    exit 1
  }
  echo "✅ 依赖服务已启动（docker-compose）"
else
  # 使用现有脚本
  echo "使用现有脚本启动 PostgreSQL..."
  if [ -f "tools/db/up-postgres.sh" ]; then
    bash tools/db/up-postgres.sh || {
      echo "❌ PostgreSQL 启动失败"
      exit 1
    }
  else
    echo "❌ 未找到启动脚本"
    exit 1
  fi
  echo "✅ PostgreSQL 已启动"
fi

echo ""
echo "等待服务就绪..."
sleep 3

echo "✅ 依赖服务启动完成"
echo ""

