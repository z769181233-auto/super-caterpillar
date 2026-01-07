#!/bin/bash
set -euo pipefail

# P1-2: Billing Reconcile Gate
# 目标:
# - 同一 job 重试多次 -> cost_ledgers 只记 1 条(jobId+jobType 唯一)
# - Quota 超限 -> job 被 BLOCKED(或明确可审计状态/字段),并写 AuditLog
# - Statement checksum 可复现(两次生成 checksum 一致)
# 证据:FINAL_REPORT.md + assets/*.log

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

export API_PORT="${API_PORT:-3001}"
export API_URL="${API_URL:-http://127.0.0.1:${API_PORT}/api}"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_2_billing_reconcile_${TS}"
ASSETS_DIR="${EVID_DIR}/assets"
mkdir -p "${ASSETS_DIR}"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "${ASSETS_DIR}/gate.log"; }
fail() { log "❌ $*"; exit 1; }

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

log "🚀 [P1-2 Billing] Starting gate..."
log "API_URL=${API_URL}"

# --- 0) Preflight: API health ---
curl -sS "${API_URL}/health" | tee "${ASSETS_DIR}/api_health.json" >/dev/null || fail "API health check failed"

# --- 1) Seed billing test project + forced retry job ---
log "🌱 Seeding billing test workload..."
export EVID_DIR
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_2_billing_seed.ts \
  | tee "${ASSETS_DIR}/seed.log"

PROJECT_ID="$(grep -E '^PROJECT_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
ORG_ID="$(grep -E '^ORG_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
TEST_JOB_ID="$(grep -E '^TEST_JOB_ID=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
PERIOD_START="$(grep -E '^PERIOD_START=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"
PERIOD_END="$(grep -E '^PERIOD_END=' "${ASSETS_DIR}/seed.log" | tail -1 | cut -d= -f2-)"

[[ -n "${PROJECT_ID}" ]] || fail "Missing PROJECT_ID"
[[ -n "${ORG_ID}" ]] || fail "Missing ORG_ID"
[[ -n "${TEST_JOB_ID}" ]] || fail "Missing TEST_JOB_ID"
[[ -n "${PERIOD_START}" ]] || fail "Missing PERIOD_START"
[[ -n "${PERIOD_END}" ]] || fail "Missing PERIOD_END"

log "✅ Seed OK: PROJECT_ID=${PROJECT_ID} ORG_ID=${ORG_ID} TEST_JOB_ID=${TEST_JOB_ID}"

# --- 2) Wait job to finish (so cost ledger is produced once) ---
log "🏁 Waiting job to finish..."
ok="0"
for t in $(seq 1 120); do
  st="$(psqlq "SELECT status FROM shot_jobs WHERE id='${TEST_JOB_ID}' LIMIT 1;")"
  echo "t=${t} status=${st}" >> "${ASSETS_DIR}/job_poll.log"
  if [[ "${st}" == "SUCCEEDED" ]]; then ok="1"; break; fi
  sleep 1
done
[[ "${ok}" == "1" ]] || fail "Job not SUCCEEDED (jobId=${TEST_JOB_ID})"

# --- 3) Duplicate billing assertion ---
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
  FROM cost_ledgers
  WHERE \"projectId\"='${PROJECT_ID}'
  GROUP BY \"jobId\",\"jobType\"
  HAVING count(*) > 1
) t;
")"
[[ "${dup_cnt}" == "0" ]] || fail "Duplicate charges detected (count=${dup_cnt})"

log "✅ No duplicate charges."

# --- 4) Quota exhaustion -> BLOCKED + audit ---
log "⛔ Setting credits=0 and enqueue blocking job..."
set +e
resp1="$(curl -sS -X POST "${API_URL}/admin/billing/set-credits" -H 'Content-Type: application/json' \
  -d "{\"orgId\":\"${ORG_ID}\",\"credits\":0}" 2>>"${ASSETS_DIR}/api.log")"
set -e
echo "${resp1}" >> "${ASSETS_DIR}/api.log"

