#!/usr/bin/env bash
set -euo pipefail

# gate_stage4_scaling_15m.sh
# 验证 Stage 4 Shredder 架构: 1500万字极限压测
# 流程: API Import -> Shredder Scan -> Chunk Parse -> Scene/Shot Population
# Version: V3.1 (Hardened Go-Live)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INPUT_FILE="${INPUT_FILE_OVERRIDE:-${ROOT_DIR}/uploads/novels/test_novel_15m.txt}"

echo "===================================================="
echo "STAGE 4: 15M SHREDDER SCALING TEST (V3.1)"
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

# --- [V3.1] Mandatory Post-metrics Capture (Trap) ---
BEST_EFFORT_METRICS_POST() {
  echo "[AUDIT] Attempting post-run metrics capture..."
  curl -fsS http://localhost:3000/metrics > "${EVI_DIR}/metrics_post.txt" 2>/dev/null || true
  if [ -f "${EVI_DIR}/metrics_post.txt" ]; then
    cp "${EVI_DIR}/metrics_post.txt" "${EVI_DIR}/metrics_snapshot.txt"
  fi
}
trap BEST_EFFORT_METRICS_POST EXIT

# --- [ASSERT] Define Readiness Checker ---
require_url() {
    local url="$1"
    local name="$2"
    echo "Checking $name readiness..."
    for i in $(seq 1 30); do
        if curl -fsS "$url" >/dev/null; then
            echo "[READY] $name is up."
            return 0
        fi
        sleep 1
    done
    echo "[FATAL] $name not ready after 30s."
    exit 14
}

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

# --- [Step 0] Readiness Check (V3.1: API + Worker Metrics) ---
require_url "http://localhost:3000/metrics" "API_METRICS"
# P6-V3.1: Best-effort worker readiness check
WORKER_METRICS_URL="${WORKER_METRICS_URL:-http://localhost:3001/metrics}"
if curl -fsS "$WORKER_METRICS_URL" >/dev/null 2>&1; then
  echo "[READY] WORKER_METRICS is up."
else
  echo "[WARN] WORKER_METRICS not reachable: $WORKER_METRICS_URL (Audit may need this for per-worker stats)."
fi

# Capture baseline BEFORE test
curl -fsS http://localhost:3000/metrics > "${EVI_DIR}/metrics_pre.txt"

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
PEAK_SWARM_RSS=0
START_TIME=$(date +%s)
RSS_TRACE_FILE="${EVI_DIR}/rss_trace.jsonl"
echo "" > "${RSS_TRACE_FILE}"

MIN_CHUNK_JOBS="${MIN_CHUNK_JOBS:-50}"   # 默认至少 50 个 chunk 才算 load 有意义
MAX_FAILED_JOBS="${MAX_FAILED_JOBS:-0}" # 默认失败=0 才 PASS

while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
    CURRENT_TIME=$(date +%s)
    
    # [V3.4] Swarm RSS 监控 (Grep worker + wrappers)
    RSS_KB=$(ps -ax -o rss,command | grep "worker" | grep -v "grep" | awk '{sum+=$1} END {print sum}' || echo 0)
    RSS_MB=$((RSS_KB / 1024))
    if [ "${RSS_MB}" -gt "${PEAK_SWARM_RSS}" ]; then PEAK_SWARM_RSS=${RSS_MB}; fi
    # 存入 trace (明确 swarm 口径)
    echo "{\"ts\":${CURRENT_TIME}, \"swarm_rss_mb\":${RSS_MB}}" >> "${RSS_TRACE_FILE}"

    # 每 5 秒检查一次 Job 状态
    if (( ELAPSED % 5 == 0 )); then
        # 使用 shot_jobs 统计口径
        STATS=$(${PSQL} -d "${DATABASE_URL}" -t -A -c "SELECT count(*) FILTER (WHERE status='SUCCEEDED'), count(*) FILTER (WHERE status='FAILED'), count(*), count(*) FILTER (WHERE status='PENDING'), count(*) FILTER (WHERE status='RUNNING') FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type IN ('NOVEL_SCAN_TOC', 'NOVEL_CHUNK_PARSE')")
        IFS='|' read -r SUCCEEDED FAILED TOTAL PENDING RUNNING <<< "$(echo "$STATS" | xargs)"
        
        echo "[Monitor] Time:${ELAPSED}s | Jobs: Total=${TOTAL} Succ=${SUCCEEDED} Fail=${FAILED} Pen=${PENDING} Run=${RUNNING} | SwarmRSS:${RSS_MB}MB" | tee -a "${EVI_DIR}/monitor.log"

        # [V3.1] No-progress short-circuit (Avoid 30m hang)
        if [ "$ELAPSED" -ge 120 ] && [ "$SUCCEEDED" -eq 0 ] && [ "$RUNNING" -eq 0 ]; then
          echo "❌ [FATAL] No job progress after 120s. Suspect worker offline or not consuming." | tee -a "${EVI_DIR}/error.log"
          exit 17
        fi

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

             # --- [V3.3] Audit: Multi-signal Metrics Delta Assertion ---
             BEST_EFFORT_METRICS_POST # Explicit call for faster result before trap
             
             # Assert Content
             grep -q "scu_stage4_jobs_total" "${EVI_DIR}/metrics_snapshot.txt" || { echo "[FATAL] missing scu_stage4_jobs_total"; exit 15; }
             grep -q "scu_stage4_peak_rss_mb" "${EVI_DIR}/metrics_snapshot.txt" || { echo "[FATAL] missing scu_stage4_peak_rss_mb"; exit 15; }

             # Assert Growth across multiple signals
             pre_any="$(grep -E 'scu_stage4_jobs_total\{.*\}' "${EVI_DIR}/metrics_pre.txt" 2>/dev/null | awk '{s+=$2} END{print s+0}')"
             post_any="$(grep -E 'scu_stage4_jobs_total\{.*\}' "${EVI_DIR}/metrics_post.txt" 2>/dev/null | awk '{s+=$2} END{print s+0}')"
             pre_hist="$(grep -E 'scu_stage4_duration_seconds_count' "${EVI_DIR}/metrics_pre.txt" 2>/dev/null | awk '{print $2}' | head -n1 || echo 0)"
             post_hist="$(grep -E 'scu_stage4_duration_seconds_count' "${EVI_DIR}/metrics_post.txt" 2>/dev/null | awk '{print $2}' | head -n1 || echo 0)"
             
             echo "Audit: pre_any=$pre_any post_any=$post_any pre_hist=$pre_hist post_hist=$post_hist" | tee -a "${EVI_DIR}/monitor.log"
             
             if [ "$post_any" -le "$pre_any" ] && [ "$post_hist" -le "$pre_hist" ]; then
               echo "❌ [FATAL] Metrics did not change: jobs_total and duration histogram both static." | tee -a "${EVI_DIR}/error.log"
               exit 16
             fi

             # --- [V3.4] Final Artifacts & Summary Alignment ---
             echo "${EVI_DIR}" > "${ROOT_DIR}/docs/_evidence/current_stage4_evidence_path.txt"
             
             cat <<EOF > "${EVI_DIR}/final_summary.json"
{
  "projectId": "${PROJECT_ID}",
  "totalBytes": ${TOTAL_BYTES},
  "durationSec": ${DURATION},
  "throughputBps": ${THROUGHPUT_BPS},
  "peakSwarmRssMb": ${PEAK_SWARM_RSS},
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
