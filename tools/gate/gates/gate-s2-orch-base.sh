#!/bin/bash
set -e

# =========================================================================================
# GATE: Stage-2 Orchestrator Base (S2-ORCH-BASE)
# =========================================================================================
# Goals:
# 1. Verify Atomic Dispatch (Orchestrator atomicity).
# 2. Verify Ack/Complete flow (Idempotency, Ownership).
# 3. Regression: Ensure Stage-1 Real Pipeline still works.
# =========================================================================================

# 1. Setup Environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../../.."
cd "${ROOT_DIR}"

EVIDENCE_DIR="docs/_evidence/S2_ORCH_BASE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${EVIDENCE_DIR}"

echo "================================================================="
echo "GATE: S2-ORCH-BASE Verification"
echo "Evidence Dir: ${EVIDENCE_DIR}"
echo "================================================================="

# Source helper if available (optional)

# 2. Start API Server (Background)
echo "[Gate] Starting API Server..."
export PORT=3333
export API_URL="http://localhost:${PORT}"
export TEST_TOKEN="s2-gate-test-token-$(date +%s)"
# Mock Auth Secret for testing if needed or rely on default dev secrets
export JWT_SECRET="dev-secret"
export HMAC_SECRET="dev-secret"

# Clean up previous
pkill -f "nest start" || true
pkill -f "stage2-mock-worker" || true
pkill -f "node dist/main" || true
# Aggressive kill
lsof -ti :3333 | xargs kill -9 || true

# Build API
echo "[Gate] DATABASE_URL: ${DATABASE_URL}"
echo "[Gate] Checking Orchestrator Source for Recovery Logic:"
grep "Recovery" apps/api/src/orchestrator/orchestrator.service.ts || echo "[Gate] WARNING: Recovery Logic NOT FOUND in source!"

# Force strict build
echo "[Gate] Building API (Force)..."
npx turbo run build --filter=api --force

# Start API
echo "[Gate] Starting API..."
# We run directly from apps/api/dist to ensure internal paths work if needed, or relative from root
node apps/api/dist/main.js > "${EVIDENCE_DIR}/api.log" 2>&1 &
API_PID=$!
echo "[Gate] API PID: ${API_PID}"

# Wait for API to be ready
echo "[Gate] Waiting for API to be ready..."
for i in {1..30}; do
  if curl -s "${API_URL}/api/health" > /dev/null; then
    echo "[Gate] API is READY."
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "[Gate] API failed to start."
    tail -n 20 "${EVIDENCE_DIR}/api.log"
    kill ${API_PID}
    exit 1
  fi
done

# 3. PART A: Verification of Atomic Dispatch with Mock Worker
echo "-----------------------------------------------------------------"
echo "[Gate] PART A: Atomic Dispatch Verification"
echo "-----------------------------------------------------------------"

# 3.1 Seed Test Job
echo "[Gate] Seeding Test Job..."
SEED_OUTPUT=$(npx tsx tools/gate/scripts/s2-seed.ts)
echo "${SEED_OUTPUT}" > "${EVIDENCE_DIR}/seed.log"
JOB_ID=$(grep "Created Job:" "${EVIDENCE_DIR}/seed.log" | awk '{print $NF}')
USER_ID=$(grep "UserId:" "${EVIDENCE_DIR}/seed.log" | awk '{print $NF}')

if [ -z "${JOB_ID}" ] || [ -z "${USER_ID}" ]; then
  echo "[Gate] Failed to seed job or user."
  kill ${API_PID}
  exit 1
fi
echo "[Gate] Seeded Job ID: ${JOB_ID}"
echo "[Gate] Seeded User ID: ${USER_ID}"

# 3.1.5 Generate Valid Token
echo "[Gate] Generating Token..."
# Run in apps/api context to ensure jsonwebtoken is resolved
TEST_TOKEN=$(cd apps/api && npx tsx ../../tools/gate/scripts/s2-gen-token.ts "${USER_ID}")
# Trim whitespace
TEST_TOKEN=$(echo "${TEST_TOKEN}" | tr -d '[:space:]')

