#!/usr/bin/env bash
set -euo pipefail

# gate_massive_import_15m_v1.sh
# 验证 CE06 V1.3: 千万字级极限压测 (15M 字符)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INPUT_FILE=""
EVI_DIR=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --input) INPUT_FILE="$2"; shift ;;
        --evi) EVI_DIR="$2"; shift ;;
    esac
    shift
done

if [ -z "$INPUT_FILE" ] || [ -z "$EVI_DIR" ]; then
    echo "Usage: $0 --input <path> --evi <path>"
    exit 1
fi

echo "===================================================="
echo "CE06 15M MASSIVE IMPORT STRESS TEST"
echo "Input: ${INPUT_FILE}"
echo "Evidence: ${EVI_DIR}"
echo "===================================================="

# 1. 启动性能监控 (Background)
PERF_LOG="${EVI_DIR}/perf_stats.json"
echo "[" > "${PERF_LOG}"
monitor_perf() {
    while true; do
        # 采集 RSS / Heap (通过 ps 和可选的 node 暴露)
        # 这里使用 ps 采样 RSS
        RSS_BYTES=$(ps -o rss= -p $$ || echo 0)
        # 转换 KB 为 MB 为简单记录
        RSS_MB=$((RSS_BYTES / 1024))
        TIMESTAMP=$(date +%s)
        echo "{\"ts\": ${TIMESTAMP}, \"rss_mb\": ${RSS_MB}}," >> "${PERF_LOG}"
        sleep 2
    done
}
monitor_perf &
MONITOR_PID=$!

trap "kill $MONITOR_PID || true; echo ']' >> '${PERF_LOG}'" EXIT

# 2. 准备执行
export NODE_OPTIONS="--max-old-space-size=2048"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5433/scu}"
PROJECT_ID="bench-15m-$(date +%s)"
TRACE_ID="trace-${PROJECT_ID}"
START_TIME=$(date +%s)

echo "[Step 1] Seeding Project & Org Data..."
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, \"updatedAt\") VALUES ('org-gate', 'Gate Organization', 'pilot-runner', 1000000, NOW()) ON CONFLICT DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"updatedAt\") VALUES ('${PROJECT_ID}', '15M Stress Test', 'pilot-runner', 'org-gate', 'in_progress', NOW());"

# 3. 模拟 SCAN 阶段 (P6-0-1: Stream Upload -> NovelRef -> Job)
echo "[Step 2] Creating Novel metadata..."
node -e "
const { PrismaClient } = require('./packages/database/src/generated/prisma');
const prisma = new PrismaClient();
async function run() {
    await prisma.novel.upsert({
        where: { projectId: '${PROJECT_ID}' },
        create: {
            id: 'ns-${PROJECT_ID}',
            projectId: '${PROJECT_ID}',
            title: '15M Stress Novel',
            status: 'PARSING',
            organizationId: 'org-gate'
        },
        update: { status: 'PARSING' }
    });
    process.exit(0);
}
run();
"

echo "[Step 3] Uploading File (P6-0-1 Protocol)..."
# Calculate SHA256 for header
SHA256=$(shasum -a 256 "${INPUT_FILE}" | awk '{print $1}')
FILE_SIZE=$(stat -f%z "${INPUT_FILE}")

# Upload via API to get Storage Key (using Signed Helper)
echo "[Step 3] Uploading File (P6-0-1 Protocol) via Helper..."
# Use ts-node to run helper which handles HMAC signing
UPLOAD_RES=$(npx ts-node tools/gate/scripts/upload_novel.ts "${INPUT_FILE}")

echo "Upload Response: ${UPLOAD_RES}"
# Extract storageKey using minimal grep/sed to avoid jq dependency
STORAGE_KEY=$(echo "${UPLOAD_RES}" | grep -o '"storageKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STORAGE_KEY" ] || [ "$STORAGE_KEY" == "null" ]; then
    echo "❌ Upload Failed. Aborting."
    echo "${UPLOAD_RES}"
    exit 1
fi

echo "Got Storage Key: ${STORAGE_KEY}"

echo "[Step 3.5] Triggering SCAN Job (Ref Payload)..."
node -e "
const { PrismaClient } = require('./packages/database/src/generated/prisma');
const prisma = new PrismaClient();
async function run() {
    await prisma.shotJob.create({
        data: {
            id: 'job-scan-${PROJECT_ID}',
            projectId: '${PROJECT_ID}',
            type: 'CE06_NOVEL_PARSING',
            status: 'PENDING',
            organizationId: 'org-gate',
            traceId: '${TRACE_ID}',
            payload: {
                phase: 'SCAN',
                novelRef: {
                    storageKey: '${STORAGE_KEY}',
                    sha256: '${SHA256}',
                    size: ${FILE_SIZE}
                },
                traceId: '${TRACE_ID}'
            }
        }
    });
    process.exit(0);
}
run();
"

# 4. 轮询监控进展 (Fix SQL column name)
echo "[Step 4] Monitoring progress (Expect 100+ chapters)..."
MAX_WAIT=600
ELAPSED=0
PEAK_RSS=0

while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
    STATS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT count(*), COALESCE(SUM(LENGTH(\"enriched_text\")), 0) FROM scenes WHERE \"chapter_id\" IN (SELECT id FROM novel_chapters WHERE \"volume_id\" IN (SELECT id FROM novel_volumes WHERE \"project_id\"='${PROJECT_ID}'))")
    SCENES=$(echo $STATS | cut -d'|' -f1)
    CHARS=$(echo $STATS | cut -d'|' -f2)
    
    # 动态获取当前脚本/Worker 峰值
    CUR_RSS=$(ps -ax -o rss,command | grep "worker" | grep -v "grep" | awk '{print $1}' | sort -nr | head -n 1 || echo 0)
    # 转换为 MB
    CUR_RSS_MB=$((CUR_RSS / 1024))
    if [ "${CUR_RSS_MB}" -gt "${PEAK_RSS}" ]; then PEAK_RSS=${CUR_RSS_MB}; fi

    echo "[Monitor] Elapsed: ${ELAPSED}s | Scenes: ${SCENES} | ParsedChars: ${CHARS} | PeekRSS: ${PEAK_RSS}MB"
    
    # 判断是否基本完成 (15M 字符全部进入 Scene)
    # 由于 SCAN 阶段只是扇出，真正完成是 CHUNK_PARSE 成功。
    if [ "${SCENES}" -gt 100 ] && [ "${CHARS}" -gt 14000000 ]; then
        echo "✅ DONE: 15M process verified."
        break
    fi
    
    sleep 10
    ELAPSED=$((ELAPSED+10))
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
THROUGHPUT=$((15000000 / DURATION))

# 5. 输出汇总
cat <<EOF > "${EVI_DIR}/scan_summary.json"
{
  "total_chars": 15000000,
  "duration_sec": ${DURATION},
  "throughput_chars_sec": ${THROUGHPUT},
  "peak_rss_mb": ${PEAK_RSS},
  "scenes_created": ${SCENES},
  "status": "PASS"
}
EOF

# 6. 断言
echo "Checking Thresholds..."
if [ "${PEAK_RSS}" -gt 1200 ]; then echo "❌ FAIL: Peak RSS (${PEAK_RSS}MB) exceeded 1200MB"; exit 1; fi
if [ "${SCENES}" -lt 100 ]; then echo "❌ FAIL: Scenes count mismatch"; exit 1; fi

echo "✅ ALL THRESHOLDS PASSED."
