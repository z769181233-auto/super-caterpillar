#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# ==============================================================================# 目标：验证真实视频产出节点、审计链、资产落盘、账本隔离及幂等性。
# 规格：Audit V2 Hardened (Zero-Python, ffprobe-check, Idempotency-Assert)
# ==============================================================================

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r4_ce02_video_render_real_v2h_${TS}"
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
  echo "--- Generating SHA256 Sums ---"
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
}

build_evidence_index() {
  echo "--- Building Evidence Index (Node-only) ---"
  export EVID_DIR="${EVID_DIR}"
  node - <<const fs = require(const path = require(const crypto = require(
const evidDir = process.env.EVID_DIR;
if (!evidDir) throw new Error(
const files = fs.readdirSync(evidDir)
  .filter(n => fs.statSync(path.join(evidDir, n)).isFile())
  .filter(n => n !== 
const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({
    name,
    bytes: b.length,
    sha256: crypto.createHash(  });
}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R4: CE02 Mother -> VIDEO_RENDER (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 0) Create dummy images (FFmpeg-only, no Python dependency)
FRAME_DIR="/tmp/scu_gate_assets"
mkdir -p "${FRAME_DIR}"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=100x100:r=24:d=0.2" \
  -frames:v 4 "${FRAME_DIR}/frame_%04d.png"

# 1) Round 1: Trigger Real Video Render
TRACE_ID="gate-p0r4-video-${TS}"
JOB_ID="job-p0r4-video-${TS}"
DEDUPE_KEY="dedupe-p0r4-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "video_merge",
  "payload": {
    "jobId": "${JOB_ID}",
    "framePaths": [
      "${FRAME_DIR}/frame_0001.png",
      "${FRAME_DIR}/frame_0002.png",
      "${FRAME_DIR}/frame_0003.png",
      "${FRAME_DIR}/frame_0004.png"
    ]
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate",
    "dedupeKey": "${DEDUPE_KEY}"
  }
}
JSON

echo "Invoking Round 1..."
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"

if [ "$(echo "${RESP}" | jq -r   echo "❌ FAIL: Round 1 failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

# 2) Round 2: Idempotency Check
echo "Invoking Round 2 (Idempotency Assert)..."
RESP2="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP2}" | jq . > "${EVID_DIR}/RUN_IDEMPOTENT.json"

URI1=$(echo "${RESP}" | jq -r URI2=$(echo "${RESP2}" | jq -r 
if [ "${URI1}" != "${URI2}" ]; then
  echo "❌ FAIL: Idempotency broken: uri mismatch"
  write_exit_code 14
  exit 14
fi

# 3) Asset Verification (ffprobe hard check)
echo "Verifying Asset Integrity..."
if [ -z "${URI1}" ] || [ "${URI1}" = "null" ]; then
  echo "❌ FAIL: Missing asset.uri"
  write_exit_code 10
  exit 10
fi
if [[ "${URI1}" == *"dummy"* ]]; then
  echo "❌ FAIL: Dummy asset detected: ${URI1}"
  write_exit_code 11
  exit 11
fi
if [ ! -f "${URI1}" ]; then
  echo "❌ FAIL: Video file not found at ${URI1}"
  write_exit_code 12
  exit 12
fi

DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${URI1}")
DURATION_OK=$(echo "${DURATION}" | awk if [ "${DURATION_OK}" != "ok" ]; then
  echo "❌ FAIL: Invalid duration from ffprobe: ${DURATION}"
  write_exit_code 13
  exit 13
fi

# 4) SQL Evidence (Dual-Path Logic)
echo "Querying SQL Evidence (Hardened)..."
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\"= # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# 5) Summary
cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R4 Industrial Hardened Gate Summary
- Engine: video_merge
- TraceID: ${TRACE_ID}
- Asset URI: ${URI1}
- FFmpeg Duration: ${DURATION}s
- Idempotency: MATCHED (uri1 == uri2)
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A (Direct invoke doesn- SQL_AUDIT.json: Captured (details/payload dual-path)
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R4 TOTAL PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r4_ce02_video_render_real_v2h_${TS}"
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
  echo "--- Generating SHA256 Sums ---"
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
}

build_evidence_index() {
  echo "--- Building Evidence Index (Node-only) ---"
  export EVID_DIR="${EVID_DIR}"
  node - <<const fs = require(const path = require(const crypto = require(
const evidDir = process.env.EVID_DIR;
if (!evidDir) throw new Error(
const files = fs.readdirSync(evidDir)
  .filter(n => fs.statSync(path.join(evidDir, n)).isFile())
  .filter(n => n !== 
const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({
    name,
    bytes: b.length,
    sha256: crypto.createHash(  });
}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R4: CE02 Mother -> VIDEO_RENDER (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 0) Create dummy images (FFmpeg-only, no Python dependency)
FRAME_DIR="/tmp/scu_gate_assets"
mkdir -p "${FRAME_DIR}"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=100x100:r=24:d=0.2" \
  -frames:v 4 "${FRAME_DIR}/frame_%04d.png"

# 1) Round 1: Trigger Real Video Render
TRACE_ID="gate-p0r4-video-${TS}"
JOB_ID="job-p0r4-video-${TS}"
DEDUPE_KEY="dedupe-p0r4-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "video_merge",
  "payload": {
    "jobId": "${JOB_ID}",
    "framePaths": [
      "${FRAME_DIR}/frame_0001.png",
      "${FRAME_DIR}/frame_0002.png",
      "${FRAME_DIR}/frame_0003.png",
      "${FRAME_DIR}/frame_0004.png"
    ]
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate",
    "dedupeKey": "${DEDUPE_KEY}"
  }
}
JSON

echo "Invoking Round 1..."
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"

if [ "$(echo "${RESP}" | jq -r   echo "❌ FAIL: Round 1 failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

# 2) Round 2: Idempotency Check
echo "Invoking Round 2 (Idempotency Assert)..."
RESP2="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP2}" | jq . > "${EVID_DIR}/RUN_IDEMPOTENT.json"

URI1=$(echo "${RESP}" | jq -r URI2=$(echo "${RESP2}" | jq -r 
if [ "${URI1}" != "${URI2}" ]; then
  echo "❌ FAIL: Idempotency broken: uri mismatch"
  write_exit_code 14
  exit 14
fi

# 3) Asset Verification (ffprobe hard check)
echo "Verifying Asset Integrity..."
if [ -z "${URI1}" ] || [ "${URI1}" = "null" ]; then
  echo "❌ FAIL: Missing asset.uri"
  write_exit_code 10
  exit 10
fi
if [[ "${URI1}" == *"dummy"* ]]; then
  echo "❌ FAIL: Dummy asset detected: ${URI1}"
  write_exit_code 11
  exit 11
fi
if [ ! -f "${URI1}" ]; then
  echo "❌ FAIL: Video file not found at ${URI1}"
  write_exit_code 12
  exit 12
fi

DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${URI1}")
DURATION_OK=$(echo "${DURATION}" | awk if [ "${DURATION_OK}" != "ok" ]; then
  echo "❌ FAIL: Invalid duration from ffprobe: ${DURATION}"
  write_exit_code 13
  exit 13
fi

# 4) SQL Evidence (Dual-Path Logic)
echo "Querying SQL Evidence (Hardened)..."
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\"= # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# 5) Summary
cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R4 Industrial Hardened Gate Summary
- Engine: video_merge
- TraceID: ${TRACE_ID}
- Asset URI: ${URI1}
- FFmpeg Duration: ${DURATION}s
- Idempotency: MATCHED (uri1 == uri2)
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A (Direct invoke doesn- SQL_AUDIT.json: Captured (details/payload dual-path)
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R4 TOTAL PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r4_ce02_video_render_real_v2h_${TS}"
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
  echo "--- Generating SHA256 Sums ---"
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
}

build_evidence_index() {
  echo "--- Building Evidence Index (Node-only) ---"
  export EVID_DIR="${EVID_DIR}"
  node - <<const fs = require(const path = require(const crypto = require(
const evidDir = process.env.EVID_DIR;
if (!evidDir) throw new Error(
const files = fs.readdirSync(evidDir)
  .filter(n => fs.statSync(path.join(evidDir, n)).isFile())
  .filter(n => n !== 
const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({
    name,
    bytes: b.length,
    sha256: crypto.createHash(  });
}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R4: CE02 Mother -> VIDEO_RENDER (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 0) Create dummy images (FFmpeg-only, no Python dependency)
FRAME_DIR="/tmp/scu_gate_assets"
mkdir -p "${FRAME_DIR}"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=100x100:r=24:d=0.2" \
  -frames:v 4 "${FRAME_DIR}/frame_%04d.png"

# 1) Round 1: Trigger Real Video Render
TRACE_ID="gate-p0r4-video-${TS}"
JOB_ID="job-p0r4-video-${TS}"
DEDUPE_KEY="dedupe-p0r4-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "video_merge",
  "payload": {
    "jobId": "${JOB_ID}",
    "framePaths": [
      "${FRAME_DIR}/frame_0001.png",
      "${FRAME_DIR}/frame_0002.png",
      "${FRAME_DIR}/frame_0003.png",
      "${FRAME_DIR}/frame_0004.png"
    ]
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate",
    "dedupeKey": "${DEDUPE_KEY}"
  }
}
JSON

echo "Invoking Round 1..."
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"

if [ "$(echo "${RESP}" | jq -r   echo "❌ FAIL: Round 1 failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

# 2) Round 2: Idempotency Check
echo "Invoking Round 2 (Idempotency Assert)..."
RESP2="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP2}" | jq . > "${EVID_DIR}/RUN_IDEMPOTENT.json"

URI1=$(echo "${RESP}" | jq -r URI2=$(echo "${RESP2}" | jq -r 
if [ "${URI1}" != "${URI2}" ]; then
  echo "❌ FAIL: Idempotency broken: uri mismatch"
  write_exit_code 14
  exit 14
fi

# 3) Asset Verification (ffprobe hard check)
echo "Verifying Asset Integrity..."
if [ -z "${URI1}" ] || [ "${URI1}" = "null" ]; then
  echo "❌ FAIL: Missing asset.uri"
  write_exit_code 10
  exit 10
fi
if [[ "${URI1}" == *"dummy"* ]]; then
  echo "❌ FAIL: Dummy asset detected: ${URI1}"
  write_exit_code 11
  exit 11
fi
if [ ! -f "${URI1}" ]; then
  echo "❌ FAIL: Video file not found at ${URI1}"
  write_exit_code 12
  exit 12
fi

DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${URI1}")
DURATION_OK=$(echo "${DURATION}" | awk if [ "${DURATION_OK}" != "ok" ]; then
  echo "❌ FAIL: Invalid duration from ffprobe: ${DURATION}"
  write_exit_code 13
  exit 13
fi

# 4) SQL Evidence (Dual-Path Logic)
echo "Querying SQL Evidence (Hardened)..."
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\"= # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# 5) Summary
cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R4 Industrial Hardened Gate Summary
- Engine: video_merge
- TraceID: ${TRACE_ID}
- Asset URI: ${URI1}
- FFmpeg Duration: ${DURATION}s
- Idempotency: MATCHED (uri1 == uri2)
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A (Direct invoke doesn- SQL_AUDIT.json: Captured (details/payload dual-path)
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R4 TOTAL PASS (Hardened) ---"
exit 0

# ========== CONFIG ==========
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/p0_r4_ce02_video_render_real_v2h_${TS}"
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
  echo "--- Generating SHA256 Sums ---"
  (cd "${EVID_DIR}" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -exec shasum -a 256 {} + > SHA256SUMS.txt)
}

build_evidence_index() {
  echo "--- Building Evidence Index (Node-only) ---"
  export EVID_DIR="${EVID_DIR}"
  node - <<const fs = require(const path = require(const crypto = require(
const evidDir = process.env.EVID_DIR;
if (!evidDir) throw new Error(
const files = fs.readdirSync(evidDir)
  .filter(n => fs.statSync(path.join(evidDir, n)).isFile())
  .filter(n => n !== 
const out = { dir: evidDir, files: [] };
for (const name of files) {
  const p = path.join(evidDir, name);
  const b = fs.readFileSync(p);
  out.files.push({
    name,
    bytes: b.length,
    sha256: crypto.createHash(  });
}
fs.writeFileSync(path.join(evidDir, JS
}

# ========== MAIN ==========
echo "--- [GATE] P0-R4: CE02 Mother -> VIDEO_RENDER (Hardened) START ---"
echo "EVID_DIR=${EVID_DIR}"

node tools/gate/gates/p0r0_seed_prisma.mjs > /dev/null
TOKEN=$(pnpm --prefix apps/api exec node -e "const jwt = require(
# 0) Create dummy images (FFmpeg-only, no Python dependency)
FRAME_DIR="/tmp/scu_gate_assets"
mkdir -p "${FRAME_DIR}"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=100x100:r=24:d=0.2" \
  -frames:v 4 "${FRAME_DIR}/frame_%04d.png"

# 1) Round 1: Trigger Real Video Render
TRACE_ID="gate-p0r4-video-${TS}"
JOB_ID="job-p0r4-video-${TS}"
DEDUPE_KEY="dedupe-p0r4-${TS}"

cat > "${EVID_DIR}/REQ.json" <<JSON
{
  "engineKey": "video_merge",
  "payload": {
    "jobId": "${JOB_ID}",
    "framePaths": [
      "${FRAME_DIR}/frame_0001.png",
      "${FRAME_DIR}/frame_0002.png",
      "${FRAME_DIR}/frame_0003.png",
      "${FRAME_DIR}/frame_0004.png"
    ]
  },
  "metadata": {
    "isVerification": true,
    "traceId": "${TRACE_ID}",
    "jobId": "${JOB_ID}",
    "projectId": "proj-p0r0-gate",
    "dedupeKey": "${DEDUPE_KEY}"
  }
}
JSON

echo "Invoking Round 1..."
RESP="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP}" | jq . > "${EVID_DIR}/RUN.json"

if [ "$(echo "${RESP}" | jq -r   echo "❌ FAIL: Round 1 failed: $(echo "${RESP}" | jq -r   write_exit_code 3
  exit 3
fi

# 2) Round 2: Idempotency Check
echo "Invoking Round 2 (Idempotency Assert)..."
RESP2="$(curl -sS -X POST "${API_BASE}/api/_internal/engine/invoke" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-gate-mode: 1" \
  -d @"${EVID_DIR}/REQ.json")"
echo "${RESP2}" | jq . > "${EVID_DIR}/RUN_IDEMPOTENT.json"

URI1=$(echo "${RESP}" | jq -r URI2=$(echo "${RESP2}" | jq -r 
if [ "${URI1}" != "${URI2}" ]; then
  echo "❌ FAIL: Idempotency broken: uri mismatch"
  write_exit_code 14
  exit 14
fi

# 3) Asset Verification (ffprobe hard check)
echo "Verifying Asset Integrity..."
if [ -z "${URI1}" ] || [ "${URI1}" = "null" ]; then
  echo "❌ FAIL: Missing asset.uri"
  write_exit_code 10
  exit 10
fi
if [[ "${URI1}" == *"dummy"* ]]; then
  echo "❌ FAIL: Dummy asset detected: ${URI1}"
  write_exit_code 11
  exit 11
fi
if [ ! -f "${URI1}" ]; then
  echo "❌ FAIL: Video file not found at ${URI1}"
  write_exit_code 12
  exit 12
fi

DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${URI1}")
DURATION_OK=$(echo "${DURATION}" | awk if [ "${DURATION_OK}" != "ok" ]; then
  echo "❌ FAIL: Invalid duration from ffprobe: ${DURATION}"
  write_exit_code 13
  exit 13
fi

# 4) SQL Evidence (Dual-Path Logic)
echo "Querying SQL Evidence (Hardened)..."
psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, action, \"resourceId\", details, payload, \"createdAt\"
  FROM audit_logs
  WHERE COALESCE(details->>) t" > "${EVID_DIR}/SQL_AUDIT.json"

psql -d "${DATABASE_URL}" -t -A -c "SELECT json_agg(t) FROM ( # $gate$
  SELECT id, \"costAmount\", currency, \"traceId\", \"jobId\", created_at
  FROM cost_ledgers
  WHERE \"traceId\" = ) t" > "${EVID_DIR}/SQL_LEDGER.json"

echo LEDGER_COUNT=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"traceId\"= # $gate$
if [ "${LEDGER_COUNT}" -ne 0 ]; then
  echo "❌ FAIL: Ledger contamination! Count: ${LEDGER_COUNT}"
  write_exit_code 6
  exit 6
fi

# 5) Summary
cat > "${EVID_DIR}/SUMMARY.md" <<MD
# P0-R4 Industrial Hardened Gate Summary
- Engine: video_merge
- TraceID: ${TRACE_ID}
- Asset URI: ${URI1}
- FFmpeg Duration: ${DURATION}s
- Idempotency: MATCHED (uri1 == uri2)
- Ledger Count: ${LEDGER_COUNT} (Verified CLEAN)
- SQL_JOB.json: N/A (Direct invoke doesn- SQL_AUDIT.json: Captured (details/payload dual-path)
MD

write_exit_code 0
sha256_sums
build_evidence_index
echo "--- [GATE] P0-R4 TOTAL PASS (Hardened) ---"
exit 0
