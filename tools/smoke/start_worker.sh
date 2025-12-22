#!/bin/bash
# 启动 Worker 服务（后台，可选）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== 启动 Worker 服务（可选） ==="
echo ""

# Worker 服务是可选的，因为 smoke 测试主要验证 API
# 如果需要真实的 worker 来领取任务，可以启动

if [ -d "apps/workers" ]; then
  echo "启动 Worker 服务（后台）..."
  pnpm -w --filter workers dev > /tmp/worker.log 2>&1 &
  WORKER_PID=$!
  
  echo "Worker 进程 PID: $WORKER_PID"
  echo "日志文件: /tmp/worker.log"
  echo "$WORKER_PID" > /tmp/worker.pid
  echo "✅ Worker 服务已启动"
else
  echo "⚠️  未找到 apps/workers 目录，跳过 Worker 启动"
fi

echo ""

