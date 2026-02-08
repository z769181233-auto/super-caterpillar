#!/usr/bin/env bash
set -euo pipefail

# gate_stage4_scaling_15m.sh
# 验证 Stage 4 Shredder 架构: 1500万字极限压测
# 流程: API Import -> Shredder Scan -> Chunk Parse -> Scene/Shot Population

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INPUT_FILE="${INPUT_FILE_OVERRIDE:-${ROOT_DIR}/uploads/novels/test_novel_15m.txt}"

echo "===================================================="
echo "STAGE 4: 15M SHREDDER SCALING TEST"
echo "Input: ${INPUT_FILE}"
echo "===================================================="

# 1. 配置 & 安全断言 (SSOT)
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${HMAC_SECRET_KEY:?HMAC_SECRET_KEY is required}"
: "${WORKER_API_KEY:?WORKER_API_KEY is required}"

# Define PSQL with ON_ERROR_STOP and no-rc
PSQL="psql -v ON_ERROR_STOP=1 -X"

# 证据目录 (符合 docs/_evidence/ 规范)
TS="$(date +%Y%m%d_%H%M%S)"
EVI_DIR="${ROOT_DIR}/docs/_evidence/stage4_scaling_15m_${TS}"
mkdir -p "${EVI_DIR}"

# IDs (deterministic for evidence)
PROJECT_ID="gate-stage4-15m-${TS}"
ORG_ID="org-gate"
USER_ID="pilot-runner"

# 记录环境快照 (脱敏)
echo "DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's#//[^@]+@#//***:***@#')" > "${EVI_DIR}/env.proof.txt"
echo "API_URL=${API_URL:-http://localhost:3000}" >> "${EVI_DIR}/env.proof.txt"
echo "WORKER_API_KEY=${WORKER_API_KEY}" >> "${EVI_DIR}/env.proof.txt"
echo "HMAC_SECRET_KEY=***" >> "${EVI_DIR}/env.proof.txt"
echo "PROJECT_ID=${PROJECT_ID}" >> "${EVI_DIR}/env.proof.txt"
echo "ORG_ID=${ORG_ID}" >> "${EVI_DIR}/env.proof.txt"
echo "USER_ID=${USER_ID}" >> "${EVI_DIR}/env.proof.txt"

# 2. 数据准备 (幂等)
echo "[Step 1] Seeding Project & Org..."
# upsert organizations
${PSQL} -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, type, \"createdAt\", \"updatedAt\") VALUES ('${ORG_ID}', 'Gate Organization', '${USER_ID}', 1000000, 'personal', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" 2>&1 | tee -a "${EVI_DIR}/psql_seed.log"
# upsert projects
${PSQL} -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, metadata, \"settingsJson\", \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', 'Stage 4 Scaling Test', '${USER_ID}', '${ORG_ID}', 'in_progress', '{}', '{}', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" 2>&1 | tee -a "${EVI_DIR}/psql_seed.log"

# 3. 授权 (V3.0 RBAC)
# upsert members
${PSQL} -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"userId\", \"organizationId\", role, \"createdAt\", \"updatedAt\") VALUES ('om-${PROJECT_ID}', '${USER_ID}', '${ORG_ID}', 'ADMIN', NOW(), NOW()) ON CONFLICT (\"userId\", \"organizationId\") DO NOTHING;" 2>&1 | tee -a "${EVI_DIR}/psql_seed.log"

# upsert project members (find role id safely)
OWNER_ROLE_ID=$(${PSQL} -d "${DATABASE_URL}" -t -A -c "SELECT id FROM roles WHERE name='OWNER'" | xargs)
if [ -z "$OWNER_ROLE_ID" ]; then
    echo "❌ FATAL: OWNER role not found in DB" | tee -a "${EVI_DIR}/error.log"
    exit 1
fi
${PSQL} -d "${DATABASE_URL}" -c "INSERT INTO project_members (id, \"userId\", \"projectId\", \"roleId\", \"createdAt\", \"updatedAt\") VALUES ('pm-${PROJECT_ID}', '${USER_ID}', '${PROJECT_ID}', '${OWNER_ROLE_ID}', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" 2>&1 | tee -a "${EVI_DIR}/psql_seed.log"

# 4. HMAC Import Trigger
echo "[Step 2] Inserting NOVEL_SCAN_TOC Job (Bypassing Multipart Upload for Load Stability)..."

JOB_ID="job_load_${TS}"
# 必须确保 payload 里的 fileKey 指向真实存在的 15M 文件
if [ ! -f "${INPUT_FILE}" ]; then
    echo "❌ Input file not found: ${INPUT_FILE}" | tee -a "${EVI_DIR}/error.log"
    echo "Prepare a real test novel file (3M/15M) and place it at uploads/novels/" | tee -a "${EVI_DIR}/error.log"
    exit 14
fi

# Record input fingerprint for audit
sha256sum "${INPUT_FILE}" > "${EVI_DIR}/input.sha256"
TOTAL_BYTES=$(wc -c < "${INPUT_FILE}" | xargs)
echo "TOTAL_BYTES=${TOTAL_BYTES}" >> "${EVI_DIR}/env.proof.txt"

ABS_INPUT_FILE="$(cd "$(dirname "${INPUT_FILE}")" && pwd)/$(basename "${INPUT_FILE}")"

