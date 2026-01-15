#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r0_mother_shot_render_real_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export SHOT_RENDER_PROVIDER="${SHOT_RENDER_PROVIDER:-local}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

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
  python3 - <<import json, os, hashlib
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
echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0) Pre-init evidence files to avoid shasum errors
touch "${EVID_DIR}/sql_evidence_jobs.txt" "${EVID_DIR}/sql_evidence_ledger.txt" "${EVID_DIR}/SUMMARY.md"

# 0.1) Sync DB & Seed (ensure user/org exist)
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 1) Trigger Mother Engine (SSOT entry: /_internal/engine/invoke)
# Invariant: isVerification=true, metadata must be passed.
TRACE_ID="gate-p0r0-$(date +%s)"
REQ_PAYLOAD="$(cat <<JSON
{
  "engineKey": "shot_render",
  "payload": {
    "prompt": "gate_p0_r0_mother_shot_render_real: high quality masterpiece",
    "width": 512,
    "height": 512,
    "seed": 42
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "gate_p0r0_job_$(date +%s)",
    "projectId": "proj-p0r0-gate"
  }
}
JSON
)"

echo "Invoking Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
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
  sha256_sums || true
  build_evidence_index || true
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN_ID.txt"
SUCCESS=$(echo "${RESP}" | jq -r 
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  sha256_sums || true
  build_evidence_index || true
  exit 3
fi

# 2) SQL assertions
echo "[SQL] Verifying Shotted Job and Zero Ledger..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

# Assertion A: Job state is SUCCESS (via engine-hub)
# Note: Since itPROVIDER=$(echo "${RESP}" | jq -r ASSET_URI=$(echo "${RESP}" | jq -r 
if [ -z "${PROVIDER}" ] || [ "${PROVIDER}" == "null" ]; then
  echo "❌ FAIL: No providerSelected in audit_trail. Likely mock or bypass."
  write_exit_code 4
  exit 4
fi

# Assertion B: Ledger Isolation
LEDGER_COUNT=$(psql "${DB_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE metadata->>echo "Ledger count for trace ${TRACE_ID}: ${LEDGER_COUNT}" > "${EVID_DIR}/sql_evidence_ledger.txt" # $gate$

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination detected! Count: ${LEDGER_COUNT}"
  write_exit_code 5
  exit 5
fi

# Assertion C: Asset Integrity
if [ ! -f "${ASSET_URI}" ]; then
  echo "❌ FAIL: Asset file not found at ${ASSET_URI}"
  write_exit_code 6
  exit 6
fi
FILE_SIZE=$(wc -c < "${ASSET_URI}")
if [ "${FILE_SIZE}" -lt 1000 ]; then
  echo "❌ FAIL: Asset file too small (${FILE_SIZE} bytes). Possible stub."
  write_exit_code 7
  exit 7
fi

echo "PROVIDER=${PROVIDER}" > "${EVID_DIR}/sql_evidence_jobs.txt"
echo "ASSET_URI=${ASSET_URI}" >> "${EVID_DIR}/sql_evidence_jobs.txt"
echo "FILE_SIZE=${FILE_SIZE}" >> "${EVID_DIR}/sql_evidence_jobs.txt"

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R0 Mother -> SHOT_RENDER Real Gate Summary

- Provider: ${PROVIDER}
- Asset: ${ASSET_URI} (${FILE_SIZE} bytes)
- Ledger Status: CLEAN (Found ${LEDGER_COUNT} entries)
- TraceID: ${TRACE_ID}

## Invariants Verified
1) Entry via Mother Engine (/_internal/engine/invoke)
2) Real Engine forced (Provider: ${PROVIDER}, No mock fallback)
3) Asset exists and has valid size
4) Ledger isolation for isVerification=true (0 records)
5) Gate Exit Code: 0
MD

write_exit_code 0
sha256_sums
export EVID_DIR="${EVID_DIR}"
build_evidence_index

echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real PASS ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r0_mother_shot_render_real_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export SHOT_RENDER_PROVIDER="${SHOT_RENDER_PROVIDER:-local}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

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
  python3 - <<import json, os, hashlib
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
echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0) Pre-init evidence files to avoid shasum errors
touch "${EVID_DIR}/sql_evidence_jobs.txt" "${EVID_DIR}/sql_evidence_ledger.txt" "${EVID_DIR}/SUMMARY.md"

# 0.1) Sync DB & Seed (ensure user/org exist)
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 1) Trigger Mother Engine (SSOT entry: /_internal/engine/invoke)
# Invariant: isVerification=true, metadata must be passed.
TRACE_ID="gate-p0r0-$(date +%s)"
REQ_PAYLOAD="$(cat <<JSON
{
  "engineKey": "shot_render",
  "payload": {
    "prompt": "gate_p0_r0_mother_shot_render_real: high quality masterpiece",
    "width": 512,
    "height": 512,
    "seed": 42
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "gate_p0r0_job_$(date +%s)",
    "projectId": "proj-p0r0-gate"
  }
}
JSON
)"

echo "Invoking Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
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
  sha256_sums || true
  build_evidence_index || true
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN_ID.txt"
SUCCESS=$(echo "${RESP}" | jq -r 
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  sha256_sums || true
  build_evidence_index || true
  exit 3
fi

# 2) SQL assertions
echo "[SQL] Verifying Shotted Job and Zero Ledger..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

# Assertion A: Job state is SUCCESS (via engine-hub)
# Note: Since itPROVIDER=$(echo "${RESP}" | jq -r ASSET_URI=$(echo "${RESP}" | jq -r 
if [ -z "${PROVIDER}" ] || [ "${PROVIDER}" == "null" ]; then
  echo "❌ FAIL: No providerSelected in audit_trail. Likely mock or bypass."
  write_exit_code 4
  exit 4
fi

# Assertion B: Ledger Isolation
LEDGER_COUNT=$(psql "${DB_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE metadata->>echo "Ledger count for trace ${TRACE_ID}: ${LEDGER_COUNT}" > "${EVID_DIR}/sql_evidence_ledger.txt" # $gate$

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination detected! Count: ${LEDGER_COUNT}"
  write_exit_code 5
  exit 5
fi

# Assertion C: Asset Integrity
if [ ! -f "${ASSET_URI}" ]; then
  echo "❌ FAIL: Asset file not found at ${ASSET_URI}"
  write_exit_code 6
  exit 6
fi
FILE_SIZE=$(wc -c < "${ASSET_URI}")
if [ "${FILE_SIZE}" -lt 1000 ]; then
  echo "❌ FAIL: Asset file too small (${FILE_SIZE} bytes). Possible stub."
  write_exit_code 7
  exit 7
fi

echo "PROVIDER=${PROVIDER}" > "${EVID_DIR}/sql_evidence_jobs.txt"
echo "ASSET_URI=${ASSET_URI}" >> "${EVID_DIR}/sql_evidence_jobs.txt"
echo "FILE_SIZE=${FILE_SIZE}" >> "${EVID_DIR}/sql_evidence_jobs.txt"

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R0 Mother -> SHOT_RENDER Real Gate Summary

- Provider: ${PROVIDER}
- Asset: ${ASSET_URI} (${FILE_SIZE} bytes)
- Ledger Status: CLEAN (Found ${LEDGER_COUNT} entries)
- TraceID: ${TRACE_ID}

## Invariants Verified
1) Entry via Mother Engine (/_internal/engine/invoke)
2) Real Engine forced (Provider: ${PROVIDER}, No mock fallback)
3) Asset exists and has valid size
4) Ledger isolation for isVerification=true (0 records)
5) Gate Exit Code: 0
MD

write_exit_code 0
sha256_sums
export EVID_DIR="${EVID_DIR}"
build_evidence_index

echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real PASS ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r0_mother_shot_render_real_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export SHOT_RENDER_PROVIDER="${SHOT_RENDER_PROVIDER:-local}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

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
  python3 - <<import json, os, hashlib
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
echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0) Pre-init evidence files to avoid shasum errors
touch "${EVID_DIR}/sql_evidence_jobs.txt" "${EVID_DIR}/sql_evidence_ledger.txt" "${EVID_DIR}/SUMMARY.md"

