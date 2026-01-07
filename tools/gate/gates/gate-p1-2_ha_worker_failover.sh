#!/bin/bash
set -euo pipefail

# P1-2: HA Worker Failover Gate
# 目标:kill worker → 60s 内 reclaim > 0 → 新 worker 完成;3 轮;无 lease 泄漏;无重复计费。
# 证据:FINAL_REPORT.md + assets/*.log

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

export API_PORT="${API_PORT:-3001}"
export API_URL="${API_URL:-http://127.0.0.1:${API_PORT}/api}"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_2_ha_worker_failover_${TS}"
ASSETS_DIR="${EVID_DIR}/assets"
mkdir -p "${ASSETS_DIR}"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "${ASSETS_DIR}/gate.log"; }

DB_URL_CLEAN="${DATABASE_URL%%\?*}"

psqlq() {
  local sql="$1"
  echo "$sql" | psql "${DB_URL_CLEAN}" -v ON_ERROR_STOP=1 -X -qAt
}

psqllog() {
  local name="$1"
  local sql="$2"
  {
    echo "---- SQL ----"
    echo "$sql"
    echo "---- OUT ----"
    echo "$sql" | psql "${DB_URL_CLEAN}" -v ON_ERROR_STOP=1 -X
    echo
  } >> "${ASSETS_DIR}/${name}.log" 2>&1
}

fail() { log "❌ $*"; exit 1; }

log "🚀 [P1-2 HA] Starting gate..."
log "API_URL=${API_URL}"
log "EVID_DIR=${EVID_DIR}"

# --- 0) Topology anti-regression ---
if ! grep -q "ENABLE_INTERNAL_JOB_WORKER=false" .env.local; then
  fail "CRITICAL: ENABLE_INTERNAL_JOB_WORKER must be false in .env.local"
fi
log "✅ Topology: internal worker disabled (expected)."

# --- 1) Preflight: API health ---
log "🌡️ Checking API health..."
curl -sS "${API_URL}/health" | tee "${ASSETS_DIR}/api_health.json" >/dev/null || fail "API health check failed"

# --- 2) Seed minimal jobs that will run long enough to allow kill/reclaim ---
log "🌱 Seeding HA test workload..."
export EVID_DIR
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_2_ha_seed.ts \
  | tee "${ASSETS_DIR}/seed.log"

# 从 seed.log 提取关键变量
PROJECT_ID="$(grep -E '^PROJECT_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
KILL_WORKER_PID="$(grep -E '^KILL_WORKER_PID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
KILL_WORKER_ID="$(grep -E '^KILL_WORKER_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
TEST_JOB_ID="$(grep -E '^TEST_JOB_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"

[[ -n "${PROJECT_ID}" ]] || fail "Missing PROJECT_ID from seed script"
[[ -n "${KILL_WORKER_PID}" ]] || fail "Missing KILL_WORKER_PID from seed script"
[[ -n "${KILL_WORKER_ID}" ]] || fail "Missing KILL_WORKER_ID from seed script"
[[ -n "${TEST_JOB_ID}" ]] || fail "Missing TEST_JOB_ID from seed script"

log "✅ Seed OK: PROJECT_ID=${PROJECT_ID} TEST_JOB_ID=${TEST_JOB_ID} KILL_WORKER_ID=${KILL_WORKER_ID} PID=${KILL_WORKER_PID}"

# --- 3) 3 rounds kill → reclaim → complete ---
ROUNDS=3
RECLAIM_TIMEOUT_SEC=60

