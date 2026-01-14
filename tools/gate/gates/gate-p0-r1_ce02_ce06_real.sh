#!/usr/bin/env bash
# ==============================================================================
# [GATE] P0-R1: CE02 Mother Engine -> CE06 (Novel Parsing) Real Seal
# 目标：验证小说解析真实引擎集成。
# 规格：Audit V2 Hardened (Zero-Python, Dual-Path SQL Audit)
# ==============================================================================
set -euo pipefail

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r1_ce02_ce06_real_v2h_${TS}"
mkdir -p "${EVID_DIR}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

API_BASE="${API_BASE:-http://127.0.0.1:3000}"

# ========== HELPERS ==========
write_exit_code() {
  local code="$1"
  echo "${code}" > "${EVID_DIR}/GATE_EXIT_CODE.txt"
}

sha256_sums() {
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
}

build_evidence_index() {
  export EVID_DIR="${EVID_DIR}"
  node - <<'JS'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const evidDir = process.env.EVID_DIR;
const files = fs.readdirSync(evidDir).filter(n => fs.statSync(path.join(evidDir, n)).isFile() && n !== 'EVIDENCE_INDEX.json');
const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({ name, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') });
}
fs.writeFileSync(path.join(evidDir, 'EVIDENCE_INDEX.json'), JSON.stringify(out, null, 2));
JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R1: CE02 Mother -> CE06 Real (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ sub: 'user-p0r0-gate', email: 'p0r0-gate@test.com', orgId: 'password-less-p0r0-gate', tier: 'PRO' }, process.env.JWT_SECRET, { expiresIn: '1h' }))")

TRACE_ID="gate-p0r1-ce06-${TS}"
JOB_ID="job-p0r1-ce06-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce06_novel_parsing",
  "payload": {
    "structured_text": "第一章 剑起云涌\n\n那是一个风雪交加的夜晚，少年紧握残剑，目光如炬。"
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate"
  }
}
JSON

RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"

echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"
echo "${JOB_ID}" > "${EVID_DIR}/RUN_ID.txt"

SUCCESS=$(echo "${RESP}" | jq -r '.data.success')
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r '.data.error.message')" | tee "${EVID_DIR}/SUMMARY.md"
  write_exit_code 3
  exit 3
fi

VOL_COUNT=$(echo "${RESP}" | jq '.data.output.volumes | length')

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM (
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>'_traceId', payload->>'_traceId', payload->>'traceId') = '${TRACE_ID}'
) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM (
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = '${TRACE_ID}'
) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo '[]' > "${EVID_DIR}/SQL_JOB.json"
LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" = '${TRACE_ID}'")

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R1 Industrial Hardened Summary
- Engine: ce06_novel_parsing
- TraceID: ${TRACE_ID}
- Volumes Count: ${VOL_COUNT}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A (Direct invoke)
- SQL_AUDIT.json: Captured
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R1 PASS (Hardened) ---"
exit 0