# 0.1) Sync DB & Seed (ensure user/org exist)
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 1) Trigger Mother Engine (SSOT entry: /_internal/engine/invoke)
# Invariant: isVerification=true, metadata must be passed.
TRACE_ID="gate-p0r0-$(date +%s)"
REQ_PAYLOAD="$(cat <<JSON
{
  "engineKey": "shot_render",
  "payload": {
    "prompt": "gate_p0_r0_mother_shot_render_real: high quality masterpiece",
    "width": 512,
    "height": 512,
    "seed": 42
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "gate_p0r0_job_$(date +%s)",
    "projectId": "proj-p0r0-gate"
  }
}
JSON
)"

echo "Invoking Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
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
  sha256_sums || true
  build_evidence_index || true
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN_ID.txt"
SUCCESS=$(echo "${RESP}" | jq -r 
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  sha256_sums || true
  build_evidence_index || true
  exit 3
fi

# 2) SQL assertions
echo "[SQL] Verifying Shotted Job and Zero Ledger..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

# Assertion A: Job state is SUCCESS (via engine-hub)
# Note: Since itPROVIDER=$(echo "${RESP}" | jq -r ASSET_URI=$(echo "${RESP}" | jq -r 
if [ -z "${PROVIDER}" ] || [ "${PROVIDER}" == "null" ]; then
  echo "❌ FAIL: No providerSelected in audit_trail. Likely mock or bypass."
  write_exit_code 4
  exit 4
fi

# Assertion B: Ledger Isolation
LEDGER_COUNT=$(psql "${DB_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE metadata->>echo "Ledger count for trace ${TRACE_ID}: ${LEDGER_COUNT}" > "${EVID_DIR}/sql_evidence_ledger.txt" # $gate$

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination detected! Count: ${LEDGER_COUNT}"
  write_exit_code 5
  exit 5
fi

# Assertion C: Asset Integrity
if [ ! -f "${ASSET_URI}" ]; then
  echo "❌ FAIL: Asset file not found at ${ASSET_URI}"
  write_exit_code 6
  exit 6
fi
FILE_SIZE=$(wc -c < "${ASSET_URI}")
if [ "${FILE_SIZE}" -lt 1000 ]; then
  echo "❌ FAIL: Asset file too small (${FILE_SIZE} bytes). Possible stub."
  write_exit_code 7
  exit 7
fi

echo "PROVIDER=${PROVIDER}" > "${EVID_DIR}/sql_evidence_jobs.txt"
echo "ASSET_URI=${ASSET_URI}" >> "${EVID_DIR}/sql_evidence_jobs.txt"
echo "FILE_SIZE=${FILE_SIZE}" >> "${EVID_DIR}/sql_evidence_jobs.txt"

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R0 Mother -> SHOT_RENDER Real Gate Summary

- Provider: ${PROVIDER}
- Asset: ${ASSET_URI} (${FILE_SIZE} bytes)
- Ledger Status: CLEAN (Found ${LEDGER_COUNT} entries)
- TraceID: ${TRACE_ID}

## Invariants Verified
1) Entry via Mother Engine (/_internal/engine/invoke)
2) Real Engine forced (Provider: ${PROVIDER}, No mock fallback)
3) Asset exists and has valid size
4) Ledger isolation for isVerification=true (0 records)
5) Gate Exit Code: 0
MD

write_exit_code 0
sha256_sums
export EVID_DIR="${EVID_DIR}"
build_evidence_index

echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real PASS ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r0_mother_shot_render_real_${TS}"
mkdir -p "${EVID_DIR}"

# 确保启动环境符合封板要求
export GATE_MODE=1
export PRODUCTION_MODE=1
export VERIFICATION_COST_CAP_USD=1
export SHOT_RENDER_PROVIDER="${SHOT_RENDER_PROVIDER:-local}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

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
  python3 - <<import json, os, hashlib
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
echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real START ---"
echo "EVID_DIR=${EVID_DIR}"