for r in $(seq 1 ${ROUNDS}); do
  log "🧨 Round ${r}/${ROUNDS}: killing worker PID=${KILL_WORKER_PID} (workerId=${KILL_WORKER_ID})"
  (set +e; kill -9 "${KILL_WORKER_PID}" >> "${ASSETS_DIR}/worker_kill.log" 2>&1; true)
  echo "ROUND=${r} killed PID=${KILL_WORKER_PID}" >> "${ASSETS_DIR}/worker_kill.log"

  log "⏳ Waiting reclaim to happen (<=${RECLAIM_TIMEOUT_SEC}s)..."
  reclaimed="0"
  for i in $(seq 1 ${RECLAIM_TIMEOUT_SEC}); do
    set +e
    resp="$(curl -sS -X POST "${API_URL}/admin/workers/reclaim" -H 'Content-Type: application/json' 2>>"${ASSETS_DIR}/api.log")"
    set -e
    echo "${resp}" >> "${ASSETS_DIR}/api.log"
    reclaimed_now="$(echo "${resp}" | sed -n 's/.*"reclaimed":[ ]*\([0-9]\+\).*/\1/p' | head -1 || true)"
    reclaimed_now="${reclaimed_now:-0}"
    if [[ "${reclaimed_now}" -gt 0 ]]; then
      reclaimed="${reclaimed_now}"
      break
    fi
    sleep 1
  done

  [[ "${reclaimed}" -gt 0 ]] || fail "Reclaim did not happen within ${RECLAIM_TIMEOUT_SEC}s"

  log "✅ Reclaimed jobs: ${reclaimed}"

  # 断言:不存在 leaseUntil<=now 的 RUNNING job
  psqllog "sql_lease_leak_round_${r}" "
SELECT count(*) AS leak_running_expired
FROM shot_jobs
WHERE status='RUNNING' AND \"leaseUntil\" IS NOT NULL AND \"leaseUntil\" <= now();
"
  leak="$(psqlq "SELECT count(*) FROM shot_jobs WHERE status='RUNNING' AND \"leaseUntil\" IS NOT NULL AND \"leaseUntil\" <= now();")"
  [[ "${leak}" == "0" ]] || fail "Lease leak detected: RUNNING with expired lease = ${leak}"

  # 等待测试 job 最终成功
  log "🏁 Waiting job to complete..."
  ok="0"
  for t in $(seq 1 90); do
    st="$(psqlq "SELECT status FROM shot_jobs WHERE id='${TEST_JOB_ID}' LIMIT 1;")"
    echo "t=${t} status=${st}" >> "${ASSETS_DIR}/job_poll_round_${r}.log"
    if [[ "${st}" == "SUCCEEDED" ]]; then ok="1"; break; fi
    sleep 1
  done
  [[ "${ok}" == "1" ]] || fail "Job did not reach SUCCEEDED in time (jobId=${TEST_JOB_ID})"

  log "✅ Job SUCCEEDED: ${TEST_JOB_ID}"
done

# --- 4) Billing duplicate assertion (project scope) ---
psqllog "sql_duplicate_cost_assert" "
SELECT \"jobId\",\"jobType\",count(*) AS charge_count
FROM cost_ledgers
WHERE \"projectId\"='${PROJECT_ID}'
GROUP BY \"jobId\",\"jobType\"
HAVING count(*) > 1;
"
dup_cnt="$(psqlq "
SELECT count(*) FROM (
  SELECT \"jobId\",\"jobType\"
  FROM cost_ledgers WHERE \"projectId\"='${PROJECT_ID}'
  GROUP BY \"jobId\",\"jobType\"
  HAVING count(*) > 1
) t;
")"
[[ "${dup_cnt}" == "0" ]] || fail "Duplicate charges detected (count=${dup_cnt})"

log "✅ Billing: no duplicate charges (project=${PROJECT_ID})."

# --- 5) FINAL_REPORT ---
cat > "${EVID_DIR}/FINAL_REPORT.md" <<EOF
# P1-2 HA Worker Failover Gate - FINAL REPORT

- Timestamp: ${TS}
- API_URL: ${API_URL}
- PROJECT_ID: ${PROJECT_ID}
- TEST_JOB_ID: ${TEST_JOB_ID}
- Rounds: ${ROUNDS}
- Result: PASS

## Key Assertions
- Kill worker -> reclaim happens within ${RECLAIM_TIMEOUT_SEC}s (3 rounds)
- No lease leak: RUNNING with leaseUntil <= now is 0
- Job completes (SUCCEEDED)
- No duplicate billing entries (jobId+jobType unique)

## Evidence Files
- assets/gate.log
- assets/api_health.json
- assets/seed.log
- assets/worker_kill.log
- assets/api.log
- assets/sql_lease_leak_round_*.log
- assets/job_poll_round_*.log
- assets/sql_duplicate_cost_assert.log
EOF

log "✅ Gate Passed. Evidence: ${EVID_DIR}"
