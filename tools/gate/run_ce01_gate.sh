#!/usr/bin/env bash
# CE01 Gate 一键启动脚本
# 自动处理认证和环境配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

cd "$REPO_ROOT"

echo "=================================================="
echo "CE01 Gate 一键执行脚本"
echo "=================================================="
echo ""

# 1. 检查 API 状态
echo "[1/5] 检查 API 状态..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "✅ API 已运行在 localhost:3000"
  USE_EXISTING_API=true
else
  echo "⚠️  API 未运行，需要先启动 API"
  USE_EXISTING_API=false
fi
echo ""

# 2. 从 .env.bak 读取 Worker 凭证
echo "[2/5] 配置 Worker 认证..."
if [ -f "apps/api/.env.bak" ]; then
  export WORKER_API_KEY=$(grep WORKER_API_KEY apps/api/.env.bak | cut -d'=' -f2 | tr -d '"')
  export WORKER_API_SECRET=$(grep WORKER_API_SECRET apps/api/.env.bak | cut -d'=' -f2 | tr -d '"')
  echo "✅ 从 .env.bak 读取凭证"
  echo "   WORKER_API_KEY=${WORKER_API_KEY:0:20}..."
else
  echo "❌ 未找到 .env.bak，使用默认凭证"
  export WORKER_API_KEY="ak_worker_dev_0000000000000000"
  export WORKER_API_SECRET="super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678"
fi
echo ""

# 3. 配置测试环境变量
echo "[3/5] 配置测试环境变量..."
echo "⚠️  需要设置真实凭证："
echo "   export TEST_TOKEN=\"your-real-jwt\""
echo "   export CE01_TEST_PROJECT_ID=\"real-project-uuid\""
echo "   export CE01_TEST_CHARACTER_ID=\"real-character-uuid\""
echo ""
read -p "是否已设置？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 请先设置环境变量后重新运行"
  exit 1
fi
echo ""

# 4. 启动 Worker（后台）
echo "[4/5] 启动 Worker（后台）..."
export WORKER_ID=worker_ce01_gate_$(date +%s)
export WORKER_PID_DIR="$REPO_ROOT/apps/workers/.runtime/pids"
export JOB_WORKER_ENABLED=true

mkdir -p "$WORKER_PID_DIR"

# 启动 Worker 并保存 PID
pnpm --filter @scu/worker dev > docs/_evidence/CE01_SEAL_20260110/worker_console.log 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > docs/_evidence/CE01_SEAL_20260110/worker.pid

echo "✅ Worker 启动 (PID: $WORKER_PID)"
echo "   日志: docs/_evidence/CE01_SEAL_20260110/worker_console.log"
sleep 5
echo ""

# 5. 运行 Gate
echo "[5/5] 运行 Gate 脚本..."
bash tools/gate/gates/gate-ce01_protocol_instantiation.sh 2>&1 | tee docs/_evidence/CE01_SEAL_20260110/gate_output.log

GATE_EXIT=$?

# 清理 Worker
echo ""
echo "清理 Worker..."
kill $WORKER_PID 2>/dev/null || true

if [ $GATE_EXIT -eq 0 ]; then
  echo ""
  echo "=================================================="
  echo "✅ Gate 执行成功"
  echo "=================================================="
  echo "证据目录: docs/_evidence/CE01_SEAL_20260110/"
  echo ""
  echo "下一步: 收集 DB 证据并封板"
else
  echo ""
  echo "❌ Gate 执行失败 (exit code: $GATE_EXIT)"
  echo "请检查日志: docs/_evidence/CE01_SEAL_20260110/gate_output.log"
fi

exit $GATE_EXIT