# 0) Pre-init evidence files to avoid shasum errors
touch "${EVID_DIR}/sql_evidence_jobs.txt" "${EVID_DIR}/sql_evidence_ledger.txt" "${EVID_DIR}/SUMMARY.md"

# 0.1) Sync DB & Seed (ensure user/org exist)
echo "Seeding test data..."
node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null

# 0.2) Generate Token
echo "Generating test token..."
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 1) Trigger Mother Engine (SSOT entry: /_internal/engine/invoke)
# Invariant: isVerification=true, metadata must be passed.
TRACE_ID="gate-p0r0-$(date +%s)"
REQ_PAYLOAD="$(cat <<JSON
{
  "engineKey": "shot_render",
  "payload": {
    "prompt": "gate_p0_r0_mother_shot_render_real: high quality masterpiece",
    "width": 512,
    "height": 512,
    "seed": 42
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "gate_p0r0_job_$(date +%s)",
    "projectId": "proj-p0r0-gate"
  }
}
JSON
)"

echo "Invoking Mother Engine at ${API_BASE}/api/_internal/engine/invoke ..."
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
  sha256_sums || true
  build_evidence_index || true
  exit 2
fi

echo "${RESP}" | jq . > "${EVID_DIR}/RUN_ID.txt"
SUCCESS=$(echo "${RESP}" | jq -r 
if [ "${SUCCESS}" != "true" ]; then
  echo "Engine invocation failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  sha256_sums || true
  build_evidence_index || true
  exit 3
fi

# 2) SQL assertions
echo "[SQL] Verifying Shotted Job and Zero Ledger..."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

# Assertion A: Job state is SUCCESS (via engine-hub)
# Note: Since itPROVIDER=$(echo "${RESP}" | jq -r ASSET_URI=$(echo "${RESP}" | jq -r 
if [ -z "${PROVIDER}" ] || [ "${PROVIDER}" == "null" ]; then
  echo "❌ FAIL: No providerSelected in audit_trail. Likely mock or bypass."
  write_exit_code 4
  exit 4
fi

# Assertion B: Ledger Isolation
LEDGER_COUNT=$(psql "${DB_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE metadata->>echo "Ledger count for trace ${TRACE_ID}: ${LEDGER_COUNT}" > "${EVID_DIR}/sql_evidence_ledger.txt" # $gate$

if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination detected! Count: ${LEDGER_COUNT}"
  write_exit_code 5
  exit 5
fi

# Assertion C: Asset Integrity
if [ ! -f "${ASSET_URI}" ]; then
  echo "❌ FAIL: Asset file not found at ${ASSET_URI}"
  write_exit_code 6
  exit 6
fi
FILE_SIZE=$(wc -c < "${ASSET_URI}")
if [ "${FILE_SIZE}" -lt 1000 ]; then
  echo "❌ FAIL: Asset file too small (${FILE_SIZE} bytes). Possible stub."
  write_exit_code 7
  exit 7
fi

echo "PROVIDER=${PROVIDER}" > "${EVID_DIR}/sql_evidence_jobs.txt"
echo "ASSET_URI=${ASSET_URI}" >> "${EVID_DIR}/sql_evidence_jobs.txt"
echo "FILE_SIZE=${FILE_SIZE}" >> "${EVID_DIR}/sql_evidence_jobs.txt"

cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R0 Mother -> SHOT_RENDER Real Gate Summary

- Provider: ${PROVIDER}
- Asset: ${ASSET_URI} (${FILE_SIZE} bytes)
- Ledger Status: CLEAN (Found ${LEDGER_COUNT} entries)
- TraceID: ${TRACE_ID}

## Invariants Verified
1) Entry via Mother Engine (/_internal/engine/invoke)
2) Real Engine forced (Provider: ${PROVIDER}, No mock fallback)
3) Asset exists and has valid size
4) Ledger isolation for isVerification=true (0 records)
5) Gate Exit Code: 0
MD

write_exit_code 0
sha256_sums
export EVID_DIR="${EVID_DIR}"
build_evidence_index

echo "--- [GATE] P0-R0 Mother -> SHOT_RENDER Real PASS ---"
exit 0