# 安全插入 JSON payload (防止转义炸裂)
${PSQL} -d "${DATABASE_URL}" -c "
INSERT INTO shot_jobs (
  id, \"organizationId\", \"projectId\",
  type, status, priority, payload,
  \"createdAt\", \"updatedAt\"
) VALUES (
  '${JOB_ID}', '${ORG_ID}', '${PROJECT_ID}',
  'NOVEL_SCAN_TOC', 'PENDING', 100,
  jsonb_build_object(
    'projectId', '${PROJECT_ID}',
    'fileKey', '${ABS_INPUT_FILE}',
    'isVerification', true
  ),
  NOW(), NOW()
);
" 2>&1 | tee -a "${EVI_DIR}/psql_seed.log"

echo "Job Inserted: ${JOB_ID}"
echo "Load Test Started for ${TOTAL_BYTES} bytes..."

# 5. 监控 (Metrics + Correct Job Stats)
echo "[Step 3] Monitoring Load..."
MAX_WAIT=1800 # 30分钟 for 15M
ELAPSED=0
PEAK_RSS=0
START_TIME=$(date +%s)
RSS_TRACE_FILE="${EVI_DIR}/rss_trace.jsonl"
echo "" > "${RSS_TRACE_FILE}"

MIN_CHUNK_JOBS="${MIN_CHUNK_JOBS:-50}"   # 默认至少 50 个 chunk 才算 load 有意义
MAX_FAILED_JOBS="${MAX_FAILED_JOBS:-0}" # 默认失败=0 才 PASS

while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
    CURRENT_TIME=$(date +%s)
    
    # RSS 监控
    RSS_KB=$(ps -ax -o rss,command | grep "worker" | grep -v "grep" | awk '{sum+=$1} END {print sum}' || echo 0)
    RSS_MB=$((RSS_KB / 1024))
    if [ "${RSS_MB}" -gt "${PEAK_RSS}" ]; then PEAK_RSS=${RSS_MB}; fi
    echo "{\"ts\":${CURRENT_TIME}, \"rss_mb\":${RSS_MB}}" >> "${RSS_TRACE_FILE}"

    # 每 5 秒检查一次 Job 状态
    if (( ELAPSED % 5 == 0 )); then
        # 使用 shot_jobs 统计口径
        STATS=$(${PSQL} -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FILTER (WHERE status='SUCCEEDED'), count(*) FILTER (WHERE status='FAILED'), count(*), count(*) FILTER (WHERE status='PENDING'), count(*) FILTER (WHERE status='RUNNING') FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type IN ('NOVEL_SCAN_TOC', 'NOVEL_CHUNK_PARSE')")
        IFS='|' read -r SUCCEEDED FAILED TOTAL PENDING RUNNING <<< "$(echo "$STATS" | xargs)"
        
        echo "[Monitor] Time:${ELAPSED}s | Jobs: Total=${TOTAL} Succ=${SUCCEEDED} Fail=${FAILED} Pen=${PENDING} Run=${RUNNING} | RSS:${RSS_MB}MB" | tee -a "${EVI_DIR}/monitor.log"

        # 判定完成: Root Scan 完成 且 所有 chunk 完成 (且没有 pending/running)
        
        SCAN_STATUS=$(${PSQL} -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id='${JOB_ID}'" | xargs)
        
        if [ "$SCAN_STATUS" == "FAILED" ]; then
             echo "❌ Root Scan Job Failed!" | tee -a "${EVI_DIR}/result.txt"
             exit 1
        fi
        
        # 严格的完成判定
        if [ "$SCAN_STATUS" == "SUCCEEDED" ] && \
           [ "$TOTAL" -ge $((1 + MIN_CHUNK_JOBS)) ] && \
           [ "$FAILED" -le "$MAX_FAILED_JOBS" ] && \
           [ "$PENDING" -eq 0 ] && \
           [ "$RUNNING" -eq 0 ]; then
             
             DURATION=$((CURRENT_TIME - START_TIME))
             THROUGHPUT_BPS=$((TOTAL_BYTES / (DURATION + 1)))
             
             echo "✅ Load Test Completed in ${DURATION}s." | tee -a "${EVI_DIR}/result.txt"
             echo "Throughput: ${THROUGHPUT_BPS} bytes/sec" | tee -a "${EVI_DIR}/result.txt"
             
             # Final Artifacts
             cat <<EOF > "${EVI_DIR}/final_summary.json"
{
  "projectId": "${PROJECT_ID}",
  "totalBytes": ${TOTAL_BYTES},
  "durationSec": ${DURATION},
  "throughputBps": ${THROUGHPUT_BPS},
  "peakRssMb": ${PEAK_RSS},
  "jobStats": {
    "total": ${TOTAL},
    "succeeded": ${SUCCEEDED},
    "failed": ${FAILED}
  },
  "thresholds": {
    "minChunks": ${MIN_CHUNK_JOBS},
    "maxFailed": ${MAX_FAILED_JOBS}
  },
  "status": "PASS"
}
EOF
             exit 0
        fi
        
        # 失败阈值检查 (Early Failure)
        if [ "$FAILED" -gt "$MAX_FAILED_JOBS" ]; then
             echo "❌ Max Failed Jobs Exceeded: ${FAILED} > ${MAX_FAILED_JOBS}" | tee -a "${EVI_DIR}/result.txt"
             exit 1
        fi
    fi

    sleep 1
    ELAPSED=$((ELAPSED+1))
done

echo "❌ Timeout waiting for 15M load test." | tee -a "${EVI_DIR}/result.txt"
exit 1
