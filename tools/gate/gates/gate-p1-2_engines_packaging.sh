#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "--- [GATE] P1-2 Engines Packaging START ---"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="docs/_evidence/p1_2_engines_packaging_${TS}"
mkdir -p "$EVIDENCE_DIR"

echo "[1/6] Build engines..."
pnpm -w build --filter @scu/engines-ce03 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce03.log"
pnpm -w build --filter @scu/engines-ce04 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce04.log"
pnpm -w build --filter @scu/engines-ce06 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce06.log"
pnpm -w build --filter @scu/engines-shot-render 2>&1 | tee "$EVIDENCE_DIR/build_engines_shot_render.log"
pnpm -w build --filter @scu/engines-video-merge 2>&1 | tee "$EVIDENCE_DIR/build_engines_video_merge.log"
pnpm -w build --filter @scu/billing 2>&1 | tee "$EVIDENCE_DIR/build_billing.log"

echo "[2/6] Runtime require from worker dir..."
pushd apps/workers >/dev/null
node -p "Object.keys(require(node -p "Object.keys(require(node -p "Object.keys(require(popd >/dev/null

echo "[3/6] Typecheck & build worker..."
pnpm -w typecheck --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/typecheck_worker.log"
pnpm -w build --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/build_worker.log"

echo "[4/6] Require worker dist main (smoke)..."
(
  # 最小必需 env：避免 config/jwt 初始化直接崩
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export NODE_ENV="${NODE_ENV:-development}"
  export GATE_MODE="${GATE_MODE:-0}"

  node -e "require() 2>&1 | tee "$EVIDENCE_DIR/require_worker_dist_main.log"

echo "[5/6] Boot worker in NON-GATE mode (8s smoke)..."
# 只验证能启动并进入轮询/初始化，不要求真实跑渲染
(
  export GATE_MODE=0
  export NODE_ENV=development
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export WORKER_ID="gate_p1_2_worker_1"
  export WORKER_PID_DIR="$ROOT_DIR/apps/workers/.runtime/pids"
  export DATABASE_URL="${DATABASE_URL}"
  export WORKER_API_KEY="ak_test"
  export WORKER_API_SECRET="sk_test"
  export API_URL="http://localhost:3001"
  timeout 8s node "$ROOT_DIR/apps/workers/dist/apps/workers/src/main.js"
) 2>&1 | tee "$EVIDENCE_DIR/boot_worker_non_gate.log" || true

grep -E "Worker|started|poll|Polling|boot|bootstrap|Bootstrap|loading" "$EVIDENCE_DIR/boot_worker_non_gate.log" >/dev/null || {
  echo "[FAIL] worker boot log did not contain expected liveness markers"
  exit 1
}

echo "[6/6] Summary..."
echo "Evidence: $EVIDENCE_DIR" | tee "$EVIDENCE_DIR/summary.txt"
echo "--- [GATE] P1-2 Engines Packaging PASS ---"

echo "--- [GATE] P1-2 Engines Packaging START ---"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="docs/_evidence/p1_2_engines_packaging_${TS}"
mkdir -p "$EVIDENCE_DIR"

echo "[1/6] Build engines..."
pnpm -w build --filter @scu/engines-ce03 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce03.log"
pnpm -w build --filter @scu/engines-ce04 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce04.log"
pnpm -w build --filter @scu/engines-ce06 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce06.log"
pnpm -w build --filter @scu/engines-shot-render 2>&1 | tee "$EVIDENCE_DIR/build_engines_shot_render.log"
pnpm -w build --filter @scu/engines-video-merge 2>&1 | tee "$EVIDENCE_DIR/build_engines_video_merge.log"
pnpm -w build --filter @scu/billing 2>&1 | tee "$EVIDENCE_DIR/build_billing.log"

echo "[2/6] Runtime require from worker dir..."
pushd apps/workers >/dev/null
node -p "Object.keys(require(node -p "Object.keys(require(node -p "Object.keys(require(popd >/dev/null

echo "[3/6] Typecheck & build worker..."
pnpm -w typecheck --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/typecheck_worker.log"
pnpm -w build --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/build_worker.log"

echo "[4/6] Require worker dist main (smoke)..."
(
  # 最小必需 env：避免 config/jwt 初始化直接崩
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export NODE_ENV="${NODE_ENV:-development}"
  export GATE_MODE="${GATE_MODE:-0}"

  node -e "require() 2>&1 | tee "$EVIDENCE_DIR/require_worker_dist_main.log"

echo "[5/6] Boot worker in NON-GATE mode (8s smoke)..."
# 只验证能启动并进入轮询/初始化，不要求真实跑渲染
(
  export GATE_MODE=0
  export NODE_ENV=development
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export WORKER_ID="gate_p1_2_worker_1"
  export WORKER_PID_DIR="$ROOT_DIR/apps/workers/.runtime/pids"
  export DATABASE_URL="${DATABASE_URL}"
  export WORKER_API_KEY="ak_test"
  export WORKER_API_SECRET="sk_test"
  export API_URL="http://localhost:3001"
  timeout 8s node "$ROOT_DIR/apps/workers/dist/apps/workers/src/main.js"
) 2>&1 | tee "$EVIDENCE_DIR/boot_worker_non_gate.log" || true

grep -E "Worker|started|poll|Polling|boot|bootstrap|Bootstrap|loading" "$EVIDENCE_DIR/boot_worker_non_gate.log" >/dev/null || {
  echo "[FAIL] worker boot log did not contain expected liveness markers"
  exit 1
}

echo "[6/6] Summary..."
echo "Evidence: $EVIDENCE_DIR" | tee "$EVIDENCE_DIR/summary.txt"
echo "--- [GATE] P1-2 Engines Packaging PASS ---"

echo "--- [GATE] P1-2 Engines Packaging START ---"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="docs/_evidence/p1_2_engines_packaging_${TS}"
mkdir -p "$EVIDENCE_DIR"

echo "[1/6] Build engines..."
pnpm -w build --filter @scu/engines-ce03 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce03.log"
pnpm -w build --filter @scu/engines-ce04 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce04.log"
pnpm -w build --filter @scu/engines-ce06 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce06.log"
pnpm -w build --filter @scu/engines-shot-render 2>&1 | tee "$EVIDENCE_DIR/build_engines_shot_render.log"
pnpm -w build --filter @scu/engines-video-merge 2>&1 | tee "$EVIDENCE_DIR/build_engines_video_merge.log"
pnpm -w build --filter @scu/billing 2>&1 | tee "$EVIDENCE_DIR/build_billing.log"

echo "[2/6] Runtime require from worker dir..."
pushd apps/workers >/dev/null
node -p "Object.keys(require(node -p "Object.keys(require(node -p "Object.keys(require(popd >/dev/null

echo "[3/6] Typecheck & build worker..."
pnpm -w typecheck --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/typecheck_worker.log"
pnpm -w build --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/build_worker.log"

echo "[4/6] Require worker dist main (smoke)..."
(
  # 最小必需 env：避免 config/jwt 初始化直接崩
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export NODE_ENV="${NODE_ENV:-development}"
  export GATE_MODE="${GATE_MODE:-0}"

  node -e "require() 2>&1 | tee "$EVIDENCE_DIR/require_worker_dist_main.log"

echo "[5/6] Boot worker in NON-GATE mode (8s smoke)..."
# 只验证能启动并进入轮询/初始化，不要求真实跑渲染
(
  export GATE_MODE=0
  export NODE_ENV=development
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export WORKER_ID="gate_p1_2_worker_1"
  export WORKER_PID_DIR="$ROOT_DIR/apps/workers/.runtime/pids"
  export DATABASE_URL="${DATABASE_URL}"
  export WORKER_API_KEY="ak_test"
  export WORKER_API_SECRET="sk_test"
  export API_URL="http://localhost:3001"
  timeout 8s node "$ROOT_DIR/apps/workers/dist/apps/workers/src/main.js"
) 2>&1 | tee "$EVIDENCE_DIR/boot_worker_non_gate.log" || true

grep -E "Worker|started|poll|Polling|boot|bootstrap|Bootstrap|loading" "$EVIDENCE_DIR/boot_worker_non_gate.log" >/dev/null || {
  echo "[FAIL] worker boot log did not contain expected liveness markers"
  exit 1
}

echo "[6/6] Summary..."
echo "Evidence: $EVIDENCE_DIR" | tee "$EVIDENCE_DIR/summary.txt"
echo "--- [GATE] P1-2 Engines Packaging PASS ---"

echo "--- [GATE] P1-2 Engines Packaging START ---"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="docs/_evidence/p1_2_engines_packaging_${TS}"
mkdir -p "$EVIDENCE_DIR"

echo "[1/6] Build engines..."
pnpm -w build --filter @scu/engines-ce03 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce03.log"
pnpm -w build --filter @scu/engines-ce04 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce04.log"
pnpm -w build --filter @scu/engines-ce06 2>&1 | tee "$EVIDENCE_DIR/build_engines_ce06.log"
pnpm -w build --filter @scu/engines-shot-render 2>&1 | tee "$EVIDENCE_DIR/build_engines_shot_render.log"
pnpm -w build --filter @scu/engines-video-merge 2>&1 | tee "$EVIDENCE_DIR/build_engines_video_merge.log"
pnpm -w build --filter @scu/billing 2>&1 | tee "$EVIDENCE_DIR/build_billing.log"

echo "[2/6] Runtime require from worker dir..."
pushd apps/workers >/dev/null
node -p "Object.keys(require(node -p "Object.keys(require(node -p "Object.keys(require(popd >/dev/null

echo "[3/6] Typecheck & build worker..."
pnpm -w typecheck --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/typecheck_worker.log"
pnpm -w build --filter @scu/worker 2>&1 | tee "$EVIDENCE_DIR/build_worker.log"

echo "[4/6] Require worker dist main (smoke)..."
(
  # 最小必需 env：避免 config/jwt 初始化直接崩
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export NODE_ENV="${NODE_ENV:-development}"
  export GATE_MODE="${GATE_MODE:-0}"

  node -e "require() 2>&1 | tee "$EVIDENCE_DIR/require_worker_dist_main.log"

echo "[5/6] Boot worker in NON-GATE mode (8s smoke)..."
# 只验证能启动并进入轮询/初始化，不要求真实跑渲染
(
  export GATE_MODE=0
  export NODE_ENV=development
  export JWT_SECRET="${JWT_SECRET:-gate_jwt_secret_p1_2}"
  export WORKER_ID="gate_p1_2_worker_1"
  export WORKER_PID_DIR="$ROOT_DIR/apps/workers/.runtime/pids"
  export DATABASE_URL="${DATABASE_URL}"
  export WORKER_API_KEY="ak_test"
  export WORKER_API_SECRET="sk_test"
  export API_URL="http://localhost:3001"
  timeout 8s node "$ROOT_DIR/apps/workers/dist/apps/workers/src/main.js"
) 2>&1 | tee "$EVIDENCE_DIR/boot_worker_non_gate.log" || true

grep -E "Worker|started|poll|Polling|boot|bootstrap|Bootstrap|loading" "$EVIDENCE_DIR/boot_worker_non_gate.log" >/dev/null || {
  echo "[FAIL] worker boot log did not contain expected liveness markers"
  exit 1
}

echo "[6/6] Summary..."
echo "Evidence: $EVIDENCE_DIR" | tee "$EVIDENCE_DIR/summary.txt"
echo "--- [GATE] P1-2 Engines Packaging PASS ---"
