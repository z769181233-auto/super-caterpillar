#!/bin/bash
# Stage13 CE Core Layer 验证脚本
# 验证 CE06 → CE03 → CE04 完整链路

set -e

API_URL="${API_URL:-http://localhost:3000}"
PROJECT_ID=""
TRACE_ID=""

echo "=== Stage13 CE Core Layer 验证脚本 ==="
echo "API URL: $API_URL"
echo ""

# 1. 检查 API 是否可访问
echo "1. 检查 API 健康状态..."
if ! curl -s "$API_URL/api/health" > /dev/null; then
  echo "❌ API 不可访问，请确保 API 服务已启动"
  exit 1
fi
echo "✅ API 可访问"
echo ""

# 2. 创建测试项目（需要 JWT token，这里简化处理）
echo "2. 创建测试项目..."
echo "⚠️  注意：需要手动创建项目并获取 projectId"
echo "   请在上传小说后，将 projectId 设置到环境变量："
echo "   export PROJECT_ID=<your-project-id>"
echo ""

if [ -z "$PROJECT_ID" ]; then
  read -p "请输入 projectId: " PROJECT_ID
fi

# 3. 上传测试小说（需要手动操作或提供 API token）
echo "3. 上传测试小说..."
echo "⚠️  请手动调用 POST /api/projects/$PROJECT_ID/novel/import-file"
echo "   或使用 curl 命令上传小说文件"
echo ""

# 4. 等待 CE06 Job 完成
echo "4. 等待 CE06 Job 完成..."
CE06_JOB_ID=""
MAX_WAIT=300  # 最多等待 5 分钟
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  # 查询 CE06 Job 状态（需要 API token，这里简化）
  echo "   检查 CE06 Job 状态... (${WAIT_COUNT}s)"
  sleep 5
  WAIT_COUNT=$((WAIT_COUNT + 5))
  
  # TODO: 实际查询 Job 状态
  # if [ "$CE06_STATUS" == "SUCCEEDED" ]; then
  #   echo "✅ CE06 Job 完成"
  #   break
  # fi
done

# 5. 查询审计日志
echo ""
echo "5. 查询审计日志..."
echo "   请手动查询数据库："
echo "   SELECT * FROM audit_logs WHERE resource_id IN ("
echo "     SELECT id FROM shot_jobs WHERE project_id = '$PROJECT_ID' AND type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')"
echo "   ) ORDER BY created_at;"
echo ""

# 6. 验证数据落库
echo "6. 验证数据落库..."
echo "   请手动查询："
echo "   - NovelParseResult: SELECT * FROM novel_parse_results WHERE project_id = '$PROJECT_ID';"
echo "   - QualityMetrics: SELECT * FROM quality_metrics WHERE project_id = '$PROJECT_ID';"
echo ""

echo "=== 验证完成 ==="
echo "请检查："
echo "1. audit_logs 表中存在 3 条记录（CE06/CE03/CE04）"
echo "2. 同一 traceId 下的记录时间顺序正确"
echo "3. novel_parse_results 表有数据"
echo "4. quality_metrics 表有 CE03 和 CE04 的记录"

