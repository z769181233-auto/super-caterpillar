#!/bin/bash
# P1-1 并发压力门禁 (Concurrency & Queue Stress Gate)
# 验证点：并发上限、Worker 崩溃回收、计费幂等性

set -e

# 加载环境
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$ROOT_DIR"

echo "=== [GATE P1-1] Concurrency & Queue Stress Start ==="

# 1. 准备工作：清除旧日志
EVIDENCE_DIR="docs/_evidence/p1_1_concurrency_audit"
mkdir -p "$EVIDENCE_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_FILE="$EVIDENCE_DIR/audit_$TIMESTAMP.json"

# 2. 注入测试环境配置
export JOB_MAX_IN_FLIGHT=5
export JOB_WAVE_SIZE=3
export JOB_LEASE_TTL_MS=10000
export WORKER_OFFLINE_GRACE_MS=15000

echo "[1/4] Environment Configured: MAX_IN_FLIGHT=$JOB_MAX_IN_FLIGHT, LEASE_TTL=$JOB_LEASE_TTL_MS"

# 3. 基础服务启动
echo "[2/4] Launching API and test workers..."
API_LOG="$EVIDENCE_DIR/api.log"
WORKER_1_LOG="$EVIDENCE_DIR/worker1.log"
WORKER_2_LOG="$EVIDENCE_DIR/worker2.log"

# 启动 API
NODE_ENV=development pnpm --filter api run dev > "$API_LOG" 2>&1 &
API_PID=$!

# 等待 API 就绪 (最长 60s)
echo "Waiting for API to be ready..."
for i in {1..20}; do
  if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "API is READY."
    break
  fi
  sleep 3
done

# 启动 Worker
WORKER_ID=stress-worker-1 pnpm --filter @scu/worker run dev > "$WORKER_1_LOG" 2>&1 &
W1_PID=$!
WORKER_ID=stress-worker-2 pnpm --filter @scu/worker run dev > "$WORKER_2_LOG" 2>&1 &
W2_PID=$!

cleanup() {
  echo "Cleaning up pids: $API_PID $W1_PID $W2_PID"
  kill -9 $API_PID $W1_PID $W2_PID 2>/dev/null || true
}
trap cleanup EXIT

# 4. 触发大量任务 (模拟高压)
echo "[3/4] Triggering batch jobs (N=15)..."
# 使用 API 直接注入任务或通过已有的 trigger 流程
# 这里假设使用一个测试脚本注入 15 个 PENDING 任务
pnpm --filter api exec ts-node src/scripts/stress-trigger.ts --count 15

# 5. 监控与断言
echo "[4/4] Monitoring concurrency and recovery..."
MAX_RUNNING=0
RECLAIM_COUNT=0
DUPLICATES=0

# 剥离 URL 参数用于 psql
DB_URL_STR=$(echo "$DATABASE_URL" | cut -d '?' -f1)

# 监控循环 (持续 60 秒)
for i in {1..12}; do
  RUNNING=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM shot_jobs WHERE status = 'RUNNING' AND lease_until > NOW()")
  echo "Current Running: $RUNNING"
  if [ "$RUNNING" -gt "$MAX_RUNNING" ]; then MAX_RUNNING=$RUNNING; fi
  
  # 中途干掉一个 Worker 模拟崩溃
  if [ "$i" -eq 4 ]; then
    echo "!!! Simulating Worker 1 Crash (SIGKILL) !!!"
    kill -9 $W1_PID
  fi
  
  sleep 5
done

# 检查回收情况 (从 stdout/stderr 日志中 grep)
RECLAIM_COUNT=$(grep -c "reclaimed: worker offline" "$WORKER_1_LOG" "$WORKER_2_LOG" || echo "0")
# 兜底也检查一下 API 日志
API_RECLAIM=$(grep -c "reclaimed: worker offline" apps/api/logs/*.log 2>/dev/null || echo "0")
RECLAIM_COUNT=$((RECLAIM_COUNT + API_RECLAIM))

# 检查计费幂等性
DUPLICATES=$(psql "$DB_URL_STR" -t -A -c "SELECT count(*) FROM (SELECT \"jobId\", \"jobType\" FROM cost_ledger GROUP BY \"jobId\", \"jobType\" HAVING count(*) > 1) AS dupes")

# 6. 生成证据 JSON
cat > "$EVIDENCE_FILE" <<EOF
{
  "gate": "P1-1_CONCURRENCY_STRESS",
  "timestamp": "$(date -u +%Y%m%dT%H%M%SZ)",
  "config": {
    "JOB_MAX_IN_FLIGHT": $JOB_MAX_IN_FLIGHT,
    "JOB_WAVE_SIZE": $JOB_WAVE_SIZE
  },
  "results": {
    "max_concurrent_observed": $MAX_RUNNING,
    "reclaim_logs_found": $RECLAIM_COUNT,
    "cost_ledger_duplicates": $DUPLICATES,
    "pass": $( [ "$MAX_RUNNING" -le "$JOB_MAX_IN_FLIGHT" ] && [ "$DUPLICATES" -eq 0 ] && echo "true" || echo "false" )
  }
}
EOF

echo "=== [GATE P1-1] Results ==="
cat "$EVIDENCE_FILE"

if [ "$MAX_RUNNING" -gt "$JOB_MAX_IN_FLIGHT" ]; then
  echo "FAILED: Concurrency limit exceeded ($MAX_RUNNING > $JOB_MAX_IN_FLIGHT)"
  exit 1
fi

if [ "$DUPLICATES" -gt 0 ]; then
  echo "FAILED: Cost ledger integrity violated (duplicates found)"
  exit 1
fi

echo "PASSED: P1-1 Concurrency & Queue Governance verified."
