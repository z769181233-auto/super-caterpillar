#!/usr/bin/env bash
# ==============================================================================
# [GATE] P0-R3: CE02 Mother Engine -> CE04 (Visual Enrichment) Real Engine Seal
# 目标：验证视觉扩写真实引擎集成，及母引擎审计鉴权一致性。
# ==============================================================================
set -euo pipefail

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r3_ce02_ce04_real_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

API_BASE="${API_BASE:-http://127.0.0.1:3000}"

# ========== HELPERS ==========
write_exit_code() {
  local code="$1"
  echo "EXIT_CODE=${code}" > "${EVID_DIR}/GATE_EXIT_CODE.txt"
}

sha256_sums() {
  (cd "${EVID_DIR}" && shasum -a 256 RUN_ID.txt sql_evidence_jobs.txt sql_evidence_ledger.txt SUMMARY.md GATE_EXIT_CODE.txt > SHA256SUMS.txt)
}

build_evidence_index() {
  export EVID_DIR="${EVID_DIR}"
  python3 - <<'PY'
import json, os, hashlib
from pathlib import Path

evid_dir_str = os.environ.get("EVID_DIR")
if not evid_dir_str:
    raise ValueError("EVID_DIR env var missing")
evid_dir = Path(evid_dir_str)

files = ["RUN_ID.txt","sql_evidence_jobs.txt","sql_evidence_ledger.txt","SUMMARY.md","GATE_EXIT_CODE.txt","SHA256SUMS.txt"]
out = {"dir": str(evid_dir), "files": []}
for fn in files:
    p = evid_dir / fn
    if not p.exists():
        continue
    b = p.read_bytes()
    out["files"].append({
        "name": fn,
        "bytes": len(b),
        "sha256": hashlib.sha256(b).hexdigest(),
    })
(evid_dir / "EVIDENCE_INDEX.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
PY
}

# ========== MAIN ==========
echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0) Pre-init evidence files
touch "${EVID_DIR}/sql_evidence_jobs.txt" "${EVID_DIR}/sql_evidence_ledger.txt" "${EVID_DIR}/SUMMARY.md"

# 0.1) Seed data
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ sub: 'user-p0r0-gate', email: 'p0r0-gate@test.com', orgId: 'org-p0r0-gate', tier: 'PRO' }, process.env.JWT_SECRET, { expiresIn: '1h' }))")

# 1) Trigger Mother Engine
TRACE_ID="gate-p0r3-ce04-$(date +%s)"
REQ_PAYLOAD="$(cat <<JSON
{
  "engineKey": "ce04_visual_enrichment",
  "payload": {
    "structured_text": "在风雪中的残破寺庙，少年跪在佛像前。"
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "gate_p0r3_job_$(date +%s)",
    "projectId": "proj-p0r0-gate"
  }
}
JSON
)"

echo "Invoking CE02 Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
set +e
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d "${REQ_PAYLOAD}")"
CURL_CODE=$?
set -e

if [ "${CURL_CODE}" -ne 0 ]; then
  echo "Mother invoke failed (curl_code=${CURL_CODE})" | tee "${EVID_DIR}/SUMMARY.md"
  write_exit_code 2
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN_ID.txt"
SUCCESS=$(echo "${RESP}" | jq -r '.success')

if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r '.error.message')" | tee "${EVID_DIR}/SUMMARY.md"
  write_exit_code 3
  exit 3
fi

# 2) Invariants Assertion
echo "[SQL] Verifying CE04 Output Structure and Ledger Isolation..."

# A) Output Structure Assertion
# CE04 must return 'enriched_prompt'
ENRICHED=$(echo "${RESP}" | jq -r '.data.output.enriched_prompt')
if [ "${ENRICHED}" == "null" ] || [ -z "${ENRICHED}" ]; then
  echo "❌ FAIL: CE04 output 'enriched_prompt' missing."
  write_exit_code 4
  exit 4
fi

# B) Audit Trail Assertion
AUDIT_ENGINE=$(echo "${RESP}" | jq -r '.data.output.audit_trail.engine_version')
if [ -z "${AUDIT_ENGINE}" ] || [ "${AUDIT_ENGINE}" == "null" ]; then
  echo "❌ FAIL: No audit_trail.engine_version recorded."
  write_exit_code 5
  exit 5
fi

# C) Ledger Isolation Assertion
LEDGER_COUNT=$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE metadata->>'traceId' = '${TRACE_ID}'")
echo "Ledger count for trace ${TRACE_ID}: ${LEDGER_COUNT}" > "${EVID_DIR}/sql_evidence_ledger.txt"

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination detected! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# D) Result Content Inspection
echo "Enriched Prompt: ${ENRICHED}" > "${EVID_DIR}/sql_evidence_jobs.txt"

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R3: CE02 Mother -> CE04 Real Gate Summary

- Engine: ce04_visual_enrichment
- Engine Version: ${AUDIT_ENGINE}
- Enriched Prompt: ${ENRICHED}
- Ledger Status: CLEAN (Found ${LEDGER_COUNT} entries)
- TraceID: ${TRACE_ID}

## Invariants Verified
1) Entry via CE02 Mother Engine (/_internal/engine/invoke)
2) Real CE04 Logic execution (Prompt enriched)
3) Audit Trail consistency (engine_version recorded)
4) Ledger isolation for isVerification=true (0 records)
5) Gate Exit Code: 0
MD

write_exit_code 0
sha256_sums
build_evidence_index

echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real PASS ---"
exit 0
