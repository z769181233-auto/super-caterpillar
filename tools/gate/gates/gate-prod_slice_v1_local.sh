#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-prod_slice_v1_local.sh# 链路: CE06 -> CE03 -> CE04 -> SHOT_RENDER -> VIDEO_RENDER -> CE09

set -e
# ------------------------------
# Hard Cost Gate (Audit Requirement)
# ------------------------------
# FAIL if token is found. Auto-clearing is forbidden by audit.
if [ -n "${REPLICATE_API_TOKEN:-}" ]; then
  echo "❌ [Hard Gate] REPLICATE_API_TOKEN is found in environment."
  echo "    For Zero-Cost local runs, environment must be CLEAN."
  echo "    Abort to prevent accidental billing."
  exit 1
fi

# 强制走本地 MPS Provider
export SHOT_RENDER_ENGINE="local_mps"
export SHOT_RENDER_PROVIDER="local_mps"

if [ "${SHOT_RENDER_PROVIDER}" != "local_mps" ]; then
  echo "❌ [Hard Gate] Provider Mismatch: expected local_mps, got ${SHOT_RENDER_PROVIDER}"
  exit 1
fi
# ------------------------------

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
RUN_TS=$(node -e EVID_DIR="${EVID_ROOT}/prod_slice_v1_local_${TS}"
mkdir -p "${EVID_DIR}"

# Audit: Redirect all output to evidence log
exec > >(tee "${EVID_DIR}/gate_stdout.log") 2>&1

echo "[Gate] RUN_TS: ${RUN_TS}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

PROJECT_ID="prod_slice_v1_local_${TS}"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE="${ROOT_DIR}/docs/_specs/novel_source_sample.txt"

echo "=============================================================================="
echo "PRODUCTION SLICE V1: REAL ENGINE EXECUTION"
echo "ProjectID: ${PROJECT_ID}"
echo "TraceID:   ${TRACE_ID}"
echo "Evidence:  ${EVID_DIR}"
echo "=============================================================================="

# Ensure Source Text
if [ ! -f "${NOVEL_SOURCE}" ]; then
  echo "Scene 1: A cyberpunk neon city. Camera pans down to a noodle shop with rain." > "${NOVEL_SOURCE}"
fi

# ==============================================================================
# 2. Helpers
# ==============================================================================
do_save_evidence() {
  local name="$1"
  local content="$2"
  echo "${content}" > "${EVID_DIR}/${name}"
}

# Robust JSON Escape helper
json_escape() {
  node -e }

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Terminal States: SUCCESS/FAILED, Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
    
    # Audit Rule: Ignore non-terminal states (PENDING, PROCESSING, etc.)
    if [ "${STATUS}" == "SUCCEEDED" ]; then
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
      echo "❌ Job ${job_id} FAILED: ${ERR}"
      # Evidence on Failure
      psql -d "${DATABASE_URL}" -x -c "SELECT * FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/failure_${job_id}.log"
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done

  # Timeout Handling
  echo "❌ [Timeout] waiting for Job ${job_id} to reach terminal state."
  psql -d "${DATABASE_URL}" -x -c "SELECT status, \"createdAt\", \"updatedAt\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/timeout_${job_id}.log"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ($gate$user-gate$gate$, $gate$gate@test.com$gate$, $gate$dummy_hash$gate$, $gate$Free$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ($gate$org-gate$gate$, $gate$Gate Org$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ($gate$mem-gate$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, $gate$OWNER$gate$, NOW(), NOW()) ON CONFLICT (\"organizationId\", \"userId\") DO NOTHING;"

# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (\$gate\$${PROJECT_ID}\$gate\$, \$gate\$Slice V1 Test\$gate\$, \$gate\$user-gate\$gate\$, \$gate\$org-gate\$gate\$, \$gate\$in_progress\$gate\$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" # $gate$

echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
# P1 Enhancement: Extreme test text containing $$ and single quotes
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: ISAFE_TEXT_JSON="$(json_escape "${REAL_TEXT}")"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for absolute SQL safety even if content contains $$
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ($gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$S1$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
# Episode
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ($gate$${EPISODE_ID}$gate$, $gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$E1$gate$) ON CONFLICT (id) DO NOTHING;"
# Scene
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES ($gate$${SCENE_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$Sc1$gate$) ON CONFLICT (id) DO NOTHING;"
# Shot
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ($gate$${SHOT_ID_DUMMY}$gate$, $gate$${SCENE_ID}$gate$, 1, $gate$DEFAULT$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
PAYLOAD="{\"projectId\": \"${PROJECT_ID}\", \"novelSourceId\": \"${NOVEL_SOURCE_ID}\", \"traceId\": \"${TRACE_ID}\", \"sourceText\": \"${SAFE_TEXT_JSON}\"}"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for payload SQL safety
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
# Start waiting in background to keep real-time spawn logs, but ensure we JOIN later.
wait_for_job_success "${PIPE_JOB_ID}" 600 &
PIPE_WAIT_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE06_NOVEL_PARSING$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE06_JOB_ID}" ]; then
    echo "✅ Detected CE06 Job: ${CE06_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE06_JOB_ID}" ]; then echo "❌ CE06 Not Spawned by Pipeline"; exit 1; fi

wait_for_job_success "${CE06_JOB_ID}" 60

# Chain: CE03
echo "[Gate] Waiting for CE03 to be spawned by Pipeline..."
ELAPSED=0
CE03_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE03_VISUAL_DENSITY$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE03_JOB_ID}" ]; then
    echo "✅ Detected CE03 Job: ${CE03_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE03_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE03 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE03_JOB_ID="job-ce03-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE03_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE03_VISUAL_DENSITY$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do # Increased wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE04_VISUAL_ENRICHMENT$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE04_JOB_ID}" ]; then
    echo "✅ Detected CE04 Job: ${CE04_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE04_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE04 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE04_JOB_ID="job-ce04-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE04_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE04_VISUAL_ENRICHMENT$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE04 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE04_JOB_ID}" 60

# Chain: SHOT_RENDER
# Finding REAL shot IDs from DB (Schema: Shot -> Scene -> Episode -> Project)
echo "[Gate] Fetching Shot ID for SHOT_RENDER..."

SHOT_ID=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT s.id
FROM shots s
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$
ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$SHOT_RENDER$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ LIMIT 1")

if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${SHOT_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$SHOT_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"prompt\": \"A cyberpunk neon city noodle shop\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}"
  wait_for_job_success "${SHOT_JOB_ID}" 60
else
  echo "[Gate] Found existing SHOT_RENDER: ${EXISTING_SHOT_RENDER}"
  wait_for_job_success "${EXISTING_SHOT_RENDER}" 60
fi

# Verify PNG Asset
SHOT_ASSET_URI=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT a.\"storageKey\" 
FROM assets a
JOIN shots s ON a.\"ownerId\" = s.id
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
# Copy Asset to Storage Root for VIDEO_RENDER (Processor expects key in .data/storage)
STORAGE_TEMP="${ROOT_DIR}/.data/storage/temp"
mkdir -p "${STORAGE_TEMP}"
# Robust copy of SHOT asset to temp (supports: file://, absolute, relative, and "bad absolute" with duplicated ROOT segments)
SHOT_ASSET_KEY_RAW="${SHOT_ASSET_URI}"
SHOT_ASSET_KEY="${SHOT_ASSET_KEY_RAW#file://}"

echo "[Gate] SHOT storageKey raw: ${SHOT_ASSET_KEY_RAW}"
echo "[Gate] SHOT storageKey norm: ${SHOT_ASSET_KEY}"

# Detect absolute path (mac/linux)
is_abs_path() {
  case "$1" in
    /*) return 0 ;;
    *)  return 1 ;;
  esac
}

# Unique appender
append_unique() {
  local v="$1"
  for e in "${CANDS[@]}"; do
    if [ "$e" = "$v" ]; then
      return 0
    fi
  done
  CANDS+=("$v")
}

CANDS=()

# C0: If absolute, try as-is
if is_abs_path "${SHOT_ASSET_KEY}"; then
  append_unique "${SHOT_ASSET_KEY}"

  # C1: Fix duplicated segment "apps/api/apps/workers" -> "apps/workers"
  if [[ "${SHOT_ASSET_KEY}" == *"/apps/api/apps/workers/.runtime/"* ]]; then
    # Use sed for robust replacement (bash ${//} gets confused by slashes)
    FIXED=$(echo "${SHOT_ASSET_KEY}" | sed     append_unique "${FIXED}"
  fi

  # C1b: If contains ROOT_DIR, normalize to ROOT_DIR + tail (guards weird prefixing)
  if [[ "${SHOT_ASSET_KEY}" == *"${ROOT_DIR}/"* ]]; then
    TAIL="${SHOT_ASSET_KEY##*${ROOT_DIR}/}"
    append_unique "${ROOT_DIR}/${TAIL}"
  fi

else
  # C2: Treat as relative key under known roots (ONLY when not absolute)
  append_unique "${ROOT_DIR}/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/apps/workers/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.data/storage/${SHOT_ASSET_KEY}"
fi

# Resolve first existing file
SHOT_FILE=""
RESOLVED_BY="NONE"
for c_info in "C0:${CANDS[0]}" "C1:${CANDS[1]}" "C1b:${CANDS[2]}" "C2:${CANDS[3]}" "C2b:${CANDS[4]}" "C2c:${CANDS[5]}"; do
  c="${c_info#*:}"
  tag="${c_info%%:*}"
  [ -z "${c}" ] && continue
  if [ -f "${c}" ]; then
    SHOT_FILE="${c}"
    RESOLVED_BY="${tag}"
    break
  fi
done

# Evidence: dump candidates for audit
{
  echo "SHOT_ASSET_URI=${SHOT_ASSET_URI}"
  echo "SHOT_ASSET_KEY=${SHOT_ASSET_KEY}"
  echo "ROOT_DIR=${ROOT_DIR}"
  echo "RESOLVED_BY=${RESOLVED_BY}"
  echo "CANDIDATES:"
  for c in "${CANDS[@]}"; do
    echo " - ${c} $( [ -f "${c}" ] && echo   done
  echo "RESOLVED=${SHOT_FILE}"
} > "${EVID_DIR}/shot_asset_path_resolution.txt"

if [ -z "${SHOT_FILE}" ]; then
  echo "❌ Shot image file not found for storageKey=${SHOT_ASSET_URI}"
  echo "See: ${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi

echo "[Gate] Resolved SHOT file: ${SHOT_FILE}"
cp "${SHOT_FILE}" "${STORAGE_TEMP}/prod_slice_input.png"
FRAME_KEY="temp/prod_slice_input.png"

psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${VIDEO_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$VIDEO_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"frameKeys\": [\"${FRAME_KEY}\"], \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"video_render\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=$gate$${VIDEO_JOB_ID}$gate$ LIMIT 1")
if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}"
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path (.data/storage)
    VIDEO_PATH="${ROOT_DIR}/.data/storage/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then
        # Try root
        VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
        if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
    fi
fi

# --- Normalize Video Asset to StorageKey Location (SSOT) ---
VIDEO_STORAGE_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
if [ -z "${VIDEO_STORAGE_KEY}" ]; then
  echo "❌ VIDEO storageKey missing for asset=${VIDEO_ASSET_ID}"
  exit 1
fi

# Strip file:// prefix (keep relative key)
REL_KEY="${VIDEO_STORAGE_KEY#file://}"

# Decide storage root (align with your StorageProvider contract)
# CE09 locally resolves keys relative to apps/workers/.runtime
DEST_PATH="${ROOT_DIR}/apps/workers/.runtime/${REL_KEY}"
DEST_DIR="$(dirname "${DEST_PATH}")"
mkdir -p "${DEST_DIR}"

# Copy the actual produced mp4 to the exact storageKey location (if different)
if [ "${VIDEO_PATH}" != "${DEST_PATH}" ]; then
  cp "${VIDEO_PATH}" "${DEST_PATH}"
fi

echo "[Gate] Synced VIDEO to storageKey path:"
echo "       storageKey=${VIDEO_STORAGE_KEY}"
echo "       dest=${DEST_PATH}"

# Optional: sanity check
if [ ! -f "${DEST_PATH}" ]; then
  echo "❌ Sync failed: ${DEST_PATH} not found"
  exit 1
fi

echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE09_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$CE09_MEDIA_SECURITY$gate$, $gate$PENDING$gate$, $gate${\"assetId\": \"${VIDEO_ASSET_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"pipelineRunId\": \"${TRACE_ID}\", \"engineKey\": \"ce09_real_watermark\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}"
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
# ------------------------------------------------------------------------------
# JOIN: ensure pipeline wait finished (Audit: capture return code)
# ------------------------------------------------------------------------------
echo "[Gate] Joining pipeline wait pid=${PIPE_WAIT_PID} ..."
if ! wait "${PIPE_WAIT_PID}"; then
  echo "❌ Background Pipeline process FAILED."
  exit 1
fi
echo "[Gate] Pipeline wait joined (SUCCESS)."

# ==============================================================================
# 4. P1 Debt Enforcement (Zero Absolute Path for NEW assets)
# ==============================================================================
echo "[Gate] Performing P1 StorageKey Enforcement..."

# Check 1: Resolved By C1 (Regession check)
# C1 is the # We check if the RESOLVED_BY=C1 entry exists and belongs to a new asset (by proximity in the log or asset name)
if grep -q "RESOLVED_BY=C1" "${EVID_DIR}/shot_asset_path_resolution.txt"; then
  # P1 Enhancement: Strict reject if it matches a NEWLY generated asset
  # In this gate, the SHOT_ID is unique per run, so any C1 match is a regression.
  echo "❌ [P1 Fail] New asset triggered C1 (Correction Path). Expected C0 (Direct Relative)."
  echo "    Detailed Resolution Evidence:"
  cat "${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi
echo "✅ [P1 Pass] RESOLVED_BY tag is clean (not C1)."

# Check 2: DB Absolute Path Check for this RUN
BAD_KEYS=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT count(*) 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$
  AND (\"storageKey\" LIKE 
if [ "${BAD_KEYS}" -gt 0 ]; then
  echo "❌ [P1 Fail] Detected ${BAD_KEYS} absolute storageKeys for this project."
  psql -d "${DATABASE_URL}" -c "SELECT id, \"storageKey\" FROM assets WHERE \"projectId\"=$gate$${PROJECT_ID}$gate$ AND (\"storageKey\" LIKE $gate$/%$gate$ OR \"storageKey\" LIKE $gate$file://%$gate$)"
  exit 1
fi
# Check 3: Allowed Prefix Assertion (Strict P1)
# Ensures key is relative AND within allowed storage areas.
readonly ALLOWED_PREFIXES=("apps/workers/.runtime/" ".runtime/" ".data/storage/" "secure/")
echo "[Gate] P1 SSOT Prefix Whitelist: ${ALLOWED_PREFIXES[*]}"
ILLEGAL_PREFIXES=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT \"storageKey\" 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$")

while read -r KEY; do
  [ -z "${KEY}" ] && continue
  MATCHED=0
  for PF in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "${KEY}" == "${PF}"* ]]; then
      MATCHED=1
      break
    fi
  done
  if [ "${MATCHED}" -eq 0 ]; then
    echo "❌ [P1 Fail] Asset storageKey leaks or has illegal prefix: ${KEY}"
    echo "    Allowed Prefixes: ${ALLOWED_PREFIXES[*]}"
    exit 1
  fi
done <<< "${ILLEGAL_PREFIXES}"
echo "✅ [P1 Pass] All database storageKeys for this project match allowed prefixes."

echo "✅ ALL STEPS PASSED (Platinum Standard + P1 Hard Gate)."
exit 0

set -e
# ------------------------------
# Hard Cost Gate (Audit Requirement)
# ------------------------------
# FAIL if token is found. Auto-clearing is forbidden by audit.
if [ -n "${REPLICATE_API_TOKEN:-}" ]; then
  echo "❌ [Hard Gate] REPLICATE_API_TOKEN is found in environment."
  echo "    For Zero-Cost local runs, environment must be CLEAN."
  echo "    Abort to prevent accidental billing."
  exit 1
fi

# 强制走本地 MPS Provider
export SHOT_RENDER_ENGINE="local_mps"
export SHOT_RENDER_PROVIDER="local_mps"

if [ "${SHOT_RENDER_PROVIDER}" != "local_mps" ]; then
  echo "❌ [Hard Gate] Provider Mismatch: expected local_mps, got ${SHOT_RENDER_PROVIDER}"
  exit 1
fi
# ------------------------------

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
RUN_TS=$(node -e EVID_DIR="${EVID_ROOT}/prod_slice_v1_local_${TS}"
mkdir -p "${EVID_DIR}"

# Audit: Redirect all output to evidence log
exec > >(tee "${EVID_DIR}/gate_stdout.log") 2>&1

echo "[Gate] RUN_TS: ${RUN_TS}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

PROJECT_ID="prod_slice_v1_local_${TS}"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE="${ROOT_DIR}/docs/_specs/novel_source_sample.txt"

echo "=============================================================================="
echo "PRODUCTION SLICE V1: REAL ENGINE EXECUTION"
echo "ProjectID: ${PROJECT_ID}"
echo "TraceID:   ${TRACE_ID}"
echo "Evidence:  ${EVID_DIR}"
echo "=============================================================================="

# Ensure Source Text
if [ ! -f "${NOVEL_SOURCE}" ]; then
  echo "Scene 1: A cyberpunk neon city. Camera pans down to a noodle shop with rain." > "${NOVEL_SOURCE}"
fi

# ==============================================================================
# 2. Helpers
# ==============================================================================
do_save_evidence() {
  local name="$1"
  local content="$2"
  echo "${content}" > "${EVID_DIR}/${name}"
}

# Robust JSON Escape helper
json_escape() {
  node -e }

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Terminal States: SUCCESS/FAILED, Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
    
    # Audit Rule: Ignore non-terminal states (PENDING, PROCESSING, etc.)
    if [ "${STATUS}" == "SUCCEEDED" ]; then
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
      echo "❌ Job ${job_id} FAILED: ${ERR}"
      # Evidence on Failure
      psql -d "${DATABASE_URL}" -x -c "SELECT * FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/failure_${job_id}.log"
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done

  # Timeout Handling
  echo "❌ [Timeout] waiting for Job ${job_id} to reach terminal state."
  psql -d "${DATABASE_URL}" -x -c "SELECT status, \"createdAt\", \"updatedAt\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/timeout_${job_id}.log"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ($gate$user-gate$gate$, $gate$gate@test.com$gate$, $gate$dummy_hash$gate$, $gate$Free$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ($gate$org-gate$gate$, $gate$Gate Org$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ($gate$mem-gate$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, $gate$OWNER$gate$, NOW(), NOW()) ON CONFLICT (\"organizationId\", \"userId\") DO NOTHING;"

# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (\$gate\$${PROJECT_ID}\$gate\$, \$gate\$Slice V1 Test\$gate\$, \$gate\$user-gate\$gate\$, \$gate\$org-gate\$gate\$, \$gate\$in_progress\$gate\$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" # $gate$

echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
# P1 Enhancement: Extreme test text containing $$ and single quotes
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: ISAFE_TEXT_JSON="$(json_escape "${REAL_TEXT}")"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for absolute SQL safety even if content contains $$
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ($gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$S1$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
# Episode
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ($gate$${EPISODE_ID}$gate$, $gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$E1$gate$) ON CONFLICT (id) DO NOTHING;"
# Scene
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES ($gate$${SCENE_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$Sc1$gate$) ON CONFLICT (id) DO NOTHING;"
# Shot
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ($gate$${SHOT_ID_DUMMY}$gate$, $gate$${SCENE_ID}$gate$, 1, $gate$DEFAULT$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
PAYLOAD="{\"projectId\": \"${PROJECT_ID}\", \"novelSourceId\": \"${NOVEL_SOURCE_ID}\", \"traceId\": \"${TRACE_ID}\", \"sourceText\": \"${SAFE_TEXT_JSON}\"}"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for payload SQL safety
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
# Start waiting in background to keep real-time spawn logs, but ensure we JOIN later.
wait_for_job_success "${PIPE_JOB_ID}" 600 &
PIPE_WAIT_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE06_NOVEL_PARSING$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE06_JOB_ID}" ]; then
    echo "✅ Detected CE06 Job: ${CE06_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE06_JOB_ID}" ]; then echo "❌ CE06 Not Spawned by Pipeline"; exit 1; fi

wait_for_job_success "${CE06_JOB_ID}" 60

# Chain: CE03
echo "[Gate] Waiting for CE03 to be spawned by Pipeline..."
ELAPSED=0
CE03_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE03_VISUAL_DENSITY$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE03_JOB_ID}" ]; then
    echo "✅ Detected CE03 Job: ${CE03_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE03_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE03 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE03_JOB_ID="job-ce03-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE03_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE03_VISUAL_DENSITY$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do # Increased wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE04_VISUAL_ENRICHMENT$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE04_JOB_ID}" ]; then
    echo "✅ Detected CE04 Job: ${CE04_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE04_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE04 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE04_JOB_ID="job-ce04-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE04_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE04_VISUAL_ENRICHMENT$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE04 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE04_JOB_ID}" 60

# Chain: SHOT_RENDER
# Finding REAL shot IDs from DB (Schema: Shot -> Scene -> Episode -> Project)
echo "[Gate] Fetching Shot ID for SHOT_RENDER..."

SHOT_ID=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT s.id
FROM shots s
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$
ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$SHOT_RENDER$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ LIMIT 1")

if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${SHOT_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$SHOT_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"prompt\": \"A cyberpunk neon city noodle shop\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}"
  wait_for_job_success "${SHOT_JOB_ID}" 60
else
  echo "[Gate] Found existing SHOT_RENDER: ${EXISTING_SHOT_RENDER}"
  wait_for_job_success "${EXISTING_SHOT_RENDER}" 60
fi

# Verify PNG Asset
SHOT_ASSET_URI=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT a.\"storageKey\" 
FROM assets a
JOIN shots s ON a.\"ownerId\" = s.id
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
# Copy Asset to Storage Root for VIDEO_RENDER (Processor expects key in .data/storage)
STORAGE_TEMP="${ROOT_DIR}/.data/storage/temp"
mkdir -p "${STORAGE_TEMP}"
# Robust copy of SHOT asset to temp (supports: file://, absolute, relative, and "bad absolute" with duplicated ROOT segments)
SHOT_ASSET_KEY_RAW="${SHOT_ASSET_URI}"
SHOT_ASSET_KEY="${SHOT_ASSET_KEY_RAW#file://}"

echo "[Gate] SHOT storageKey raw: ${SHOT_ASSET_KEY_RAW}"
echo "[Gate] SHOT storageKey norm: ${SHOT_ASSET_KEY}"

# Detect absolute path (mac/linux)
is_abs_path() {
  case "$1" in
    /*) return 0 ;;
    *)  return 1 ;;
  esac
}

# Unique appender
append_unique() {
  local v="$1"
  for e in "${CANDS[@]}"; do
    if [ "$e" = "$v" ]; then
      return 0
    fi
  done
  CANDS+=("$v")
}

CANDS=()

# C0: If absolute, try as-is
if is_abs_path "${SHOT_ASSET_KEY}"; then
  append_unique "${SHOT_ASSET_KEY}"

  # C1: Fix duplicated segment "apps/api/apps/workers" -> "apps/workers"
  if [[ "${SHOT_ASSET_KEY}" == *"/apps/api/apps/workers/.runtime/"* ]]; then
    # Use sed for robust replacement (bash ${//} gets confused by slashes)
    FIXED=$(echo "${SHOT_ASSET_KEY}" | sed     append_unique "${FIXED}"
  fi

  # C1b: If contains ROOT_DIR, normalize to ROOT_DIR + tail (guards weird prefixing)
  if [[ "${SHOT_ASSET_KEY}" == *"${ROOT_DIR}/"* ]]; then
    TAIL="${SHOT_ASSET_KEY##*${ROOT_DIR}/}"
    append_unique "${ROOT_DIR}/${TAIL}"
  fi

else
  # C2: Treat as relative key under known roots (ONLY when not absolute)
  append_unique "${ROOT_DIR}/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/apps/workers/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.data/storage/${SHOT_ASSET_KEY}"
fi

# Resolve first existing file
SHOT_FILE=""
RESOLVED_BY="NONE"
for c_info in "C0:${CANDS[0]}" "C1:${CANDS[1]}" "C1b:${CANDS[2]}" "C2:${CANDS[3]}" "C2b:${CANDS[4]}" "C2c:${CANDS[5]}"; do
  c="${c_info#*:}"
  tag="${c_info%%:*}"
  [ -z "${c}" ] && continue
  if [ -f "${c}" ]; then
    SHOT_FILE="${c}"
    RESOLVED_BY="${tag}"
    break
  fi
done

# Evidence: dump candidates for audit
{
  echo "SHOT_ASSET_URI=${SHOT_ASSET_URI}"
  echo "SHOT_ASSET_KEY=${SHOT_ASSET_KEY}"
  echo "ROOT_DIR=${ROOT_DIR}"
  echo "RESOLVED_BY=${RESOLVED_BY}"
  echo "CANDIDATES:"
  for c in "${CANDS[@]}"; do
    echo " - ${c} $( [ -f "${c}" ] && echo   done
  echo "RESOLVED=${SHOT_FILE}"
} > "${EVID_DIR}/shot_asset_path_resolution.txt"

if [ -z "${SHOT_FILE}" ]; then
  echo "❌ Shot image file not found for storageKey=${SHOT_ASSET_URI}"
  echo "See: ${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi

echo "[Gate] Resolved SHOT file: ${SHOT_FILE}"
cp "${SHOT_FILE}" "${STORAGE_TEMP}/prod_slice_input.png"
FRAME_KEY="temp/prod_slice_input.png"

psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${VIDEO_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$VIDEO_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"frameKeys\": [\"${FRAME_KEY}\"], \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"video_render\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=$gate$${VIDEO_JOB_ID}$gate$ LIMIT 1")
if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}"
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path (.data/storage)
    VIDEO_PATH="${ROOT_DIR}/.data/storage/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then
        # Try root
        VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
        if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
    fi
fi

# --- Normalize Video Asset to StorageKey Location (SSOT) ---
VIDEO_STORAGE_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
if [ -z "${VIDEO_STORAGE_KEY}" ]; then
  echo "❌ VIDEO storageKey missing for asset=${VIDEO_ASSET_ID}"
  exit 1
fi

# Strip file:// prefix (keep relative key)
REL_KEY="${VIDEO_STORAGE_KEY#file://}"

# Decide storage root (align with your StorageProvider contract)
# CE09 locally resolves keys relative to apps/workers/.runtime
DEST_PATH="${ROOT_DIR}/apps/workers/.runtime/${REL_KEY}"
DEST_DIR="$(dirname "${DEST_PATH}")"
mkdir -p "${DEST_DIR}"

# Copy the actual produced mp4 to the exact storageKey location (if different)
if [ "${VIDEO_PATH}" != "${DEST_PATH}" ]; then
  cp "${VIDEO_PATH}" "${DEST_PATH}"
fi

echo "[Gate] Synced VIDEO to storageKey path:"
echo "       storageKey=${VIDEO_STORAGE_KEY}"
echo "       dest=${DEST_PATH}"

# Optional: sanity check
if [ ! -f "${DEST_PATH}" ]; then
  echo "❌ Sync failed: ${DEST_PATH} not found"
  exit 1
fi

echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE09_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$CE09_MEDIA_SECURITY$gate$, $gate$PENDING$gate$, $gate${\"assetId\": \"${VIDEO_ASSET_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"pipelineRunId\": \"${TRACE_ID}\", \"engineKey\": \"ce09_real_watermark\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}"
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
# ------------------------------------------------------------------------------
# JOIN: ensure pipeline wait finished (Audit: capture return code)
# ------------------------------------------------------------------------------
echo "[Gate] Joining pipeline wait pid=${PIPE_WAIT_PID} ..."
if ! wait "${PIPE_WAIT_PID}"; then
  echo "❌ Background Pipeline process FAILED."
  exit 1
fi
echo "[Gate] Pipeline wait joined (SUCCESS)."

# ==============================================================================
# 4. P1 Debt Enforcement (Zero Absolute Path for NEW assets)
# ==============================================================================
echo "[Gate] Performing P1 StorageKey Enforcement..."

# Check 1: Resolved By C1 (Regession check)
# C1 is the # We check if the RESOLVED_BY=C1 entry exists and belongs to a new asset (by proximity in the log or asset name)
if grep -q "RESOLVED_BY=C1" "${EVID_DIR}/shot_asset_path_resolution.txt"; then
  # P1 Enhancement: Strict reject if it matches a NEWLY generated asset
  # In this gate, the SHOT_ID is unique per run, so any C1 match is a regression.
  echo "❌ [P1 Fail] New asset triggered C1 (Correction Path). Expected C0 (Direct Relative)."
  echo "    Detailed Resolution Evidence:"
  cat "${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi
echo "✅ [P1 Pass] RESOLVED_BY tag is clean (not C1)."

# Check 2: DB Absolute Path Check for this RUN
BAD_KEYS=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT count(*) 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$
  AND (\"storageKey\" LIKE 
if [ "${BAD_KEYS}" -gt 0 ]; then
  echo "❌ [P1 Fail] Detected ${BAD_KEYS} absolute storageKeys for this project."
  psql -d "${DATABASE_URL}" -c "SELECT id, \"storageKey\" FROM assets WHERE \"projectId\"=$gate$${PROJECT_ID}$gate$ AND (\"storageKey\" LIKE $gate$/%$gate$ OR \"storageKey\" LIKE $gate$file://%$gate$)"
  exit 1
fi
# Check 3: Allowed Prefix Assertion (Strict P1)
# Ensures key is relative AND within allowed storage areas.
readonly ALLOWED_PREFIXES=("apps/workers/.runtime/" ".runtime/" ".data/storage/" "secure/")
echo "[Gate] P1 SSOT Prefix Whitelist: ${ALLOWED_PREFIXES[*]}"
ILLEGAL_PREFIXES=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT \"storageKey\" 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$")

while read -r KEY; do
  [ -z "${KEY}" ] && continue
  MATCHED=0
  for PF in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "${KEY}" == "${PF}"* ]]; then
      MATCHED=1
      break
    fi
  done
  if [ "${MATCHED}" -eq 0 ]; then
    echo "❌ [P1 Fail] Asset storageKey leaks or has illegal prefix: ${KEY}"
    echo "    Allowed Prefixes: ${ALLOWED_PREFIXES[*]}"
    exit 1
  fi
done <<< "${ILLEGAL_PREFIXES}"
echo "✅ [P1 Pass] All database storageKeys for this project match allowed prefixes."

echo "✅ ALL STEPS PASSED (Platinum Standard + P1 Hard Gate)."
exit 0

set -e
# ------------------------------
# Hard Cost Gate (Audit Requirement)
# ------------------------------
# FAIL if token is found. Auto-clearing is forbidden by audit.
if [ -n "${REPLICATE_API_TOKEN:-}" ]; then
  echo "❌ [Hard Gate] REPLICATE_API_TOKEN is found in environment."
  echo "    For Zero-Cost local runs, environment must be CLEAN."
  echo "    Abort to prevent accidental billing."
  exit 1
fi

# 强制走本地 MPS Provider
export SHOT_RENDER_ENGINE="local_mps"
export SHOT_RENDER_PROVIDER="local_mps"

if [ "${SHOT_RENDER_PROVIDER}" != "local_mps" ]; then
  echo "❌ [Hard Gate] Provider Mismatch: expected local_mps, got ${SHOT_RENDER_PROVIDER}"
  exit 1
fi
# ------------------------------

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
RUN_TS=$(node -e EVID_DIR="${EVID_ROOT}/prod_slice_v1_local_${TS}"
mkdir -p "${EVID_DIR}"

# Audit: Redirect all output to evidence log
exec > >(tee "${EVID_DIR}/gate_stdout.log") 2>&1

echo "[Gate] RUN_TS: ${RUN_TS}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

PROJECT_ID="prod_slice_v1_local_${TS}"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE="${ROOT_DIR}/docs/_specs/novel_source_sample.txt"

echo "=============================================================================="
echo "PRODUCTION SLICE V1: REAL ENGINE EXECUTION"
echo "ProjectID: ${PROJECT_ID}"
echo "TraceID:   ${TRACE_ID}"
echo "Evidence:  ${EVID_DIR}"
echo "=============================================================================="

# Ensure Source Text
if [ ! -f "${NOVEL_SOURCE}" ]; then
  echo "Scene 1: A cyberpunk neon city. Camera pans down to a noodle shop with rain." > "${NOVEL_SOURCE}"
fi

# ==============================================================================
# 2. Helpers
# ==============================================================================
do_save_evidence() {
  local name="$1"
  local content="$2"
  echo "${content}" > "${EVID_DIR}/${name}"
}

# Robust JSON Escape helper
json_escape() {
  node -e }

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Terminal States: SUCCESS/FAILED, Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
    
    # Audit Rule: Ignore non-terminal states (PENDING, PROCESSING, etc.)
    if [ "${STATUS}" == "SUCCEEDED" ]; then
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
      echo "❌ Job ${job_id} FAILED: ${ERR}"
      # Evidence on Failure
      psql -d "${DATABASE_URL}" -x -c "SELECT * FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/failure_${job_id}.log"
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done

  # Timeout Handling
  echo "❌ [Timeout] waiting for Job ${job_id} to reach terminal state."
  psql -d "${DATABASE_URL}" -x -c "SELECT status, \"createdAt\", \"updatedAt\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/timeout_${job_id}.log"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ($gate$user-gate$gate$, $gate$gate@test.com$gate$, $gate$dummy_hash$gate$, $gate$Free$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ($gate$org-gate$gate$, $gate$Gate Org$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ($gate$mem-gate$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, $gate$OWNER$gate$, NOW(), NOW()) ON CONFLICT (\"organizationId\", \"userId\") DO NOTHING;"

# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (\$gate\$${PROJECT_ID}\$gate\$, \$gate\$Slice V1 Test\$gate\$, \$gate\$user-gate\$gate\$, \$gate\$org-gate\$gate\$, \$gate\$in_progress\$gate\$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" # $gate$

echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
# P1 Enhancement: Extreme test text containing $$ and single quotes
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: ISAFE_TEXT_JSON="$(json_escape "${REAL_TEXT}")"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for absolute SQL safety even if content contains $$
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ($gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$S1$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
# Episode
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ($gate$${EPISODE_ID}$gate$, $gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$E1$gate$) ON CONFLICT (id) DO NOTHING;"
# Scene
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES ($gate$${SCENE_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$Sc1$gate$) ON CONFLICT (id) DO NOTHING;"
# Shot
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ($gate$${SHOT_ID_DUMMY}$gate$, $gate$${SCENE_ID}$gate$, 1, $gate$DEFAULT$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
PAYLOAD="{\"projectId\": \"${PROJECT_ID}\", \"novelSourceId\": \"${NOVEL_SOURCE_ID}\", \"traceId\": \"${TRACE_ID}\", \"sourceText\": \"${SAFE_TEXT_JSON}\"}"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for payload SQL safety
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
# Start waiting in background to keep real-time spawn logs, but ensure we JOIN later.
wait_for_job_success "${PIPE_JOB_ID}" 600 &
PIPE_WAIT_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE06_NOVEL_PARSING$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE06_JOB_ID}" ]; then
    echo "✅ Detected CE06 Job: ${CE06_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE06_JOB_ID}" ]; then echo "❌ CE06 Not Spawned by Pipeline"; exit 1; fi

wait_for_job_success "${CE06_JOB_ID}" 60

# Chain: CE03
echo "[Gate] Waiting for CE03 to be spawned by Pipeline..."
ELAPSED=0
CE03_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE03_VISUAL_DENSITY$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE03_JOB_ID}" ]; then
    echo "✅ Detected CE03 Job: ${CE03_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE03_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE03 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE03_JOB_ID="job-ce03-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE03_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE03_VISUAL_DENSITY$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do # Increased wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE04_VISUAL_ENRICHMENT$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE04_JOB_ID}" ]; then
    echo "✅ Detected CE04 Job: ${CE04_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE04_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE04 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE04_JOB_ID="job-ce04-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE04_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE04_VISUAL_ENRICHMENT$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE04 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE04_JOB_ID}" 60

# Chain: SHOT_RENDER
# Finding REAL shot IDs from DB (Schema: Shot -> Scene -> Episode -> Project)
echo "[Gate] Fetching Shot ID for SHOT_RENDER..."

SHOT_ID=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT s.id
FROM shots s
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$
ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$SHOT_RENDER$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ LIMIT 1")

if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${SHOT_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$SHOT_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"prompt\": \"A cyberpunk neon city noodle shop\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}"
  wait_for_job_success "${SHOT_JOB_ID}" 60
else
  echo "[Gate] Found existing SHOT_RENDER: ${EXISTING_SHOT_RENDER}"
  wait_for_job_success "${EXISTING_SHOT_RENDER}" 60
fi

# Verify PNG Asset
SHOT_ASSET_URI=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT a.\"storageKey\" 
FROM assets a
JOIN shots s ON a.\"ownerId\" = s.id
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
# Copy Asset to Storage Root for VIDEO_RENDER (Processor expects key in .data/storage)
STORAGE_TEMP="${ROOT_DIR}/.data/storage/temp"
mkdir -p "${STORAGE_TEMP}"
# Robust copy of SHOT asset to temp (supports: file://, absolute, relative, and "bad absolute" with duplicated ROOT segments)
SHOT_ASSET_KEY_RAW="${SHOT_ASSET_URI}"
SHOT_ASSET_KEY="${SHOT_ASSET_KEY_RAW#file://}"

echo "[Gate] SHOT storageKey raw: ${SHOT_ASSET_KEY_RAW}"
echo "[Gate] SHOT storageKey norm: ${SHOT_ASSET_KEY}"

# Detect absolute path (mac/linux)
is_abs_path() {
  case "$1" in
    /*) return 0 ;;
    *)  return 1 ;;
  esac
}

# Unique appender
append_unique() {
  local v="$1"
  for e in "${CANDS[@]}"; do
    if [ "$e" = "$v" ]; then
      return 0
    fi
  done
  CANDS+=("$v")
}

CANDS=()

# C0: If absolute, try as-is
if is_abs_path "${SHOT_ASSET_KEY}"; then
  append_unique "${SHOT_ASSET_KEY}"

  # C1: Fix duplicated segment "apps/api/apps/workers" -> "apps/workers"
  if [[ "${SHOT_ASSET_KEY}" == *"/apps/api/apps/workers/.runtime/"* ]]; then
    # Use sed for robust replacement (bash ${//} gets confused by slashes)
    FIXED=$(echo "${SHOT_ASSET_KEY}" | sed     append_unique "${FIXED}"
  fi

  # C1b: If contains ROOT_DIR, normalize to ROOT_DIR + tail (guards weird prefixing)
  if [[ "${SHOT_ASSET_KEY}" == *"${ROOT_DIR}/"* ]]; then
    TAIL="${SHOT_ASSET_KEY##*${ROOT_DIR}/}"
    append_unique "${ROOT_DIR}/${TAIL}"
  fi

else
  # C2: Treat as relative key under known roots (ONLY when not absolute)
  append_unique "${ROOT_DIR}/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/apps/workers/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.data/storage/${SHOT_ASSET_KEY}"
fi

# Resolve first existing file
SHOT_FILE=""
RESOLVED_BY="NONE"
for c_info in "C0:${CANDS[0]}" "C1:${CANDS[1]}" "C1b:${CANDS[2]}" "C2:${CANDS[3]}" "C2b:${CANDS[4]}" "C2c:${CANDS[5]}"; do
  c="${c_info#*:}"
  tag="${c_info%%:*}"
  [ -z "${c}" ] && continue
  if [ -f "${c}" ]; then
    SHOT_FILE="${c}"
    RESOLVED_BY="${tag}"
    break
  fi
done

# Evidence: dump candidates for audit
{
  echo "SHOT_ASSET_URI=${SHOT_ASSET_URI}"
  echo "SHOT_ASSET_KEY=${SHOT_ASSET_KEY}"
  echo "ROOT_DIR=${ROOT_DIR}"
  echo "RESOLVED_BY=${RESOLVED_BY}"
  echo "CANDIDATES:"
  for c in "${CANDS[@]}"; do
    echo " - ${c} $( [ -f "${c}" ] && echo   done
  echo "RESOLVED=${SHOT_FILE}"
} > "${EVID_DIR}/shot_asset_path_resolution.txt"

if [ -z "${SHOT_FILE}" ]; then
  echo "❌ Shot image file not found for storageKey=${SHOT_ASSET_URI}"
  echo "See: ${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi

echo "[Gate] Resolved SHOT file: ${SHOT_FILE}"
cp "${SHOT_FILE}" "${STORAGE_TEMP}/prod_slice_input.png"
FRAME_KEY="temp/prod_slice_input.png"

psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${VIDEO_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$VIDEO_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"frameKeys\": [\"${FRAME_KEY}\"], \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"video_render\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=$gate$${VIDEO_JOB_ID}$gate$ LIMIT 1")
if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}"
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path (.data/storage)
    VIDEO_PATH="${ROOT_DIR}/.data/storage/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then
        # Try root
        VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
        if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
    fi
fi

# --- Normalize Video Asset to StorageKey Location (SSOT) ---
VIDEO_STORAGE_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
if [ -z "${VIDEO_STORAGE_KEY}" ]; then
  echo "❌ VIDEO storageKey missing for asset=${VIDEO_ASSET_ID}"
  exit 1
fi

# Strip file:// prefix (keep relative key)
REL_KEY="${VIDEO_STORAGE_KEY#file://}"

# Decide storage root (align with your StorageProvider contract)
# CE09 locally resolves keys relative to apps/workers/.runtime
DEST_PATH="${ROOT_DIR}/apps/workers/.runtime/${REL_KEY}"
DEST_DIR="$(dirname "${DEST_PATH}")"
mkdir -p "${DEST_DIR}"

# Copy the actual produced mp4 to the exact storageKey location (if different)
if [ "${VIDEO_PATH}" != "${DEST_PATH}" ]; then
  cp "${VIDEO_PATH}" "${DEST_PATH}"
fi

echo "[Gate] Synced VIDEO to storageKey path:"
echo "       storageKey=${VIDEO_STORAGE_KEY}"
echo "       dest=${DEST_PATH}"

# Optional: sanity check
if [ ! -f "${DEST_PATH}" ]; then
  echo "❌ Sync failed: ${DEST_PATH} not found"
  exit 1
fi

echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE09_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$CE09_MEDIA_SECURITY$gate$, $gate$PENDING$gate$, $gate${\"assetId\": \"${VIDEO_ASSET_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"pipelineRunId\": \"${TRACE_ID}\", \"engineKey\": \"ce09_real_watermark\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}"
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
# ------------------------------------------------------------------------------
# JOIN: ensure pipeline wait finished (Audit: capture return code)
# ------------------------------------------------------------------------------
echo "[Gate] Joining pipeline wait pid=${PIPE_WAIT_PID} ..."
if ! wait "${PIPE_WAIT_PID}"; then
  echo "❌ Background Pipeline process FAILED."
  exit 1
fi
echo "[Gate] Pipeline wait joined (SUCCESS)."

# ==============================================================================
# 4. P1 Debt Enforcement (Zero Absolute Path for NEW assets)
# ==============================================================================
echo "[Gate] Performing P1 StorageKey Enforcement..."

# Check 1: Resolved By C1 (Regession check)
# C1 is the # We check if the RESOLVED_BY=C1 entry exists and belongs to a new asset (by proximity in the log or asset name)
if grep -q "RESOLVED_BY=C1" "${EVID_DIR}/shot_asset_path_resolution.txt"; then
  # P1 Enhancement: Strict reject if it matches a NEWLY generated asset
  # In this gate, the SHOT_ID is unique per run, so any C1 match is a regression.
  echo "❌ [P1 Fail] New asset triggered C1 (Correction Path). Expected C0 (Direct Relative)."
  echo "    Detailed Resolution Evidence:"
  cat "${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi
echo "✅ [P1 Pass] RESOLVED_BY tag is clean (not C1)."

# Check 2: DB Absolute Path Check for this RUN
BAD_KEYS=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT count(*) 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$
  AND (\"storageKey\" LIKE 
if [ "${BAD_KEYS}" -gt 0 ]; then
  echo "❌ [P1 Fail] Detected ${BAD_KEYS} absolute storageKeys for this project."
  psql -d "${DATABASE_URL}" -c "SELECT id, \"storageKey\" FROM assets WHERE \"projectId\"=$gate$${PROJECT_ID}$gate$ AND (\"storageKey\" LIKE $gate$/%$gate$ OR \"storageKey\" LIKE $gate$file://%$gate$)"
  exit 1
fi
# Check 3: Allowed Prefix Assertion (Strict P1)
# Ensures key is relative AND within allowed storage areas.
readonly ALLOWED_PREFIXES=("apps/workers/.runtime/" ".runtime/" ".data/storage/" "secure/")
echo "[Gate] P1 SSOT Prefix Whitelist: ${ALLOWED_PREFIXES[*]}"
ILLEGAL_PREFIXES=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT \"storageKey\" 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$")

while read -r KEY; do
  [ -z "${KEY}" ] && continue
  MATCHED=0
  for PF in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "${KEY}" == "${PF}"* ]]; then
      MATCHED=1
      break
    fi
  done
  if [ "${MATCHED}" -eq 0 ]; then
    echo "❌ [P1 Fail] Asset storageKey leaks or has illegal prefix: ${KEY}"
    echo "    Allowed Prefixes: ${ALLOWED_PREFIXES[*]}"
    exit 1
  fi
done <<< "${ILLEGAL_PREFIXES}"
echo "✅ [P1 Pass] All database storageKeys for this project match allowed prefixes."

echo "✅ ALL STEPS PASSED (Platinum Standard + P1 Hard Gate)."
exit 0

set -e
# ------------------------------
# Hard Cost Gate (Audit Requirement)
# ------------------------------
# FAIL if token is found. Auto-clearing is forbidden by audit.
if [ -n "${REPLICATE_API_TOKEN:-}" ]; then
  echo "❌ [Hard Gate] REPLICATE_API_TOKEN is found in environment."
  echo "    For Zero-Cost local runs, environment must be CLEAN."
  echo "    Abort to prevent accidental billing."
  exit 1
fi

# 强制走本地 MPS Provider
export SHOT_RENDER_ENGINE="local_mps"
export SHOT_RENDER_PROVIDER="local_mps"

if [ "${SHOT_RENDER_PROVIDER}" != "local_mps" ]; then
  echo "❌ [Hard Gate] Provider Mismatch: expected local_mps, got ${SHOT_RENDER_PROVIDER}"
  exit 1
fi
# ------------------------------

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
RUN_TS=$(node -e EVID_DIR="${EVID_ROOT}/prod_slice_v1_local_${TS}"
mkdir -p "${EVID_DIR}"

# Audit: Redirect all output to evidence log
exec > >(tee "${EVID_DIR}/gate_stdout.log") 2>&1

echo "[Gate] RUN_TS: ${RUN_TS}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"

PROJECT_ID="prod_slice_v1_local_${TS}"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE="${ROOT_DIR}/docs/_specs/novel_source_sample.txt"

echo "=============================================================================="
echo "PRODUCTION SLICE V1: REAL ENGINE EXECUTION"
echo "ProjectID: ${PROJECT_ID}"
echo "TraceID:   ${TRACE_ID}"
echo "Evidence:  ${EVID_DIR}"
echo "=============================================================================="

# Ensure Source Text
if [ ! -f "${NOVEL_SOURCE}" ]; then
  echo "Scene 1: A cyberpunk neon city. Camera pans down to a noodle shop with rain." > "${NOVEL_SOURCE}"
fi

# ==============================================================================
# 2. Helpers
# ==============================================================================
do_save_evidence() {
  local name="$1"
  local content="$2"
  echo "${content}" > "${EVID_DIR}/${name}"
}

# Robust JSON Escape helper
json_escape() {
  node -e }

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Terminal States: SUCCESS/FAILED, Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
    
    # Audit Rule: Ignore non-terminal states (PENDING, PROCESSING, etc.)
    if [ "${STATUS}" == "SUCCEEDED" ]; then
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$")
      echo "❌ Job ${job_id} FAILED: ${ERR}"
      # Evidence on Failure
      psql -d "${DATABASE_URL}" -x -c "SELECT * FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/failure_${job_id}.log"
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done

  # Timeout Handling
  echo "❌ [Timeout] waiting for Job ${job_id} to reach terminal state."
  psql -d "${DATABASE_URL}" -x -c "SELECT status, \"createdAt\", \"updatedAt\" FROM shot_jobs WHERE id=$gate$${job_id}$gate$" > "${EVID_DIR}/timeout_${job_id}.log"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ($gate$user-gate$gate$, $gate$gate@test.com$gate$, $gate$dummy_hash$gate$, $gate$Free$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ($gate$org-gate$gate$, $gate$Gate Org$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ($gate$mem-gate$gate$, $gate$org-gate$gate$, $gate$user-gate$gate$, $gate$OWNER$gate$, NOW(), NOW()) ON CONFLICT (\"organizationId\", \"userId\") DO NOTHING;"

# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (\$gate\$${PROJECT_ID}\$gate\$, \$gate\$Slice V1 Test\$gate\$, \$gate\$user-gate\$gate\$, \$gate\$org-gate\$gate\$, \$gate\$in_progress\$gate\$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;" # $gate$

echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
# P1 Enhancement: Extreme test text containing $$ and single quotes
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: ISAFE_TEXT_JSON="$(json_escape "${REAL_TEXT}")"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for absolute SQL safety even if content contains $$
psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ($gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$S1$gate$, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
# Episode
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ($gate$${EPISODE_ID}$gate$, $gate$${SEASON_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$E1$gate$) ON CONFLICT (id) DO NOTHING;"
# Scene
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES ($gate$${SCENE_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${PROJECT_ID}$gate$, 1, $gate$Sc1$gate$) ON CONFLICT (id) DO NOTHING;"
# Shot
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ($gate$${SHOT_ID_DUMMY}$gate$, $gate$${SCENE_ID}$gate$, 1, $gate$DEFAULT$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
PAYLOAD="{\"projectId\": \"${PROJECT_ID}\", \"novelSourceId\": \"${NOVEL_SOURCE_ID}\", \"traceId\": \"${TRACE_ID}\", \"sourceText\": \"${SAFE_TEXT_JSON}\"}"
# P1 Enhancement: Tagged Dollar-Quoting ($gate$..$gate$) for payload SQL safety
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
# Start waiting in background to keep real-time spawn logs, but ensure we JOIN later.
wait_for_job_success "${PIPE_JOB_ID}" 600 &
PIPE_WAIT_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE06_NOVEL_PARSING$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE06_JOB_ID}" ]; then
    echo "✅ Detected CE06 Job: ${CE06_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE06_JOB_ID}" ]; then echo "❌ CE06 Not Spawned by Pipeline"; exit 1; fi

wait_for_job_success "${CE06_JOB_ID}" 60

# Chain: CE03
echo "[Gate] Waiting for CE03 to be spawned by Pipeline..."
ELAPSED=0
CE03_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE03_VISUAL_DENSITY$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE03_JOB_ID}" ]; then
    echo "✅ Detected CE03 Job: ${CE03_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE03_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE03 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE03_JOB_ID="job-ce03-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE03_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE03_VISUAL_DENSITY$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do # Increased wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$CE04_VISUAL_ENRICHMENT$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ ORDER BY \"createdAt\" DESC LIMIT 1")
  if [ -n "${CE04_JOB_ID}" ]; then
    echo "✅ Detected CE04 Job: ${CE04_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE04_JOB_ID}" ]; then 
  ALLOW_MANUAL_FALLBACK="${ALLOW_MANUAL_FALLBACK:-0}"
  if [ "$ALLOW_MANUAL_FALLBACK" = "1" ]; then
    echo "⚠️  CE04 Not Spawned automatically. Triggering MANUALLY (Fallback Enabled)..."
    CE04_JOB_ID="job-ce04-${PROJECT_ID}"
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE04_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID_DUMMY}$gate$, $gate$CE04_VISUAL_ENRICHMENT$gate$, $gate$PENDING$gate$, $gate${\"projectId\": \"${PROJECT_ID}\", \"sceneId\": \"${SCENE_ID}\", \"traceId\": \"${TRACE_ID}\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  else
    echo "❌ CE04 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE04_JOB_ID}" 60

# Chain: SHOT_RENDER
# Finding REAL shot IDs from DB (Schema: Shot -> Scene -> Episode -> Project)
echo "[Gate] Fetching Shot ID for SHOT_RENDER..."

SHOT_ID=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT s.id
FROM shots s
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$
ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=$gate$SHOT_RENDER$gate$ AND \"projectId\"=$gate$${PROJECT_ID}$gate$ LIMIT 1")

if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${SHOT_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$SHOT_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"prompt\": \"A cyberpunk neon city noodle shop\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"
  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}"
  wait_for_job_success "${SHOT_JOB_ID}" 60
else
  echo "[Gate] Found existing SHOT_RENDER: ${EXISTING_SHOT_RENDER}"
  wait_for_job_success "${EXISTING_SHOT_RENDER}" 60
fi

# Verify PNG Asset
SHOT_ASSET_URI=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
SELECT a.\"storageKey\" 
FROM assets a
JOIN shots s ON a.\"ownerId\" = s.id
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
# Copy Asset to Storage Root for VIDEO_RENDER (Processor expects key in .data/storage)
STORAGE_TEMP="${ROOT_DIR}/.data/storage/temp"
mkdir -p "${STORAGE_TEMP}"
# Robust copy of SHOT asset to temp (supports: file://, absolute, relative, and "bad absolute" with duplicated ROOT segments)
SHOT_ASSET_KEY_RAW="${SHOT_ASSET_URI}"
SHOT_ASSET_KEY="${SHOT_ASSET_KEY_RAW#file://}"

echo "[Gate] SHOT storageKey raw: ${SHOT_ASSET_KEY_RAW}"
echo "[Gate] SHOT storageKey norm: ${SHOT_ASSET_KEY}"

# Detect absolute path (mac/linux)
is_abs_path() {
  case "$1" in
    /*) return 0 ;;
    *)  return 1 ;;
  esac
}

# Unique appender
append_unique() {
  local v="$1"
  for e in "${CANDS[@]}"; do
    if [ "$e" = "$v" ]; then
      return 0
    fi
  done
  CANDS+=("$v")
}

CANDS=()

# C0: If absolute, try as-is
if is_abs_path "${SHOT_ASSET_KEY}"; then
  append_unique "${SHOT_ASSET_KEY}"

  # C1: Fix duplicated segment "apps/api/apps/workers" -> "apps/workers"
  if [[ "${SHOT_ASSET_KEY}" == *"/apps/api/apps/workers/.runtime/"* ]]; then
    # Use sed for robust replacement (bash ${//} gets confused by slashes)
    FIXED=$(echo "${SHOT_ASSET_KEY}" | sed     append_unique "${FIXED}"
  fi

  # C1b: If contains ROOT_DIR, normalize to ROOT_DIR + tail (guards weird prefixing)
  if [[ "${SHOT_ASSET_KEY}" == *"${ROOT_DIR}/"* ]]; then
    TAIL="${SHOT_ASSET_KEY##*${ROOT_DIR}/}"
    append_unique "${ROOT_DIR}/${TAIL}"
  fi

else
  # C2: Treat as relative key under known roots (ONLY when not absolute)
  append_unique "${ROOT_DIR}/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/apps/workers/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.runtime/${SHOT_ASSET_KEY}"
  append_unique "${ROOT_DIR}/.data/storage/${SHOT_ASSET_KEY}"
fi

# Resolve first existing file
SHOT_FILE=""
RESOLVED_BY="NONE"
for c_info in "C0:${CANDS[0]}" "C1:${CANDS[1]}" "C1b:${CANDS[2]}" "C2:${CANDS[3]}" "C2b:${CANDS[4]}" "C2c:${CANDS[5]}"; do
  c="${c_info#*:}"
  tag="${c_info%%:*}"
  [ -z "${c}" ] && continue
  if [ -f "${c}" ]; then
    SHOT_FILE="${c}"
    RESOLVED_BY="${tag}"
    break
  fi
done

# Evidence: dump candidates for audit
{
  echo "SHOT_ASSET_URI=${SHOT_ASSET_URI}"
  echo "SHOT_ASSET_KEY=${SHOT_ASSET_KEY}"
  echo "ROOT_DIR=${ROOT_DIR}"
  echo "RESOLVED_BY=${RESOLVED_BY}"
  echo "CANDIDATES:"
  for c in "${CANDS[@]}"; do
    echo " - ${c} $( [ -f "${c}" ] && echo   done
  echo "RESOLVED=${SHOT_FILE}"
} > "${EVID_DIR}/shot_asset_path_resolution.txt"

if [ -z "${SHOT_FILE}" ]; then
  echo "❌ Shot image file not found for storageKey=${SHOT_ASSET_URI}"
  echo "See: ${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi

echo "[Gate] Resolved SHOT file: ${SHOT_FILE}"
cp "${SHOT_FILE}" "${STORAGE_TEMP}/prod_slice_input.png"
FRAME_KEY="temp/prod_slice_input.png"

psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${VIDEO_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$VIDEO_RENDER$gate$, $gate$PENDING$gate$, $gate${\"shotId\": \"${SHOT_ID}\", \"frameKeys\": [\"${FRAME_KEY}\"], \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"video_render\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=$gate$${VIDEO_JOB_ID}$gate$ LIMIT 1")
if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}"
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path (.data/storage)
    VIDEO_PATH="${ROOT_DIR}/.data/storage/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then
        # Try root
        VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
        if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
    fi
fi

# --- Normalize Video Asset to StorageKey Location (SSOT) ---
VIDEO_STORAGE_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
if [ -z "${VIDEO_STORAGE_KEY}" ]; then
  echo "❌ VIDEO storageKey missing for asset=${VIDEO_ASSET_ID}"
  exit 1
fi

# Strip file:// prefix (keep relative key)
REL_KEY="${VIDEO_STORAGE_KEY#file://}"

# Decide storage root (align with your StorageProvider contract)
# CE09 locally resolves keys relative to apps/workers/.runtime
DEST_PATH="${ROOT_DIR}/apps/workers/.runtime/${REL_KEY}"
DEST_DIR="$(dirname "${DEST_PATH}")"
mkdir -p "${DEST_DIR}"

# Copy the actual produced mp4 to the exact storageKey location (if different)
if [ "${VIDEO_PATH}" != "${DEST_PATH}" ]; then
  cp "${VIDEO_PATH}" "${DEST_PATH}"
fi

echo "[Gate] Synced VIDEO to storageKey path:"
echo "       storageKey=${VIDEO_STORAGE_KEY}"
echo "       dest=${DEST_PATH}"

# Optional: sanity check
if [ ! -f "${DEST_PATH}" ]; then
  echo "❌ Sync failed: ${DEST_PATH} not found"
  exit 1
fi

echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ($gate$${CE09_JOB_ID}$gate$, $gate$${PROJECT_ID}$gate$, $gate$${EPISODE_ID}$gate$, $gate$${SCENE_ID}$gate$, $gate$${SHOT_ID}$gate$, $gate$CE09_MEDIA_SECURITY$gate$, $gate$PENDING$gate$, $gate${\"assetId\": \"${VIDEO_ASSET_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"pipelineRunId\": \"${TRACE_ID}\", \"engineKey\": \"ce09_real_watermark\"}$gate$, NOW(), NOW(), $gate$org-gate$gate$, $gate$${TRACE_ID}$gate$) ON CONFLICT (id) DO NOTHING;"

echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=$gate$${VIDEO_ASSET_ID}$gate$")
echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}"
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
# ------------------------------------------------------------------------------
# JOIN: ensure pipeline wait finished (Audit: capture return code)
# ------------------------------------------------------------------------------
echo "[Gate] Joining pipeline wait pid=${PIPE_WAIT_PID} ..."
if ! wait "${PIPE_WAIT_PID}"; then
  echo "❌ Background Pipeline process FAILED."
  exit 1
fi
echo "[Gate] Pipeline wait joined (SUCCESS)."

# ==============================================================================
# 4. P1 Debt Enforcement (Zero Absolute Path for NEW assets)
# ==============================================================================
echo "[Gate] Performing P1 StorageKey Enforcement..."

# Check 1: Resolved By C1 (Regession check)
# C1 is the # We check if the RESOLVED_BY=C1 entry exists and belongs to a new asset (by proximity in the log or asset name)
if grep -q "RESOLVED_BY=C1" "${EVID_DIR}/shot_asset_path_resolution.txt"; then
  # P1 Enhancement: Strict reject if it matches a NEWLY generated asset
  # In this gate, the SHOT_ID is unique per run, so any C1 match is a regression.
  echo "❌ [P1 Fail] New asset triggered C1 (Correction Path). Expected C0 (Direct Relative)."
  echo "    Detailed Resolution Evidence:"
  cat "${EVID_DIR}/shot_asset_path_resolution.txt"
  exit 1
fi
echo "✅ [P1 Pass] RESOLVED_BY tag is clean (not C1)."

# Check 2: DB Absolute Path Check for this RUN
BAD_KEYS=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT count(*) 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$
  AND (\"storageKey\" LIKE 
if [ "${BAD_KEYS}" -gt 0 ]; then
  echo "❌ [P1 Fail] Detected ${BAD_KEYS} absolute storageKeys for this project."
  psql -d "${DATABASE_URL}" -c "SELECT id, \"storageKey\" FROM assets WHERE \"projectId\"=$gate$${PROJECT_ID}$gate$ AND (\"storageKey\" LIKE $gate$/%$gate$ OR \"storageKey\" LIKE $gate$file://%$gate$)"
  exit 1
fi
# Check 3: Allowed Prefix Assertion (Strict P1)
# Ensures key is relative AND within allowed storage areas.
readonly ALLOWED_PREFIXES=("apps/workers/.runtime/" ".runtime/" ".data/storage/" "secure/")
echo "[Gate] P1 SSOT Prefix Whitelist: ${ALLOWED_PREFIXES[*]}"
ILLEGAL_PREFIXES=$(psql -d "${DATABASE_URL}" -t -A -c " # $gate$
  SELECT \"storageKey\" 
  FROM assets 
  WHERE \"projectId\"=\$gate\$${PROJECT_ID}\$gate\$ 
  AND \"createdAt\" >= \$gate\$${RUN_TS}\$gate\$")

while read -r KEY; do
  [ -z "${KEY}" ] && continue
  MATCHED=0
  for PF in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "${KEY}" == "${PF}"* ]]; then
      MATCHED=1
      break
    fi
  done
  if [ "${MATCHED}" -eq 0 ]; then
    echo "❌ [P1 Fail] Asset storageKey leaks or has illegal prefix: ${KEY}"
    echo "    Allowed Prefixes: ${ALLOWED_PREFIXES[*]}"
    exit 1
  fi
done <<< "${ILLEGAL_PREFIXES}"
echo "✅ [P1 Pass] All database storageKeys for this project match allowed prefixes."

echo "✅ ALL STEPS PASSED (Platinum Standard + P1 Hard Gate)."
exit 0
