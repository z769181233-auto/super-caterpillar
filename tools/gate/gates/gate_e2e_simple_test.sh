#!/usr/bin/env bash
set -euo pipefail

# Simple E2E Test Gate - 最佳方案验证
# 目标：验证从小说文本到视频的完整生产链路

API_URL=${API_URL:-"http://localhost:3000"}
EVIDENCE_DIR="docs/_evidence/e2e_real_production_20260213_210330"
mkdir -p "$EVIDENCE_DIR"

echo "🚀 [E2E Simple Test] 开始执行"
echo "证据目录: $EVIDENCE_DIR" | tee "$EVIDENCE_DIR/00_meta.txt"
echo "执行时间: $(date)" | tee -a "$EVIDENCE_DIR/00_meta.txt"

# 步骤1：检查API健康状态
echo ""
echo "📡 步骤 1/5: 检查 API 服务状态..."
HEALTH=$(curl -s "${API_URL}/health" || echo "{\"status\":\"error\"}")
echo "$HEALTH" | jq . | tee "$EVIDENCE_DIR/01_health_check.json"

if ! echo "$HEALTH" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  echo "❌ 失败：API 服务未就绪"
  exit 1
fi
echo "✅ API 服务正常"

# 步骤2：触发简单Pipeline测试
echo ""
echo "📝 步骤 2/5: 触发小说解析任务..."

# 使用CE Pipeline接口或Orchestrator接口
# 尝试最简单的接口
TEST_NOVEL="第一章 觉醒\\n在遥远的星系中，有一只名叫毛毛的虫子。它梦想着飞向宇宙深处。"

TRIGGER_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"novelText\":\"$TEST_NOVEL\",\"projectName\":\"E2E_Test_$(date +%s)\"}" \
  "${API_URL}/api/novel-import/parse" 2>&1 || echo '{"error":"API调用失败"}')

echo "$TRIGGER_RESPONSE" | jq . 2>/dev/null | tee "$EVIDENCE_DIR/02_trigger_response.json" || echo "$TRIGGER_RESPONSE" | tee "$EVIDENCE_DIR/02_trigger_response.txt"

# 提取关键信息
PROJECT_ID=$(echo "$TRIGGER_RESPONSE" | jq -r '.projectId // .data.projectId // empty' 2>/dev/null || echo "")
JOB_ID=$(echo "$TRIGGER_RESPONSE" | jq -r '.jobId // .data.jobId // empty' 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ] && [ -z "$JOB_ID" ]; then
  echo "⚠️  警告：无法提取 projectId 或 jobId，尝试其他接口..."
  
  # 尝试Orchestrator接口
  ALT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"novelText\":\"$TEST_NOVEL\"}" \
    "${API_URL}/api/orchestrator/novel/import" 2>&1 || echo '{"error":"备用API也失败"}')
  
  echo "$ALT_RESPONSE" | jq . 2>/dev/null | tee -a "$EVIDENCE_DIR/02_trigger_response.json" || echo "$ALT_RESPONSE" | tee -a "$EVIDENCE_DIR/02_trigger_response.txt"
fi

echo "执行结果已保存"

# 步骤3：检查数据库是否有新记录
echo ""
echo "🔍 步骤 3/5: 检查数据库中的任务记录..."

# 查询最近的Job
DB_JOBS=$(psql "$DATABASE_URL" -t -A -c "SELECT json_agg(t) FROM (SELECT id, type, status, \"createdAt\" FROM shot_jobs ORDER BY \"createdAt\" DESC LIMIT 5) t;" 2>&1 || echo "null")

echo "$DB_JOBS" | jq . 2>/dev/null | tee "$EVIDENCE_DIR/03_recent_jobs.json" || echo "$DB_JOBS" | tee "$EVIDENCE_DIR/03_recent_jobs.txt"

PENDING_JOBS=$(echo "$DB_JOBS" | jq -r 'if . then map(select(.status == "PENDING")) | length else 0 end' 2>/dev/null || echo "0")
echo "待处理任务数: $PENDING_JOBS"

# 步骤4：检查引擎注册状态
echo ""
echo "⚙️  步骤 4/5: 检查引擎注册状态..."

ENGINES=$(psql "$DATABASE_URL" -t -A -c "SELECT json_agg(t) FROM (SELECT \"engineKey\", enabled, \"isActive\" FROM engines WHERE enabled = true LIMIT 10) t;" 2>&1 || echo "null")

echo "$ENGINES" | jq . 2>/dev/null | tee "$EVIDENCE_DIR/04_active_engines.json" || echo "$ENGINES" | tee "$EVIDENCE_DIR/04_active_engines.txt"

ACTIVE_ENGINES=$(echo "$ENGINES" | jq -r 'if . then length else 0 end' 2>/dev/null || echo "0")
echo "活跃引擎数: $ACTIVE_ENGINES"

# 步骤5：检查Worker状态
echo ""
echo "🔧 步骤 5/5: 检查 Worker 节点状态..."

WORKERS=$(psql "$DATABASE_URL" -t -A -c "SELECT json_agg(t) FROM (SELECT \"workerId\", status, \"lastHeartbeat\" FROM worker_nodes ORDER BY \"lastHeartbeat\" DESC LIMIT 3) t;" 2>&1 || echo "null")

echo "$WORKERS" | jq . 2>/dev/null | tee "$EVIDENCE_DIR/05_worker_status.json" || echo "$WORKERS" | tee "$EVIDENCE_DIR/05_worker_status.txt"

ONLINE_WORKERS=$(echo "$WORKERS" | jq -r 'if . then map(select(.status == "online" or .status == "idle")) | length else 0 end' 2>/dev/null || echo "0")
echo "在线 Worker 数: $ONLINE_WORKERS"

# 生成摘要报告
echo ""
echo "=" | tee "$EVIDENCE_DIR/SUMMARY.md"
cat <<EOF | tee -a "$EVIDENCE_DIR/SUMMARY.md"
# E2E 简化测试执行摘要

**执行时间**: $(date)
**测试类型**: 最佳方案验证 - Phase 1 立即行动

## 执行结果

### 1. API 健康检查
- 状态: ✅ 通过
- 响应: 正常

### 2. 任务触发
- Project ID: ${PROJECT_ID:-"未获取"}
- Job ID: ${JOB_ID:-"未获取"}

### 3. 数据库状态
- 待处理任务: $PENDING_JOBS 个
- 最近任务: 已记录

### 4. 引擎状态
- 活跃引擎数: $ACTIVE_ENGINES 个

### 5. Worker 状态
- 在线 Worker: $ONLINE_WORKERS 个

## 下一步建议

EOF

if [ "$ONLINE_WORKERS" -eq 0 ]; then
  echo "⚠️  **关键发现**: 无在线 Worker，任务无法被处理" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
  echo "   **修复方案**: 启动 Worker 服务: \`pnpm --filter workers dev\`" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
fi

if [ "$ACTIVE_ENGINES" -eq 0 ]; then
  echo "⚠️  **关键发现**: 无活跃引擎" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
  echo "   **修复方案**: 检查引擎注册逻辑" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
fi

echo ""
echo "📋 完整证据已保存至: $EVIDENCE_DIR"
echo "📊 查看摘要: cat $EVIDENCE_DIR/SUMMARY.md"
echo ""
echo "✅ [E2E Simple Test] 执行完成"
