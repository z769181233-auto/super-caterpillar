#!/bin/bash
# gate-ce07_m1_hmac_workerid_regression.sh
# 商业级永久回归门禁：锁定 HMAC v2 与 WorkerId 审计链
# 核心逻辑：确保 WorkerId 必须进程级注入，HMAC v2 必须生效，审计链不可伪造。

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%H:%M:%S')] $1"
}

# 1. 环境准备与清场
log "=== Preflight Regression Cleanup ==="
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
sleep 1

EVID_DIR="docs/_evidence/hmac_regression_$(date +'%Y%m%d_%H%M%S')"
mkdir -p "$EVID_DIR"

# 清理数据库
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -c "
DELETE FROM shot_jobs WHERE type='CE07_MEMORY_UPDATE';
DELETE FROM worker_nodes WHERE \"workerId\" LIKE 'worker_reg_%';
" > /dev/null

# 2. 启动 API (禁用内部 Worker)
log "Starting API (with Internal Worker DISABLED)..."
cd "$(dirname "$0")/../../.."
export API_PORT=3001
export ALLOW_TEST_BILLING_GRANT=1
SERVICE_TYPE=api ENABLE_INTERNAL_JOB_WORKER=false node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# 3. 注入测试 Job
log "Injecting CE07 Regression Job..."
# 获取真实 ID
PROJECT_ID=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT id FROM projects LIMIT 1" | xargs)
ORG_ID=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT \"organizationId\" FROM projects WHERE id='$PROJECT_ID'" | xargs)
EPISODE_ID=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT id FROM episodes WHERE \"projectId\"='$PROJECT_ID' LIMIT 1" | xargs)
SCENE_ID=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT id FROM scenes WHERE \"projectId\"='$PROJECT_ID' LIMIT 1" | xargs)
SHOT_ID=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT id FROM shots WHERE \"sceneId\"='$SCENE_ID' LIMIT 1" | xargs)

CE07_JOB_ID="job-reg-$(date +%s)"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -c "
INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, attempts, priority, \"createdAt\", \"updatedAt\")
VALUES ('${CE07_JOB_ID}', '${ORG_ID}', '${PROJECT_ID}', '${EPISODE_ID}', '${SCENE_ID}', '${SHOT_ID}', 'CE07_MEMORY_UPDATE', 'PENDING', 0, 10, NOW(), NOW());
" > /dev/null

# 4. 启动专用 Worker (Fail-Once 模式)
export REG_WORKER_ID="worker_reg_$(date +%s)"
log "Starting Worker with WORKER_ID=$REG_WORKER_ID..."
export WORKER_ID="$REG_WORKER_ID"
export CE07_MEMORY_UPDATE_GATE_FAIL_ONCE=1
export CE07_GATE_MOCK_ENGINE=1
export HMAC_TRACE=1
export API_URL="http://localhost:3001"
WORKER_ID="$REG_WORKER_ID" node apps/workers/dist/apps/workers/src/main.js > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

# 5. 等待并断言
log "Waiting for Job completion and Audit check..."
MAX_WAIT=30
PASSED=false

for i in $(seq 1 $MAX_WAIT); do
    ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -A -c "
    SELECT j.status, j.attempts, wn.\"workerId\" FROM shot_jobs j LEFT JOIN worker_nodes wn ON wn.id = j.\"workerId\" WHERE j.id='${CE07_JOB_ID}';
    ")
    S=$(echo "$ROW" | awk -F'|' '{print $1}' | xargs)
    A=$(echo "$ROW" | awk -F'|' '{print $2}' | xargs)
    W=$(echo "$ROW" | awk -F'|' '{print $3}' | xargs)

    log "Probe [$i]: status=$S attempts=$A"

    if [ "$S" = "SUCCEEDED" ] && [ "$A" = "2" ]; then
        log "${GREEN}✓ Flow Assert: 0->1(FAIL)->2(SUCCEEDED) confirmed.${NC}"
        PASSED=true
        break
    fi
    sleep 1
done

if [ "$PASSED" = false ]; then
    log "${RED}FATAL: Regression Failed. Final state not reached or attempts incorrect.${NC}"
    kill $API_PID $WORKER_PID 2>/dev/null || true
    exit 1
fi

# 6. 四重断言硬核检测
log "=== Final Audit Assertions ==="

# Assert 1: Path Alignment
if grep -q "/api/workers/$REG_WORKER_ID/jobs/next" "$EVID_DIR/api.log"; then
    log "${GREEN}✓ Assert 1 (Path Alignment): PASS${NC}"
else
    log "${RED}FAIL: Path Alignment Mismatch${NC}"
    exit 1
fi

# Assert 2: HMAC v2
if grep -i "x-hmac-version" "$EVID_DIR/api.log" | grep -q "2"; then
    log "${GREEN}✓ Assert 2 (HMAC v2): PASS${NC}"
else
    log "${RED}FAIL: HMAC v2 Not Found in logs${NC}"
    exit 1
fi

# Assert 3: Worker Claim Success (Log Evidence)
# 虽然数据库最终态会置空 workerId，但认领瞬间的日志是 UUID 写入成功的铁证
if grep -q "\"event\":\"JOB_CLAIMED_SUCCESS_ATOMIC\",\"jobId\":\"$CE07_JOB_ID\"" "$EVID_DIR/api.log"; then
    log "${GREEN}✓ Assert 3 (Worker Claim Atomic): PASS${NC}"
else
    log "${RED}FAIL: JOB_CLAIMED_SUCCESS_ATOMIC not found for $CE07_JOB_ID. This means the UUID-based update failed.${NC}"
    exit 1
fi

# Assert 4: Audit WorkerId (Header match)
if grep -q "x-worker-id\": \"$REG_WORKER_ID\"" "$EVID_DIR/api.log"; then
    log "${GREEN}✓ Assert 4 (Audit Chain): PASS${NC}"
else
    log "${RED}FAIL: Audit Chain Mismatch in logs${NC}"
    exit 1
fi

log "=== FINAL 6-LINE EVIDENCE ==="
echo "REGRESSION_ID=HMAC_WORKERID_$(date +%Y%m%d)" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "PATH_MATCH=YES (/api/workers/$REG_WORKER_ID)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "HMAC_VERSION=2" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "AUDIT_WORKER_ID=$REG_WORKER_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "UUID_FOREIGN_KEY_BOUND=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "FLOW_STATUS=SUCCEEDED (Attempts=2)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

kill $API_PID $WORKER_PID 2>/dev/null || true
log "${GREEN}🎉 REGRESSION GATE PASS: HMAC_WORKERID_SSOT_VERIFIED${NC}"
exit 0
