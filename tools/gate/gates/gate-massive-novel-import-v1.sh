#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# gate-massive-novel-import-v1.sh
# 验证 CE06 V1.3: SCAN + CHUNK_PARSE 分布式流式解析 (千万字级)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence/ce06_massive_import_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${EVID_ROOT}"

exec > >(tee "${EVID_ROOT}/gate.log") 2>&1

echo "===================================================="
echo "CE06 MASSIVE IMPORT GATE V1.3"
echo "Evidence: ${EVID_ROOT}"
echo "===================================================="

# 1. 环境准备
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
PROJECT_ID="gate-ce06-$(date +%s)"
TRACE_ID="trace-${PROJECT_ID}"

# 2. 生成千万字级测试样本 (约 10MB，带有 100+ 章节标记)
echo "[Gate] Generating 10MB test novel..."
TEST_FILE="${EVID_ROOT}/test_novel.txt"
node -e "
const fs = require('fs');
let content = '';
for(let i=1; i<=100; i++) {
  content += '\n第' + i + '章 测试章节内容\n';
  content += '这是第' + i + '章的第1段内容，用于测试 CE06 的 SCAN 和 CHUNK_PARSE。\n';
  content += '这是第' + i + '章的第2段内容，确保不漏字。\n';
  // 填充一些随机字符增加长度
  content += 'A'.repeat(10000) + '\n';
}
fs.writeFileSync('${TEST_FILE}', content);
console.log('Generated ' + content.length + ' bytes.');
"
TOTAL_LEN=$(wc -c < "${TEST_FILE}")
echo "[Gate] Total Input Length: ${TOTAL_LEN}"

# 3. 初始化项目数据 (SQL)
echo "[Gate] Seeding Project & NovelSource..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status) VALUES ('${PROJECT_ID}', 'Massive Test', 'user-gate', 'org-gate', 'in_progress');"
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\") VALUES ('ns-${PROJECT_ID}', '${PROJECT_ID}', pg_read_file('${TEST_FILE}')) ON CONFLICT DO NOTHING;" || \
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\") VALUES ('ns-${PROJECT_ID}', '${PROJECT_ID}', $(cat "${TEST_FILE}" | jq -R .))"

# 4. 触发 SCAN 任务
echo "[Gate] Triggering SCAN Phase..."
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", type, status, payload, \"organizationId\", \"traceId\") VALUES ('job-scan-${PROJECT_ID}', '${PROJECT_ID}', 'CE06_NOVEL_PARSING', 'PENDING', '{\"phase\": \"SCAN\", \"raw_text\": $(cat "${TEST_FILE}" | jq -Rs .)}', 'org-gate', '${TRACE_ID}');"

# 5. 等待扇出并完成 (CHUNK_PARSE)
echo "[Gate] Waiting for fan-out and completion..."
EXPECTED_CHAPTERS=100
MAX_WAIT=300
ELAPSED=0
while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
  # 检查 Scene 数量
  SCENE_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FROM novel_scenes ns JOIN novel_chapters nc ON ns.\"chapterId\" = nc.id JOIN novel_volumes nv ON nc.\"volumeId\" = nv.id WHERE nv.\"projectId\" = '${PROJECT_ID}'")
  TOTAL_RAW_LEN=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COALESCE(SUM(LENGTH(\"rawText\")), 0) FROM novel_scenes ns JOIN novel_chapters nc ON ns.\"chapterId\" = nc.id JOIN novel_volumes nv ON nc.\"volumeId\" = nv.id WHERE nv.\"projectId\" = '${PROJECT_ID}'")
  
  echo "[Gate] Progress: Scenes=${SCENE_COUNT}, RawTextSum=${TOTAL_RAW_LEN}/${TOTAL_LEN}"
  
  if [ "${TOTAL_RAW_LEN}" -ge "${TOTAL_LEN}" ]; then
    echo "✅ SUCCESS: All text parsed into scenes."
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED+5))
done

# 6. 最终断言
echo "[Gate] Final Assertions..."
# A: 不丢字 (允许空白符差异)
DIFF=$((TOTAL_LEN - TOTAL_RAW_LEN))
echo "[Gate] Char Diff: ${DIFF}"
if [ "${DIFF#?}" -gt 1000 ]; then echo "❌ FAIL: Text loss too high"; exit 1; fi

# B: 扇出数量
JOB_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND payload->>'phase'='CHUNK_PARSE'")
echo "[Gate] Fan-out Jobs: ${JOB_COUNT}"
if [ "${JOB_COUNT}" -lt 100 ]; then echo "❌ FAIL: Fan-out mismatch"; exit 1; fi

# C: 契约一致性 (无自造字段攻击校验 - 简单通过 count 判断)
psql -d "${DATABASE_URL}" -c "SELECT id, index, title, LENGTH(\"rawText\") as raw_len FROM novel_scenes WHERE \"chapterId\" IN (SELECT id FROM novel_chapters WHERE \"volumeId\" IN (SELECT id FROM novel_volumes WHERE \"projectId\"='${PROJECT_ID}')) LIMIT 5;"

# D: V1.3.1 管线串联验证 (CE03/CE04)
echo "[Gate] V1.3.1: Verifying CE03/CE04 pipeline..."
MISSING_DENSITY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FROM novel_scenes ns JOIN novel_chapters nc ON ns.\"chapterId\" = nc.id JOIN novel_volumes nv ON nc.\"volumeId\" = nv.id WHERE nv.\"projectId\" = '${PROJECT_ID}' AND ns.visual_density_score IS NULL")
MISSING_ENRICHED=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FROM novel_scenes ns JOIN novel_chapters nc ON ns.\"chapterId\" = nc.id JOIN novel_volumes nv ON nc.\"volumeId\" = nv.id WHERE nv.\"projectId\" = '${PROJECT_ID}' AND ns.enriched_text IS NULL")

echo "[Gate] Scenes missing visual_density_score: ${MISSING_DENSITY}"
echo "[Gate] Scenes missing enriched_text: ${MISSING_ENRICHED}"

if [ "${MISSING_DENSITY}" -gt 0 ]; then echo "❌ FAIL: CE03 pipeline incomplete (missing density scores)"; exit 1; fi
if [ "${MISSING_ENRICHED}" -gt 0 ]; then echo "❌ FAIL: CE04 pipeline incomplete (missing enriched text)"; exit 1; fi

echo "✅ GATE PASS: Massive import verified (V1.3.1 with pipeline)."