set +e
resp2="$(curl -sS -X POST "${API_URL}/admin/jobs/enqueue-test" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"jobType\":\"CE03_VISUAL_DENSITY\",\"payload\":{}}" 2>>"${ASSETS_DIR}/api.log")"
set -e
echo "${resp2}" >> "${ASSETS_DIR}/api.log"

BLOCKED_JOB_ID="$(echo "${resp2}" | sed -n 's/.*"jobId":[ ]*"\([^"]\+\)".*/\1/p' | head -1 || true)"
[[ -n "${BLOCKED_JOB_ID}" ]] || fail "Failed to enqueue blocking job (no jobId returned)"

log "✅ Enqueued job for quota block: ${BLOCKED_JOB_ID}"

# 断言:该 job 状态为 BLOCKED
psqllog "sql_quota_block_status" "
SELECT id,status,\"lastError\", \"updatedAt\"
FROM shot_jobs
WHERE id='${BLOCKED_JOB_ID}';
"
st_block="$(psqlq "SELECT status FROM shot_jobs WHERE id='${BLOCKED_JOB_ID}' LIMIT 1;")"
echo "blocked_job_status=${st_block}" >> "${ASSETS_DIR}/quota_assertions.log"

if ! echo "${st_block}" | grep -Eq '^BLOCKED'; then
  fail "Quota blocked job is not in BLOCKED* status (status=${st_block}). Must be explicitly blocked."
fi

# 审计必须存在
psqllog "sql_quota_block_audit" "
SELECT id,action,\"createdAt\",metadata
FROM audit_logs
WHERE action='JOB_BLOCKED_QUOTA_EXHAUSTED'
ORDER BY \"createdAt\" DESC
LIMIT 10;
"
audit_cnt="$(psqlq "SELECT count(*) FROM audit_logs WHERE action='JOB_BLOCKED_QUOTA_EXHAUSTED';")"
[[ "${audit_cnt}" -ge 1 ]] || fail "Missing audit log JOB_BLOCKED_QUOTA_EXHAUSTED"

log "✅ Quota block audit exists."

# --- 5) Statement checksum reproducible ---
log "🧾 Generating statement checksum twice..."
export PROJECT_ID
export PERIOD_START
export PERIOD_END

npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_2_generate_statement.ts \
  | tee "${ASSETS_DIR}/statement_1.log"
npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p1_2_generate_statement.ts \
  | tee "${ASSETS_DIR}/statement_2.log"

C1="$(grep -E '^CHECKSUM=' "${ASSETS_DIR}/statement_1.log" | tail -1 | cut -d= -f2-)"
C2="$(grep -E '^CHECKSUM=' "${ASSETS_DIR}/statement_2.log" | tail -1 | cut -d= -f2-)"
[[ -n "${C1}" && -n "${C2}" ]] || fail "Missing CHECKSUM output from statement scripts"
[[ "${C1}" == "${C2}" ]] || fail "Statement checksum not reproducible: ${C1} != ${C2}"

log "✅ Statement checksum reproducible: ${C1}"

# --- 6) FINAL_REPORT ---
cat > "${EVID_DIR}/FINAL_REPORT.md" <<EOF
# P1-2 Billing Reconcile Gate - FINAL REPORT

- Timestamp: ${TS}
- API_URL: ${API_URL}
- PROJECT_ID: ${PROJECT_ID}
- ORG_ID: ${ORG_ID}
- TEST_JOB_ID: ${TEST_JOB_ID}
- BLOCKED_JOB_ID: ${BLOCKED_JOB_ID}
- Period: ${PERIOD_START} -> ${PERIOD_END}
- Result: PASS

## Key Assertions
- Job retries do not create duplicate cost ledger entries (jobId+jobType unique)
- Quota exhaustion explicitly blocks job (status starts with BLOCKED) and emits audit log
- Statement checksum is reproducible (two runs match)

## Evidence Files
- assets/gate.log
- assets/api_health.json
- assets/seed.log
- assets/job_poll.log
- assets/sql_duplicate_cost_assert.log
- assets/api.log
- assets/sql_quota_block_status.log
- assets/sql_quota_block_audit.log
- assets/statement_1.log
- assets/statement_2.log
EOF

log "✅ Gate Passed. Evidence: ${EVID_DIR}"
