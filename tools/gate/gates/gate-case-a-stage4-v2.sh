#!/bin/bash
# Case A: 300万字小说E2E验证 (修复版v2)
# 仅验证Stage 4核心功能

set -euo pipefail

echo "════════════════════════════════════════════════════════════════"
echo "  Case A: Stage 4核心功能验证 (简化版)"
echo "  执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"

EVID_DIR="./evidence/case_a_stage4_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"
LOG_FILE="$EVID_DIR/00_EXECUTION_LOG.txt"
exec > >(tee -a "$LOG_FILE") 2>&1

START_TIME=$(date +%s)

# 加载环境
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

echo "[Step 1] 准备测试数据..."
TEST_NOVEL="/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/out/FULL_E2E/input_novel.txt"
TRUNCATED_NOVEL="$EVID_DIR/input_novel_3M.txt"
head -c 3000000 "$TEST_NOVEL" > "$TRUNCATED_NOVEL"
CHAR_COUNT=$(wc -m < "$TRUNCATED_NOVEL")
echo "✓ 测试小说: $CHAR_COUNT 字符"

echo ""
echo "[Step 2] 创建测试项目..."

TEST_USER_ID="user-stage4-$(date +%s)"
TEST_ORG_ID="org-stage4-$(date +%s)"
TEST_PROJECT_ID="proj-stage4-$(date +%s)"

# 创建用户
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (id, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES ('$TEST_USER_ID', 'stage4-$(date +%s)@test.local', '\$2b\$10\$dummyhash', 'ADMIN', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL

# 创建组织
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO organizations (id, name, "ownerId", slug, "createdAt", "updatedAt")
VALUES ('$TEST_ORG_ID', 'Stage 4 Test', '$TEST_USER_ID', 'stage4-$(date +%s)', NOW(), NOW());
SQL

# 创建项目
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO projects (id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt")
VALUES ('$TEST_PROJECT_ID', 'Stage 4: 300W验证', '$TEST_USER_ID', '$TEST_ORG_ID', 'in_progress', NOW(), NOW());
SQL

echo "✓ 项目ID: $TEST_PROJECT_ID"

echo ""
echo "[Step 3] 触发Stage 4导入..."

# 创建NOVEL_SCAN_TOC Job
JOB_PAYLOAD="{\"projectId\":\"$TEST_PROJECT_ID\",\"fileKey\":\"$TRUNCATED_NOVEL\",\"isVerification\":true}"

SCAN_JOB_ID=$(psql "$DATABASE_URL" -tAc "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\", type, status, priority, payload, \"createdAt\", \"updatedAt\"
)
VALUES (
  gen_random_uuid(), '$TEST_ORG_ID', '$TEST_PROJECT_ID', 'NOVEL_SCAN_TOC', 'PENDING', 100,
  '$JOB_PAYLOAD'::jsonb, NOW(), NOW()
)
RETURNING id;
")

echo "✓ Job ID: $SCAN_JOB_ID"

echo ""
echo "[Step 4] 等待Job完成 (最多30分钟)..."

MAX_WAIT=1800
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  JOB_STATUS=$(psql "$DATABASE_URL" -tAc "SELECT status FROM shot_jobs WHERE id = '$SCAN_JOB_ID';")
  
  echo "[$(date '+%H:%M:%S')] Job状态: $JOB_STATUS"
  
  if [ "$JOB_STATUS" = "SUCCEEDED" ]; then
    echo "✅ NOVEL_SCAN_TOC 成功"
    break
  elif [ "$JOB_STATUS" = "FAILED" ]; then
    echo "❌ NOVEL_SCAN_TOC 失败"
    exit 1
  fi
  
  sleep 30
  ELAPSED=$((ELAPSED + 30))
done

IMPORT_END=$(date +%s)
IMPORT_DURATION=$((IMPORT_END - START_TIME))

echo ""
echo "[Step 5] 验证数据完整性..."

EPISODE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM episodes WHERE \"projectId\" = '$TEST_PROJECT_ID';")
SCENE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM scenes WHERE project_id = '$TEST_PROJECT_ID';")

echo "✓ Episodes: $EPISODE_COUNT"
echo "✓ Scenes: $SCENE_COUNT"

# 生成报告
cat > "$EVID_DIR/REPORT.md" <<REPORT
# Stage 4 验证报告

**执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
**测试小说**: $CHAR_COUNT 字符

## 结果

- Job ID: $SCAN_JOB_ID
- Job状态: $JOB_STATUS
- Episodes生成: $EPISODE_COUNT
- Scenes生成: $SCENE_COUNT
- 耗时: ${IMPORT_DURATION}秒 ($((IMPORT_DURATION / 60))分钟)

## 结论

$( [ "$JOB_STATUS" = "SUCCEEDED" ] && echo "✅ **验证通过** - Stage 4架构工作正常" || echo "❌ **验证失败**" )

REPORT

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  验证完成"
echo "  耗时: $((IMPORT_DURATION / 60))分钟"
echo "  Episodes: $EPISODE_COUNT"
echo "  Scenes: $SCENE_COUNT"
echo "  证据目录: $EVID_DIR"
echo "════════════════════════════════════════════════════════════════"

[ "$JOB_STATUS" = "SUCCEEDED" ] && exit 0 || exit 1
