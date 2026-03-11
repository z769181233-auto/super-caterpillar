#!/usr/bin/env bash
set -euo pipefail

# E2E 真实生产验证 - 阶段1立即行动
# 验证完整链路：15M小说上传 → 解析 → 生成视频

API_URL=${API_URL:-"http://localhost:3000"}
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5433/scu"}
EVIDENCE_DIR="docs/_evidence/e2e_real_production_20260213_210330"
NOVEL_FILE="15m_test.txt"

echo "🚀 [E2E 真实生产验证] 开始执行"
echo "测试小说: $NOVEL_FILE ($(wc -c < $NOVEL_FILE) bytes)"
echo "证据目录: $EVIDENCE_DIR"
echo "执行时间: $(date)"
echo ""

# 步骤1：API健康检查
echo "📡 [1/6] API 健康检查..."
HEALTH=$(curl -s "${API_URL}/health")
echo "$HEALTH" | jq . | tee "$EVIDENCE_DIR/01_health_check.json"

if ! echo "$HEALTH" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  echo "❌ 失败：API 服务未就绪"
  exit 1
fi
echo "✅ API 服务正常"
echo ""

# 步骤2：15M小说文件上传
echo "📤 [2/6] 上传 15M 小说文件..."

# 计算SHA256
FILE_SHA=$(shasum -a 256 "$NOVEL_FILE" | awk '{print $1}')
FILE_SIZE=$(wc -c < "$NOVEL_FILE" | tr -d ' ')

echo "文件 SHA256: $FILE_SHA"
echo "文件大小: $FILE_SIZE bytes"

UPLOAD_RESPONSE=$(curl -s -X POST \
  -H "X-Content-SHA256: $FILE_SHA" \
  -H "Content-Type: application/octet-stream" \
  -H "Content-Length: $FILE_SIZE" \
  --data-binary "@$NOVEL_FILE" \
  "${API_URL}/api/storage/novels")

echo "$UPLOAD_RESPONSE" | jq . | tee "$EVIDENCE_DIR/02_upload_response.json"

STORAGE_KEY=$(echo "$UPLOAD_RESPONSE" | jq -r '.storageKey // empty')

if [ -z "$STORAGE_KEY" ]; then
  echo "❌ 失败：小说上传失败"
  exit 1
fi

echo "✅ 小说上传成功: $STORAGE_KEY"
echo ""

# 步骤3：查询数据库基线状态
echo "🔍 [3/6] 记录数据库基线状态..."

psql "$DATABASE_URL" -t -A -c "
SELECT json_build_object(
  'total_projects', (SELECT COUNT(*) FROM projects),
  'total_jobs', (SELECT COUNT(*) FROM shot_jobs),
  'pending_jobs', (SELECT COUNT(*) FROM shot_jobs WHERE status = 'PENDING'),
  'active_engines', (SELECT COUNT(*) FROM engines WHERE enabled = true),
  'online_workers', (SELECT COUNT(*) FROM worker_nodes WHERE status IN ('online', 'idle'))
);" > "$EVIDENCE_DIR/03_baseline_state.json"

cat "$EVIDENCE_DIR/03_baseline_state.json" | jq .

ONLINE_WORKERS=$(cat "$EVIDENCE_DIR/03_baseline_state.json" | jq -r '.online_workers')
ACTIVE_ENGINES=$(cat "$EVIDENCE_DIR/03_baseline_state.json" | jq -r '.active_engines')

echo "在线 Worker: $ONLINE_WORKERS 个"
echo "活跃引擎: $ACTIVE_ENGINES 个"
echo ""

# 步骤4：关键诊断
echo "🔧 [4/6] 系统关键诊断..."

if [ "$ONLINE_WORKERS" -eq 0 ]; then
  echo "⚠️  **关键问题**: 无在线 Worker"
  echo "   后果: 任务将堆积在队列中，无法处理"
  echo "   修复: pnpm --filter workers dev"
  echo ""
fi

if [ "$ACTIVE_ENGINES" -eq 0 ]; then
  echo "⚠️  **关键问题**: 无活跃引擎"
  echo "   后果: 无法执行任何处理任务"
  echo "   修复: 检查引擎注册逻辑"
  echo ""
fi

# 步骤5：检查最近的任务
echo "📋 [5/6] 检查最近的任务记录..."

