#!/usr/bin/env bash
# Stage2-A 运行时验证脚本
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# 获取数据库连接信息
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgresql://127.0.0.1:5432/super_caterpillar}"

echo "=== Stage2-A 运行时验证 ==="
echo ""

# STEP 1: 检查 API 状态
echo "STEP 1: 检查 API 状态..."
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✅ API 运行在端口 3000"
  API_PID=$(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -1 | awk '{print $2}')
  echo "   PID: $API_PID"
else
  echo "❌ API 未运行，请先启动: pnpm --filter api dev"
  exit 1
fi

# STEP 2: 创建测试 Worker（如果不存在）
echo ""
echo "STEP 2: 准备测试 Worker..."
psql "$DATABASE_URL" -c "
INSERT INTO worker_nodes (id, worker_id, status, capabilities, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'test_worker_001',
  'online',
  '{}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM worker_nodes WHERE worker_id = 'test_worker_001'
);
" -t -q

WORKER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM worker_nodes WHERE worker_id = 'test_worker_001' LIMIT 1;" | tr -d ' ')
echo "✅ Worker ID: $WORKER_ID"

# STEP 3: 查找现有 Project/Shot
echo ""
echo "STEP 3: 查找测试数据..."
SHOT_INFO=$(psql "$DATABASE_URL" -t -c "
SELECT s.id, s.scene_id, sc.episode_id, e.season_id, se.project_id, se.organization_id
FROM shots s
JOIN scenes sc ON s.scene_id = sc.id
JOIN episodes e ON sc.episode_id = e.id
JOIN seasons se ON e.season_id = se.id
ORDER BY s.created_at DESC
LIMIT 1;
" | tr -d ' ')

if [ -z "$SHOT_INFO" ]; then
  echo "❌ 未找到 Shot，需要先创建测试数据"
  exit 1
fi

SHOT_ID=$(echo "$SHOT_INFO" | cut -d'|' -f1)
SCENE_ID=$(echo "$SHOT_INFO" | cut -d'|' -f2)
EPISODE_ID=$(echo "$SHOT_INFO" | cut -d'|' -f3)
SEASON_ID=$(echo "$SHOT_INFO" | cut -d'|' -f4)
PROJECT_ID=$(echo "$SHOT_INFO" | cut -d'|' -f5)
ORG_ID=$(echo "$SHOT_INFO" | cut -d'|' -f6)

echo "✅ Shot ID: $SHOT_ID"
echo "✅ Project ID: $PROJECT_ID"

# STEP 4: 创建 PENDING Job
echo ""
echo "STEP 4: 创建 PENDING Job..."
JOB_ID=$(psql "$DATABASE_URL" -t -c "
INSERT INTO shot_jobs (
  id, organization_id, project_id, episode_id, scene_id, shot_id,
  type, status, payload, priority, max_retry, created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  '$ORG_ID',
  '$PROJECT_ID',
  '$EPISODE_ID',
  '$SCENE_ID',
  '$SHOT_ID',
  'CE03_VISUAL_DENSITY',
  'PENDING',
  '{}'::jsonb,
  0,
  3,
  now(),
  now()
)
RETURNING id;
" | tr -d ' ')

echo "✅ 创建 Job: $JOB_ID"

# 验证 Job 状态
JOB_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE id = '$JOB_ID';" | tr -d ' ')
echo "   Status: $JOB_STATUS"

# STEP 5: Worker 心跳
echo ""
echo "STEP 5: Worker 心跳..."
psql "$DATABASE_URL" -c "
INSERT INTO worker_heartbeats (worker_id, last_seen_at, status, created_at, updated_at)
VALUES (
  'test_worker_001',
  now(),
  'ALIVE',
  now(),
  now()
)
ON CONFLICT (worker_id) DO UPDATE
SET last_seen_at = now(), status = 'ALIVE', updated_at = now();
" -t -q

HEARTBEAT_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM worker_heartbeats WHERE worker_id = 'test_worker_001';" | tr -d ' ')
echo "✅ WorkerHeartbeat Status: $HEARTBEAT_STATUS"

# STEP 6: 输出验证信息
echo ""
echo "=== 验证数据已准备 ==="
echo "Job ID: $JOB_ID"
echo "Worker ID: test_worker_001"
echo "Shot ID: $SHOT_ID"
echo ""
echo "请继续执行以下步骤："
echo "1. 调用 API 领取 Job: POST /api/workers/test_worker_001/jobs/next"
echo "2. 验证 Job 状态变为 DISPATCHED"
echo "3. 模拟 Worker 超时并触发回收"
echo "4. 测试 Job report 接口"

