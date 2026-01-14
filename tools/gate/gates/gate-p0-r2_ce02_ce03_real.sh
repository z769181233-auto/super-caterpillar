#!/usr/bin/env bash
# ==============================================================================
# [GATE] P0-R2: CE02 Mother Engine -> CE03 (Visual Density) Real Engine Seal
# 目标：验证视觉密度分析真实引擎集成。
# 规格：Audit Hardware V2 (REQ.json, RUN.json, SQL_JOB.json, SHA256SUMS)
# ==============================================================================
set -euo pipefail

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
# 这里的目录命名增加规格标识以示区分
EVID_DIR="${EVID_ROOT}/p0_r2_ce02_ce03_real_v2_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

# SECURITY WARNING: 默认 JWT_SECRET 仅用于本地 GATE 环境，严禁生产复用
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

API_BASE="${API_BASE:-http://127.0.0.1:3000}"

# ========== HELPERS ==========
write_exit_code() {
  local code="$1"
  echo "${code}" > "${EVID_DIR}/GATE_EXIT_CODE.txt"
}

sha256_sums() {
  echo "--- Generating SHA256 Sums ---"
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
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

out = {"dir": str(evid_dir), "files": []}
for p in evid_dir.iterdir():
    if p.is_file() and p.name != "EVIDENCE_INDEX.json":
        b = p.read_bytes()
        out["files"].append({
            "name": p.name,
            "bytes": len(b),
            "sha256": hashlib.sha256(b).hexdigest(),
        })
(evid_dir / "EVIDENCE_INDEX.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
PY
}

# ========== MAIN ==========
echo "--- [GATE] P0-R2: CE02 Mother -> CE03 Real (Industrial Grade) START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0.1) Seed data
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ sub: 'user-p0r0-gate', email: 'p0r0-gate@test.com', orgId: 'org-p0r0-gate', tier: 'PRO' }, process.env.JWT_SECRET, { expiresIn: '1h' }))")

# 1) Trigger Mother Engine
TRACE_ID="gate-p0r2-ce03-${TS}"
JOB_ID="job-p0r2-ce03-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce03_visual_density",
  "payload": {
    "structured_text": "在一个光线昏暗的房间里，少年看着镜子，他的眼睛里闪烁着红色的光芒。墙上的影子在跳动。"
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate"
  }
}
JSON

echo "Invoking CE02 Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
set +e
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
CURL_CODE=$?
set -e

if [ "${CURL_CODE}" -ne 0 ]; then
  echo "Mother invoke failed (curl_code=${CURL_CODE})" | tee "${EVID_DIR}/SUMMARY.md"
  write_exit_code 2
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"
echo "${JOB_ID}" > "${EVID_DIR}/RUN_ID.txt"

SUCCESS=$(echo "${RESP}" | jq -r '.success')
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r '.error.message')" | tee "${EVID_DIR}/SUMMARY.md"
  write_exit_code 3
  exit 3
fi

# 2) Invariants Assertion
echo "[SQL] Verifying Output and Isolation..."

# A) Output Structure
SCORE=$(echo "${RESP}" | jq -r '.data.output.visual_density_score')
if [ "${SCORE}" == "null" ]; then
  echo "❌ FAIL: visual_density_score missing."
  write_exit_code 4
  exit 4
fi

# B) DB Evidence (SQL_JOB.json)
echo "Querying DB for job status..."
psql "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM (SELECT id, status, type, is_verification, \"traceId\", \"createdAt\" FROM shot_jobs WHERE id = '${JOB_ID}') t" > "${EVID_DIR}/SQL_JOB.json"
psql "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM (SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at FROM cost_ledgers WHERE \"traceId\" = '${TRACE_ID}') t" > "${EVID_DIR}/SQL_LEDGER.json"
LEDGER_COUNT=$(psql "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" = '${TRACE_ID}'")

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# D) Summary
cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R2 Industrial Gate Summary
- Engine: ce03_visual_density
- TraceID: ${TRACE_ID}
- JobID: ${JOB_ID}
- Density Score: ${SCORE}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- Evidence Status: REQ.json, RUN.json, SQL_JOB.json, SQL_LEDGER.json captured.
MD

write_exit_code 0
sha256_sums
build_evidence_index

echo "--- [GATE] P0-R2 PASS ---"
exit 0
