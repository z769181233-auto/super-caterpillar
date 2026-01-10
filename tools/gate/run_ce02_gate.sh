#!/usr/bin/env bash
set -euo pipefail

# 强制清理端口占用
echo "Cleaning up port 3000..."
lsof -ti:3000 | xargs kill -9 || true
sleep 2

# 强制加载环境变量
if [ -f .env.local ]; then
  # 移除旧的混淆环境变量
  sed -i '' '/GATE_MODE/d' .env.local || sed -i '/GATE_MODE/d' .env.local || true
  sed -i '' '/TEST_TOKEN/d' .env.local || sed -i '/TEST_TOKEN/d' .env.local || true
fi

echo "GATE_MODE=1" >> .env.local
echo "TEST_TOKEN=scu_smoke_key" >> .env.local

export PORT=3000
export GATE_MODE=1
export TEST_TOKEN=scu_smoke_key
export TEST_SECRET=scu_smoke_secret

# 证据目录
EVDIR="docs/_evidence/CE02_SEAL_20260110"
mkdir -p "$EVDIR"

# 创建 Gate 专用环境配置
cat > .env.gate <<EOF
GATE_MODE=1
PORT=3000
EOF

echo "Starting API in background with GATE_MODE..."
# 使用 .env.gate 启动 API
NODE_ENV=gate GATE_MODE=1 PORT=3000 pnpm dev:api > "$EVDIR/api_start.log" 2>&1 &
API_PID=$!

# 退出时清理
cleanup() {
  echo "Cleaning up (Killing API PID: $API_PID)..."
  kill "$API_PID" || true
}
trap cleanup EXIT

# 等待 API 就绪
echo "Waiting for API (http://localhost:3000/api/_internal/hmac-ping) to be ready..."
for i in {1..30}; do
  if curl -s "http://localhost:3000/api/_internal/hmac-ping" > /dev/null; then
    echo "API is ready!"
    break
  fi
  sleep 2
done

# 执行 Gate 脚本
echo "Executing CE02 Gate Script..."
bash tools/gate/gates/gate-ce02_mother_engine.sh 2>&1 | tee "$EVDIR/gate_output.log"

echo "Executing CE03/CE04 Adoption Gate Script..."
bash tools/gate/gates/gate-ce03_ce04_mother_engine_adoption.sh 2>&1 | tee -a "$EVDIR/gate_output.log"

echo "Gate execution finished."