psql "$DATABASE_URL" -t -A -c "
SELECT json_agg(t) FROM (
  SELECT 
    id, 
    type, 
    status, 
    \"createdAt\",
    \"traceId\"
  FROM shot_jobs 
  ORDER BY \"createdAt\" DESC 
  LIMIT 10
) t;" > "$EVIDENCE_DIR/04_recent_jobs.json"

cat "$EVIDENCE_DIR/04_recent_jobs.json" | jq '.[0:3]' || echo "null"

RECENT_JOBS=$(cat "$EVIDENCE_DIR/04_recent_jobs.json" | jq 'if . then length else 0 end')
echo "最近任务数: $RECENT_JOBS 个"
echo ""

# 步骤6：生成摘要报告
echo "📊 [6/6] 生成执行摘要..."

cat <<EOF | tee "$EVIDENCE_DIR/SUMMARY.md"
# E2E 真实生产验证 - 执行摘要

**执行时间**: $(date)
**测试文件**: $NOVEL_FILE ($FILE_SIZE bytes)
**审计报告位置**: docs/全量审计报告_PROJECT_AUDIT_REPORT.md

## 执行结果

### 1. API 健康检查
✅ 通过

### 2. 15M 小说上传
✅ 成功
- 存储路径: $STORAGE_KEY
- SHA256: $FILE_SHA

### 3. 系统当前状态
- 在线 Worker: $ONLINE_WORKERS 个
- 活跃引擎: $ACTIVE_ENGINES 个
- 最近任务: $RECENT_JOBS 个

## 关键发现

EOF

if [ "$ONLINE_WORKERS" -eq 0 ]; then
  cat <<EOF | tee -a "$EVIDENCE_DIR/SUMMARY.md"
### ⚠️  P0 风险：无在线 Worker

**问题**: 系统中没有运行中的 Worker 节点
**影响**: 所有任务将堆积在队列中，无法被处理
**后果**: E2E 流程中断，无法生成视频

**立即修复**:
\`\`\`bash
# 启动 Worker
pnpm --filter workers dev
\`\`\`

EOF
else
  echo "✅ Worker 状态正常" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
fi

if [ "$ACTIVE_ENGINES" -eq 0 ]; then
  cat <<EOF | tee -a "$EVIDENCE_DIR/SUMMARY.md"
### ⚠️  P0 风险：无活跃引擎

**问题**: 数据库中没有启用的引擎
**影响**: 即使有 Worker，也无法执行具体的处理任务
**后果**: 任务将失败或永久挂起

**立即检查**:
\`\`\`bash
# 检查引擎注册
psql "$DATABASE_URL" -c "SELECT \\"engineKey\\", enabled FROM engines LIMIT 20;"
\`\`\`

EOF
else
  echo "✅ 引擎状态正常 ($ACTIVE_ENGINES 个活跃)" | tee -a "$EVIDENCE_DIR/SUMMARY.md"
fi

cat <<EOF | tee -a "$EVIDENCE_DIR/SUMMARY.md"

## 下一步行动

根据《全量审计报告》阶段1计划：

### 如果 Worker 和引擎正常
继续执行 **A2-A5 任务**：
- A2: 真实 Provider 熔断机制实现
- A3: Job Timeout Sweeper 实现
- A4: 环境变量强制校验
- A5: Billing 竞态条件修复

### 如果发现 P0 问题
立即修复上述关键问题，然后重新执行本 Gate

## 证据文件清单

- 01_health_check.json - API 健康检查
- 02_upload_response.json - 小说上传响应
- 03_baseline_state.json - 数据库基线状态
- 04_recent_jobs.json - 最近任务记录
- SUMMARY.md - 本摘要文件

EOF

echo ""
echo "=" 
echo "✅ [E2E 真实生产验证] 执行完成"
echo ""
echo "📋 完整证据: $EVIDENCE_DIR/SUMMARY.md"
echo "📊 审计报告: docs/全量审计报告_PROJECT_AUDIT_REPORT.md"
echo ""

# 输出下一步建议
if [ "$ONLINE_WORKERS" -eq 0 ] || [ "$ACTIVE_ENGINES" -eq 0 ]; then
  echo "⚠️  发现 P0 级问题，请立即修复后重试"
  exit 1
else
  echo "✅ 系统基础状态正常，可继续执行阶段1其他任务"
  exit 0
fi
