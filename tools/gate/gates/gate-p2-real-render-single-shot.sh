#!/bin/bash
IFS=$'
	'
# gate-p2-real-render-single-shot.sh
# V3.0 P2-4: Real Render End-to-End Single Shot Verification

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

GATE_ID="P2-4"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="docs/_evidence/gate_${GATE_ID}_${TIMESTAMP}"
mkdir -p "${EVIDENCE_DIR}"

LOG_FILE="${EVIDENCE_DIR}/gate.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "--- [GATE ${GATE_ID}] Real Render End-to-End Verification ---"

ORG_ID="org_p2_${TIMESTAMP}"
PROJ_ID="proj_p2_${TIMESTAMP}"
EP_ID="ep_p2_${TIMESTAMP}"
SCENE_ID="scene_p2_${TIMESTAMP}"
SHOT_ID="shot_p2_${TIMESTAMP}"
JOB_ID="job_p2_${TIMESTAMP}"

# 1. Prepare Data
echo "[Step 1] Creating Scene and Shot with P1 Metadata..."

psql "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, \"createdAt\", \"updatedAt\") VALUES ('${ORG_ID}', 'Org P2', 'user-gate', 1000, NOW(), NOW()) ON CONFLICT DO NOTHING;"
psql "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"organizationId\", \"ownerId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJ_ID}', 'Proj P2', '${ORG_ID}', 'user-gate', 'in_progress', NOW(), NOW());"
psql "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ('season_${TIMESTAMP}', '${PROJ_ID}', 1, 'S1', NOW(), NOW());"
psql "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", name, index) VALUES ('${EP_ID}', 'season_${TIMESTAMP}', '${PROJ_ID}', 'Ep 1', 1);"

GRAPH_STATE='{"characters": [{"id": "char_001", "name": "Hero"}]}'
psql "${DATABASE_URL}" -c "
INSERT INTO scenes (
    id, \"episodeId\", \"projectId\", index, title, \"graph_state_snapshot\"
) VALUES (
    '${SCENE_ID}', '${EP_ID}', '${PROJ_ID}', 1, 'Scene P2', '${GRAPH_STATE}'::jsonb
);
"

# Create Shot with P1 fields + enrichedPrompt (required for real render)
shotParams='{"controlnet_settings": {"modules": []}, "asset_bindings": {"char_001": "_dynamic/char.png"}}'
psql "${DATABASE_URL}" -c "
INSERT INTO shots (
    id, \"sceneId\", index, \"reviewStatus\", type, params, \"enrichedPrompt\", \"organizationId\", \"shot_type\"
) VALUES (
    '${SHOT_ID}', '${SCENE_ID}', 1, 'APPROVED', 'shot', '${shotParams}'::jsonb, 'A futuristic warrior in armor', '${ORG_ID}', 'WIDE SHOT'
);
"

# 2. Submit Real Render Job (P2-2)
echo "[Step 2] Submitting SHOT_RENDER (Mode: Real)..."

# Ensure SHOT_RENDER maps to real adapter (default in local dev is local_mps -> real code path)
# We rely on Worker picking it up.

PAYLOAD=$(jq -n \
  --arg shotId "${SHOT_ID}" \
  --arg projectId "${PROJ_ID}" \
  --arg pipelineRunId "run_p2_${TIMESTAMP}" \
  '{
    shotId: $shotId,
    projectId: $projectId,
    pipelineRunId: $pipelineRunId
  }')

psql "${DATABASE_URL}" -c "
INSERT INTO shot_jobs (
    id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\"
) VALUES (
    '${JOB_ID}', '${ORG_ID}', '${PROJ_ID}', '${EP_ID}', '${SCENE_ID}', '${SHOT_ID}', 'SHOT_RENDER', 'PENDING', '${PAYLOAD}'::jsonb, NOW(), NOW()
);
"

echo "Job inserted: ${JOB_ID}. Waiting for completion..."

