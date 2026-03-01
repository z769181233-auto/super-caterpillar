#!/bin/bash
# Case A 验证进度监控脚本

set -euo pipefail

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

echo "═══════════════════════════════════════════════════"
echo "  Case A 验证进度监控"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"
echo ""

# 查找最近的测试项目
PROJECT_ID=$(psql "$DATABASE_URL" -tAc "
  SELECT id FROM projects 
  WHERE name LIKE 'Case A:%' 
  ORDER BY created_at DESC 
  LIMIT 1;
")

if [ -z "$PROJECT_ID" ]; then
  echo "❌ 未找到Case A测试项目"
  exit 1
fi

echo "📋 项目ID: $PROJECT_ID"
echo ""

# Job统计
echo "📊 Job执行统计:"
psql "$DATABASE_URL" -c "
  SELECT 
    type,
    status,
    COUNT(*) as count
  FROM shot_jobs
  WHERE project_id = '$PROJECT_ID'
  GROUP BY type, status
  ORDER BY type, status;
"
echo ""

# Episode和Scene统计  
echo "📚 数据生成统计:"
EPISODE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM episodes WHERE project_id = '$PROJECT_ID';")
SCENE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM scenes WHERE project_id = '$PROJECT_ID';")

echo "  Episodes: $EPISODE_COUNT"
echo "  Scenes: $SCENE_COUNT"
echo ""

# 质量评分
if [ "$SCENE_COUNT" -gt 0 ]; then
  echo "⭐ 质量评分:"
  psql "$DATABASE_URL" -c "
    SELECT 
      AVG(quality_score)::numeric(5,3) as avg_quality,
      MIN(quality_score)::numeric(5,3) as min_quality,
      MAX(quality_score)::numeric(5,3) as max_quality
    FROM scenes
    WHERE project_id = '$PROJECT_ID';
  "
  echo ""
fi

# 成本统计
echo "💰 成本消耗:"
TOTAL_COST=$(psql "$DATABASE_URL" -tAc "SELECT COALESCE(SUM(cost_amount), 0) FROM billing_ledger WHERE project_id = '$PROJECT_ID';")
echo "  总成本: \$$TOTAL_COST"

if (( $(echo "$TOTAL_COST > 0" | bc -l) )); then
  psql "$DATABASE_URL" -c "
    SELECT 
      engine_key,
      SUM(cost_amount)::numeric(10,4) as total_cost,
      COUNT(*) as events
    FROM billing_ledger
    WHERE project_id = '$PROJECT_ID'
    GROUP BY engine_key
    ORDER BY total_cost DESC
    LIMIT 10;
  "
fi
echo ""

# Worker状态
echo "🔧 Worker状态:"
psql "$DATABASE_URL" -c "
  SELECT 
    worker_id,
    status,
    last_heartbeat
  FROM worker_nodes
  ORDER BY last_heartbeat DESC;
"
echo ""

# 最近错误（如有）
ERROR_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shot_jobs WHERE project_id = '$PROJECT_ID' AND status = 'FAILED';")
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  发现 $ERROR_COUNT 个失败Job:"
  psql "$DATABASE_URL" -c "
    SELECT 
      id,
      type,
      updated_at
    FROM shot_jobs
    WHERE project_id = '$PROJECT_ID' AND status = 'FAILED'
    ORDER BY updated_at DESC
    LIMIT 5;
  "
fi

echo "═══════════════════════════════════════════════════"
echo "刷新: watch -n 30 bash tools/gate/scripts/monitor_case_a.sh"
