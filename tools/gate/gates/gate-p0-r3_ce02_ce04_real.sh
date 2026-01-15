#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ==============================================================================# 规格：Audit V2 Hardened (Zero-Python, Dual-Path SQL Audit)
# ==============================================================================

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r3_ce02_ce04_real_v2h_${TS}"
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
  node - <<const fs = require(const path = require(const crypto = require(const evidDir = process.env.EVID_DIR;
const files = fs.readdirSync(evidDir).filter(n => fs.statSync(path.join(evidDir, n)).isFile() && n !== const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({ name, bytes: b.length, sha256: crypto.createHash(}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
TRACE_ID="gate-p0r3-ce04-${TS}"
JOB_ID="job-p0r3-ce04-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce04_visual_enrichment",
  "payload": {
    "structured_text": "在风雪中的残破寺庙，少年跪在佛像前。"
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

SUCCESS=$(echo "${RESP}" | jq -r if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

ENRICHED=$(echo "${RESP}" | jq -r 
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" =  # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R3 Industrial Hardened Summary
- Engine: ce04_visual_enrichment
- TraceID: ${TRACE_ID}
- Enriched Prompt: ${ENRICHED}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A
- SQL_AUDIT.json: Captured
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R3 PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r3_ce02_ce04_real_v2h_${TS}"
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
  node - <<const fs = require(const path = require(const crypto = require(const evidDir = process.env.EVID_DIR;
const files = fs.readdirSync(evidDir).filter(n => fs.statSync(path.join(evidDir, n)).isFile() && n !== const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({ name, bytes: b.length, sha256: crypto.createHash(}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
TRACE_ID="gate-p0r3-ce04-${TS}"
JOB_ID="job-p0r3-ce04-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce04_visual_enrichment",
  "payload": {
    "structured_text": "在风雪中的残破寺庙，少年跪在佛像前。"
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

SUCCESS=$(echo "${RESP}" | jq -r if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

ENRICHED=$(echo "${RESP}" | jq -r 
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" =  # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R3 Industrial Hardened Summary
- Engine: ce04_visual_enrichment
- TraceID: ${TRACE_ID}
- Enriched Prompt: ${ENRICHED}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A
- SQL_AUDIT.json: Captured
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R3 PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r3_ce02_ce04_real_v2h_${TS}"
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
  node - <<const fs = require(const path = require(const crypto = require(const evidDir = process.env.EVID_DIR;
const files = fs.readdirSync(evidDir).filter(n => fs.statSync(path.join(evidDir, n)).isFile() && n !== const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({ name, bytes: b.length, sha256: crypto.createHash(}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
TRACE_ID="gate-p0r3-ce04-${TS}"
JOB_ID="job-p0r3-ce04-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce04_visual_enrichment",
  "payload": {
    "structured_text": "在风雪中的残破寺庙，少年跪在佛像前。"
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

SUCCESS=$(echo "${RESP}" | jq -r if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

ENRICHED=$(echo "${RESP}" | jq -r 
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" =  # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R3 Industrial Hardened Summary
- Engine: ce04_visual_enrichment
- TraceID: ${TRACE_ID}
- Enriched Prompt: ${ENRICHED}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A
- SQL_AUDIT.json: Captured
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R3 PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r3_ce02_ce04_real_v2h_${TS}"
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
  node - <<const fs = require(const path = require(const crypto = require(const evidDir = process.env.EVID_DIR;
const files = fs.readdirSync(evidDir).filter(n => fs.statSync(path.join(evidDir, n)).isFile() && n !== const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({ name, bytes: b.length, sha256: crypto.createHash(}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R3: CE02 Mother -> CE04 Real (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
TRACE_ID="gate-p0r3-ce04-${TS}"
JOB_ID="job-p0r3-ce04-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "ce04_visual_enrichment",
  "payload": {
    "structured_text": "在风雪中的残破寺庙，少年跪在佛像前。"
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

SUCCESS=$(echo "${RESP}" | jq -r if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

ENRICHED=$(echo "${RESP}" | jq -r 
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\" =  # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R3 Industrial Hardened Summary
- Engine: ce04_visual_enrichment
- TraceID: ${TRACE_ID}
- Enriched Prompt: ${ENRICHED}
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A
- SQL_AUDIT.json: Captured
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R3 PASS (Hardened) ---"
exit 0