# 3. Poll for Completion
MAX_RETRIES=60
RETRY_COUNT=0
while [ "${RETRY_COUNT}" -lt "${MAX_RETRIES}" ]; do
    STATUS=$(psql "${DATABASE_URL}" -A -t -c "SELECT status FROM shot_jobs WHERE id = '${JOB_ID}';")
    if [ "${STATUS}" = "SUCCEEDED" ]; then
        echo "✅ Job Succeeded."
        break
    elif [ "${STATUS}" = "FAILED" ]; then
        echo "❌ Job Failed."
        psql "${DATABASE_URL}" -c "SELECT \"result\" FROM shot_jobs WHERE id = '${JOB_ID}';"
        exit 1
    fi
    echo "Current status: ${STATUS}... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "${RETRY_COUNT}" -eq "${MAX_RETRIES}" ]; then
    echo "❌ FAIL: Job timed out."
    exit 1
fi

# 4. Verify Shot Output (P2-2)
echo "[Step 3] Verifying Output Evidence..."

# Check Shot fields
SHOT_DATA=$(psql "${DATABASE_URL}" -A -t -c "SELECT \"render_status\", \"result_image_url\" FROM shots WHERE id = '${SHOT_ID}';")
RENDER_STATUS=$(echo "${SHOT_DATA}" | awk -F'|' '{print $1}')
IMG_URL=$(echo "${SHOT_DATA}" | awk -F'|' '{print $2}')
echo "Shot Data: ${RENDER_STATUS}|${IMG_URL}"

# P2-FIX-2: 强断言 - 禁止 undefined
if echo "${IMG_URL}" | grep -q "undefined"; then
    echo "❌ FAIL: result_image_url contains 'undefined': ${IMG_URL}"
    exit 1
fi
echo "✅ PASS: result_image_url does not contain 'undefined'."

# P2-FIX-2: 验证文件名格式 (shot_{shotId}_trace_{last8}_{seed}.png)
if ! echo "${IMG_URL}" | grep -Eq "shot_[A-Za-z0-9_-]+_trace_[A-Za-z0-9_-]{8}_[0-9]+\.png"; then
    echo "❌ FAIL: result_image_url format invalid (expected: shot_*_trace_*_*.png): ${IMG_URL}"
    exit 1
fi
echo "✅ PASS: result_image_url format matches expected pattern."

if [ "${RENDER_STATUS}" != "COMPLETED" ]; then
    echo "❌ FAIL: render_status is not COMPLETED (got: ${RENDER_STATUS})."
    exit 1
fi
echo "✅ PASS: render_status is COMPLETED."

if [ -z "${IMG_URL}" ]; then
    echo "❌ FAIL: result_image_url is empty."
    exit 1
fi
echo "✅ PASS: result_image_url = ${IMG_URL}"

# Check File Existence
# Logic: URL might already be relative path from root, or relative to .runtime
if [ -f "${IMG_URL}" ]; then
    echo "✅ PASS: File exists at ${IMG_URL}"
    FILE_PATH="${IMG_URL}"
elif [ -f ".runtime/${IMG_URL}" ]; then
    echo "✅ PASS: File exists at .runtime/${IMG_URL}"
    FILE_PATH=".runtime/${IMG_URL}"
elif [ -f "apps/workers/.runtime/${IMG_URL}" ]; then
    echo "✅ PASS: File exists at apps/workers/.runtime/${IMG_URL}"
    FILE_PATH="apps/workers/.runtime/${IMG_URL}"
else
    echo "❌ FAIL: File NOT found at:"
    echo "  - ${IMG_URL}"
    echo "  - .runtime/${IMG_URL}"
    echo "  - apps/workers/.runtime/${IMG_URL}"
    ls -R apps/workers/.runtime || true
    exit 1
fi

FILE_SIZE=$(wc -c < "${FILE_PATH}")
if [ "${FILE_SIZE}" -gt 0 ]; then
    echo "✅ PASS: File size > 0 bytes (${FILE_SIZE})"
else
    echo "❌ FAIL: File is empty."
    exit 1
fi

echo "--- [GATE ${GATE_ID}] SUCCESS ---"
