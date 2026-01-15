#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-prod_slice_v1_real.sh# 链路: CE06 -> CE03 -> CE04 -> SHOT_RENDER -> VIDEO_RENDER -> CE09
# 自包含版本 (Self-contained)

set -e

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/prod_slice_v1_real_${TS}"
mkdir -p "${EVID_DIR}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
API_BASE="http://127.0.0.1:3000"

PROJECT_ID="prod_slice_v1_${TS}"
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

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=    if [ "${STATUS}" == "SUCCEEDED" ]; then # $gate$
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=      echo "❌ Job ${job_id} FAILED: ${ERR}" # $gate$
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Timeout waiting for Job ${job_id}"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
# Seed Token
TOKEN=$(pnpm --prefix "${ROOT_DIR}/apps/api" exec node -e "const jwt = require(
# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: The Street.\nThe neon lights reflected in the puddles.\n"
# Escape single quotes in text if needed (doubling them)
SAFE_TEXT="${REAL_TEXT//\psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"
CHAPTER_ID="ch-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (# Episode # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (# Scene # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES (# Shot # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ( # $gate$
echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
wait_for_job_success "${PIPE_JOB_ID}" 300 &
PIPE_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE06_JOB_ID}" ]; then # $gate$
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
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE03_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 10 ]; do # Short wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE04_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
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
WHERE ep.\"projectId\"=ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type= # $gate$
if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}" # $gate$
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
WHERE ep.\"projectId\"=AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi # $gate$
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}" # $gate$
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path
    VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
fi

# Chain: CE09
echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}" # $gate$
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
echo "✅ ALL STEPS PASSED."
exit 0

set -e

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/prod_slice_v1_real_${TS}"
mkdir -p "${EVID_DIR}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
API_BASE="http://127.0.0.1:3000"

PROJECT_ID="prod_slice_v1_${TS}"
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

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=    if [ "${STATUS}" == "SUCCEEDED" ]; then # $gate$
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=      echo "❌ Job ${job_id} FAILED: ${ERR}" # $gate$
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Timeout waiting for Job ${job_id}"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
# Seed Token
TOKEN=$(pnpm --prefix "${ROOT_DIR}/apps/api" exec node -e "const jwt = require(
# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: The Street.\nThe neon lights reflected in the puddles.\n"
# Escape single quotes in text if needed (doubling them)
SAFE_TEXT="${REAL_TEXT//\psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"
CHAPTER_ID="ch-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (# Episode # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (# Scene # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES (# Shot # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ( # $gate$
echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
wait_for_job_success "${PIPE_JOB_ID}" 300 &
PIPE_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE06_JOB_ID}" ]; then # $gate$
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
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE03_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 10 ]; do # Short wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE04_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
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
WHERE ep.\"projectId\"=ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type= # $gate$
if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}" # $gate$
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
WHERE ep.\"projectId\"=AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi # $gate$
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}" # $gate$
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path
    VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
fi

# Chain: CE09
echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}" # $gate$
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
echo "✅ ALL STEPS PASSED."
exit 0

set -e

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/prod_slice_v1_real_${TS}"
mkdir -p "${EVID_DIR}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
API_BASE="http://127.0.0.1:3000"

PROJECT_ID="prod_slice_v1_${TS}"
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

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=    if [ "${STATUS}" == "SUCCEEDED" ]; then # $gate$
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=      echo "❌ Job ${job_id} FAILED: ${ERR}" # $gate$
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Timeout waiting for Job ${job_id}"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
# Seed Token
TOKEN=$(pnpm --prefix "${ROOT_DIR}/apps/api" exec node -e "const jwt = require(
# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: The Street.\nThe neon lights reflected in the puddles.\n"
# Escape single quotes in text if needed (doubling them)
SAFE_TEXT="${REAL_TEXT//\psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"
CHAPTER_ID="ch-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (# Episode # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (# Scene # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES (# Shot # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ( # $gate$
echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
wait_for_job_success "${PIPE_JOB_ID}" 300 &
PIPE_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE06_JOB_ID}" ]; then # $gate$
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
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE03_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 10 ]; do # Short wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE04_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
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
WHERE ep.\"projectId\"=ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type= # $gate$
if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}" # $gate$
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
WHERE ep.\"projectId\"=AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi # $gate$
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}" # $gate$
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path
    VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
fi

# Chain: CE09
echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}" # $gate$
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
echo "✅ ALL STEPS PASSED."
exit 0

set -e

# ==============================================================================
# 1. 环境准备 & 变量定义
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${ROOT_DIR}/docs/_evidence"
TS="$(date +"%Y%m%d_%H%M%S")"
EVID_DIR="${EVID_ROOT}/prod_slice_v1_real_${TS}"
mkdir -p "${EVID_DIR}"

export GATE_MODE=1
export PRODUCTION_MODE=1
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET:-f0f4cb55a02a5bf2b2e9cbb273daf87991ad426e3ea68cf90cf394027c6ac23c9140290dce913869d9241aa675335d27}"
API_BASE="http://127.0.0.1:3000"

PROJECT_ID="prod_slice_v1_${TS}"
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

wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id=    if [ "${STATUS}" == "SUCCEEDED" ]; then # $gate$
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id=      echo "❌ Job ${job_id} FAILED: ${ERR}" # $gate$
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Timeout waiting for Job ${job_id}"
  exit 1
}

# ==============================================================================
# 3. Execution
# ==============================================================================

# Seed DB User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES (psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
# Seed Token
TOKEN=$(pnpm --prefix "${ROOT_DIR}/apps/api" exec node -e "const jwt = require(
# Step 1: Create Project & NovelSource (Direct SQL to bypass granular auth)
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
REAL_TEXT="Chapter 1: The Beginning\n\nScene 1: The Street.\nThe neon lights reflected in the puddles.\n"
# Escape single quotes in text if needed (doubling them)
SAFE_TEXT="${REAL_TEXT//\psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ( # $gate$
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Trigger CE06 (ShotJob with Manual Hierarchy)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"
CHAPTER_ID="ch-${PROJECT_ID}"

# Season
psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (# Episode # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (# Scene # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title) VALUES (# Shot # $gate$
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type) VALUES ( # $gate$
echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"
wait_for_job_success "${PIPE_JOB_ID}" 300 &
PIPE_PID=$!

echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
# Poll for CE06
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE06_JOB_ID}" ]; then # $gate$
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
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE03_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
    echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
    exit 1
  fi
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Chain: CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 10 ]; do # Short wait for auto
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type=  if [ -n "${CE04_JOB_ID}" ]; then # $gate$
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
    psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  else # $gate$
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
WHERE ep.\"projectId\"=ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi

echo "[Gate] Shot ID: ${SHOT_ID}"

# Check for SHOT_RENDER job
EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type= # $gate$
if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES (  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}" # $gate$
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
WHERE ep.\"projectId\"=AND a.type=ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"=if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi # $gate$
VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}" # $gate$
if [ ! -f "${VIDEO_PATH}" ]; then 
    # Try alternate path
    VIDEO_PATH="${ROOT_DIR}/${VIDEO_PATH_RAW#file://}"
    if [ ! -f "${VIDEO_PATH}" ]; then echo "❌ MP4 File Not Found: ${VIDEO_PATH}"; exit 1; fi
fi

# Chain: CE09
echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ( # $gate$
echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id=echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}" # $gate$
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 
echo "✅ ALL STEPS PASSED."
exit 0