if [ -z "${TEST_TOKEN}" ]; then
  echo "[Gate] Failed to generate token."
  kill ${API_PID}
  exit 1
fi
export TEST_TOKEN

# 3.2 Start Mock Worker
echo "[Gate] Starting Mock Worker..."
npx tsx tools/gate/mocks/stage2-mock-worker.ts > "${EVIDENCE_DIR}/mock_worker.log" 2>&1 &
WORKER_PID=$!

# 3.3 Wait for Completion
echo "[Gate] Waiting for job completion..."
STATUS="PENDING"
WORKER_UUID=""

for i in {1..20}; do
  # Query DB directly for status
  RAW_OUTPUT=$(npx tsx tools/gate/scripts/s2-check-status.ts "${JOB_ID}")
  # Trim whitespace
  RAW_OUTPUT=$(echo "${RAW_OUTPUT}" | tr -d '[:space:]')
  
  CURRENT_STATUS=$(echo "${RAW_OUTPUT}" | cut -d'|' -f1)
  CURRENT_WORKER=$(echo "${RAW_OUTPUT}" | cut -d'|' -f2)
  
  echo "[Gate] Current Status: ${CURRENT_STATUS}"
  
  if [ "${CURRENT_STATUS}" == "SUCCEEDED" ]; then
    echo "[Gate] Job SUCCEEDED!"
    STATUS="SUCCEEDED"
    WORKER_UUID="${CURRENT_WORKER}"
    break
  fi
  
  if [ "${CURRENT_STATUS}" == "FAILED" ]; then
    echo "[Gate] Job FAILED!"
    STATUS="FAILED"
    break
  fi
  
  sleep 3
done

if [ "${STATUS}" != "SUCCEEDED" ]; then
  echo "[Gate] Timeout waiting for job success. Status: ${STATUS}"
  tail -n 20 "${EVIDENCE_DIR}/mock_worker.log"
  kill ${WORKER_PID} || true
  kill ${API_PID} || true
  exit 1
fi

# 3.4 Verify Evidence (Worker ID mapping)
if [[ "${WORKER_UUID}" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "[Gate] Verification PASS: WorkerId is UUID (${WORKER_UUID})"
else
  echo "[Gate] Verification FAIL: WorkerId is NOT UUID (${WORKER_UUID})"
  kill ${WORKER_PID} || true
  kill ${API_PID} || true
  exit 1
fi

kill ${WORKER_PID} || true
echo "[Gate] PART A Passed."

# 4. PART B: Stage-1 Regression (Calling existing gate)
echo "-----------------------------------------------------------------"
echo "[Gate] PART B: Stage-1 Real Pipeline Regression"
echo "-----------------------------------------------------------------"

# Note: The existing gate is a CLIENT-SIDE script that EXPECTS an API.
# So we must KEEP OUR API RUNNING.
# But we must KILL our Mock Worker to avoid interference.
kill ${WORKER_PID} || true # Kill Mock Worker

# Start Real Worker (with explicit env)
echo "[Gate] Starting Real Worker (apps/workers/src/main.ts) for Stage 1..."
RENDER_ENGINE=ffmpeg npx tsx apps/workers/src/main.ts > "${EVIDENCE_DIR}/real_worker.log" 2>&1 &
REAL_WORKER_PID=$!
echo "[Gate] Real Worker PID: ${REAL_WORKER_PID}"

# Wait for worker to be ready (heuristic)
sleep 10

# Run Stage 1 Gate
# We need to capture its output to our evidence dir
# We use _real.sh which is the client side verification
./tools/gate/gates/gate-stage1_novel_to_prod_video_real.sh 2>&1 | tee "${EVIDENCE_DIR}/regression_stage1.log"

PIPE_STATUS=${PIPESTATUS[0]}

# Cleanup Real Worker and API
kill ${REAL_WORKER_PID} || true
kill ${API_PID} || true

if [ ${PIPE_STATUS} -eq 0 ]; then
  echo "[Gate] Regression PASS."
else
  echo "[Gate] Regression FAIL."
  exit 1
fi

echo "================================================================="
echo "ALL TESTS PASSED"
echo "Evidence archived in ${EVIDENCE_DIR}"
echo "================================================================="
exit 0
