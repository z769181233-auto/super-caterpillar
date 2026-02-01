#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===

IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'
trap 'echo "[FATAL] line=$LINENO cmd=$BASH_COMMAND" >&2' ERR

# gate-prod_slice_v1_real.sh
# Chain: CE06 -> CE03 -> CE04 -> SHOT_RENDER -> VIDEO_RENDER -> CE09
# Self-contained version

# ==============================================================================
# 1. Environment & Variables
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

PROJECT_ID="prod_slice_v1_${TS}"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE="${ROOT_DIR}/docs/_specs/novel_source_sample.txt"

echo "=============================================================================="
echo "PRODUCTION SLICE V1: REAL ENGINE EXECUTION"
echo "ProjectID: ${PROJECT_ID}"
echo "TraceID:   ${TRACE_ID}"
echo "Evidence:  ${EVID_DIR}"
echo "=============================================================================="

if [ ! -f "${NOVEL_SOURCE}" ]; then
  echo "Scene 1: A cyberpunk neon city. Camera pans down to a noodle shop with rain." > "${NOVEL_SOURCE}"
fi

# ==============================================================================
# 2. Helpers
# ==============================================================================
wait_for_job_success() {
  local job_id="$1"
  local timeout="$2"
  local interval=2
  local elapsed=0

  echo "[Gate] Waiting for Job ${job_id} (Timeout: ${timeout}s)..."
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local STATUS=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT status FROM shot_jobs WHERE id='${job_id}'")
    if [ "${STATUS}" == "SUCCEEDED" ]; then
      echo "✅ Job ${job_id} SUCCEEDED"
      return 0
    elif [ "${STATUS}" == "FAILED" ]; then
      local ERR=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id='${job_id}'")
      echo "❌ Job ${job_id} FAILED: ${ERR}"
      exit 1
    fi
    sleep "${interval}"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Timeout waiting for Job ${job_id}"
  exit 1
}

# ==============================================================================
# 3. Execution (Direct SQL)
# ==============================================================================

# Seed User/Org
echo "[Gate] Seeding Test User & Org..."
psql -d "${DATABASE_URL}" -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ('user-gate', 'gate@test.com', 'hash', 'Pro', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ('org-gate', 'Gate Org', 'gate-org', 'user-gate', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "${DATABASE_URL}" -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ('om-gate', 'org-gate', 'user-gate', 'OWNER', NOW(), NOW()) ON CONFLICT (\"userId\", \"organizationId\") DO NOTHING;"

# Create Project
echo "[Gate] Step 1: Create Project (SQL)..."
psql -d "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', 'Gate Project', 'user-gate', 'org-gate', 'in_progress', NOW(), NOW());"

# Create NovelSource
echo "[Gate] Creating NovelSource (SQL)..."
NOVEL_SOURCE_ID="ns-${PROJECT_ID}"
    REAL_TEXT="Season 1\nChapter 1: The Beginning\n\nScene 1: The Street.\nThe neon lights reflected in the puddles.\n"
    psql -d "${DATABASE_URL}" -c "INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ('${NOVEL_SOURCE_ID}', '${PROJECT_ID}', E'${REAL_TEXT}', NOW(), NOW());"
echo "[Gate] Novel Source ID: ${NOVEL_SOURCE_ID}"

# Create Hierarchy (Season -> Episode -> Scene -> Shot)
echo "[Gate] Creating Dummy Hierarchy for ShotJob constraints..."
SEASON_ID="season-${PROJECT_ID}"
EPISODE_ID="ep-${PROJECT_ID}"
SCENE_ID="sc-${PROJECT_ID}"
SHOT_ID_DUMMY="shot-${PROJECT_ID}"

psql -d "${DATABASE_URL}" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ('${SEASON_ID}', '${PROJECT_ID}', 1, 'Season 1', NOW(), NOW());"
psql -d "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ('${EPISODE_ID}', '${SEASON_ID}', '${PROJECT_ID}', 1, 'Ep 1');"
psql -d "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", \"projectId\", index, title, \"reviewStatus\") VALUES ('${SCENE_ID}', '${EPISODE_ID}', '${PROJECT_ID}', 1, 'Scene 1', 'DRAFT');"
psql -d "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", index, type, \"reviewStatus\") VALUES ('${SHOT_ID_DUMMY}', '${SCENE_ID}', 1, 'DEFAULT', 'DRAFT');"

# Trigger PIPELINE_PROD_VIDEO_V1
echo "[Gate] Triggering PIPELINE_PROD_VIDEO_V1 (ShotJob)..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ('${PIPE_JOB_ID}', '${PROJECT_ID}', '${EPISODE_ID}', '${SCENE_ID}', '${SHOT_ID_DUMMY}', 'PIPELINE_PROD_VIDEO_V1', 'PENDING', '{\"novelSourceId\": \"${NOVEL_SOURCE_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\"}', NOW(), NOW(), 'org-gate', '${TRACE_ID}');"
echo "[Gate] Pipeline Job: ${PIPE_JOB_ID}"

wait_for_job_success "${PIPE_JOB_ID}" 300 &
PIPE_PID=$!

# Wait for CE06
echo "[Gate] Waiting for CE06 to be spawned by Pipeline..."
ELAPSED=0
CE06_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE06_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type='CE06_NOVEL_PARSING' AND \"projectId\"='${PROJECT_ID}' LIMIT 1")
  if [ -n "${CE06_JOB_ID}" ]; then
    echo "✅ Detected CE06 Job: ${CE06_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE06_JOB_ID}" ]; then echo "❌ CE06 Not Spawned by Pipeline"; exit 1; fi
wait_for_job_success "${CE06_JOB_ID}" 60

# Wait for CE03
echo "[Gate] Waiting for CE03 to be spawned by Pipeline..."
ELAPSED=0
CE03_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE03_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type='CE03_VISUAL_DENSITY' AND \"projectId\"='${PROJECT_ID}' LIMIT 1")
  if [ -n "${CE03_JOB_ID}" ]; then
    echo "✅ Detected CE03 Job: ${CE03_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE03_JOB_ID}" ]; then 
  echo "❌ CE03 Not Spawned (pipeline must spawn automatically)"
  exit 1
fi
wait_for_job_success "${CE03_JOB_ID}" 30

# Wait for CE04
echo "[Gate] Waiting for CE04 to be spawned by Pipeline..."
ELAPSED=0
CE04_JOB_ID=""
while [ "${ELAPSED}" -lt 60 ]; do
  CE04_JOB_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type='CE04_VISUAL_ENRICHMENT' AND \"projectId\"='${PROJECT_ID}' LIMIT 1")
  if [ -n "${CE04_JOB_ID}" ]; then
    echo "✅ Detected CE04 Job: ${CE04_JOB_ID}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED+2))
done
if [ -z "${CE04_JOB_ID}" ]; then 
  echo "❌ CE04 Not Spawned (pipeline must spawn automatically)"
  exit 1
fi
wait_for_job_success "${CE04_JOB_ID}" 60

# Chain: SHOT_RENDER
echo "[Gate] Fetching Shot ID for SHOT_RENDER..."
SHOT_ID=$(psql -d "${DATABASE_URL}" -t -A -c "
SELECT s.id
FROM shots s
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"='${PROJECT_ID}'
ORDER BY s.\"index\" ASC
LIMIT 1")

if [ -z "${SHOT_ID}" ] || [ "${SHOT_ID}" = "null" ]; then
  echo "❌ No shots found for project=${PROJECT_ID}. Abort."
  exit 1
fi
echo "[Gate] Shot ID: ${SHOT_ID}"

EXISTING_SHOT_RENDER=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM shot_jobs WHERE type='SHOT_RENDER' AND \"projectId\"='${PROJECT_ID}' LIMIT 1")

if [ -z "${EXISTING_SHOT_RENDER}" ]; then
  echo "[Gate] Spawning SHOT_RENDER (SQL)..."
  SHOT_JOB_ID="job-shot-${PROJECT_ID}"
  psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ('${SHOT_JOB_ID}', '${PROJECT_ID}', '${EPISODE_ID}', '${SCENE_ID}', '${SHOT_ID}', 'SHOT_RENDER', 'PENDING', '{\"shotId\": \"${SHOT_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"prompt\": \"A cyberpunk neon city noodle shop\"}', NOW(), NOW(), 'org-gate', '${TRACE_ID}') ON CONFLICT (id) DO NOTHING;"
  echo "[Gate] Spawned SHOT_RENDER: ${SHOT_JOB_ID}"
  wait_for_job_success "${SHOT_JOB_ID}" 60
else
  echo "[Gate] Found existing SHOT_RENDER: ${EXISTING_SHOT_RENDER}"
  wait_for_job_success "${EXISTING_SHOT_RENDER}" 60
fi

# Verify Asset
SHOT_ASSET_URI=$(psql -d "${DATABASE_URL}" -t -A -c "
SELECT a.\"storageKey\" 
FROM assets a
JOIN shots s ON a.\"ownerId\" = s.id
JOIN scenes sc ON s.\"sceneId\" = sc.id
JOIN episodes ep ON sc.\"episodeId\" = ep.id
WHERE ep.\"projectId\"='${PROJECT_ID}' AND a.type='IMAGE'
ORDER BY a.\"createdAt\" DESC 
LIMIT 1")
echo "[Gate] Asset URI: ${SHOT_ASSET_URI}"
if [ -z "${SHOT_ASSET_URI}" ]; then echo "❌ PNG Asset Missing"; exit 1; fi

# Chain: VIDEO_RENDER
echo "[Gate] Spawning VIDEO_RENDER (SQL)..."
VIDEO_JOB_ID="job-video-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ('${VIDEO_JOB_ID}', '${PROJECT_ID}', '${EPISODE_ID}', '${SCENE_ID}', '${SHOT_ID}', 'VIDEO_RENDER', 'PENDING', '{\"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"video_render\"}', NOW(), NOW(), 'org-gate', '${TRACE_ID}') ON CONFLICT (id) DO NOTHING;"
echo "[Gate] VIDEO_RENDER Job: ${VIDEO_JOB_ID}"
wait_for_job_success "${VIDEO_JOB_ID}" 60

# Verify MP4
VIDEO_ASSET_ID=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT id FROM assets WHERE \"createdByJobId\"='${VIDEO_JOB_ID}' LIMIT 1")
if [ -z "${VIDEO_ASSET_ID}" ]; then echo "❌ Video Asset ID Missing"; exit 1; fi

VIDEO_PATH_RAW=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE id='${VIDEO_ASSET_ID}'")
echo "[Gate] Video StorageKey: ${VIDEO_PATH_RAW}"

if [[ "${VIDEO_PATH_RAW}" != videos/* ]]; then
    echo "❌ Video StorageKey must start with 'videos/' (SSOT violation). Key: ${VIDEO_PATH_RAW}"
    exit 1
fi

VIDEO_PATH="${ROOT_DIR}/.runtime/${VIDEO_PATH_RAW#file://}"
if [ ! -f "${VIDEO_PATH}" ]; then 
    echo "❌ MP4 File Not Found in .runtime: ${VIDEO_PATH}"
    exit 1
fi

echo "[Gate] Performing ffprobe on: ${VIDEO_PATH}"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VIDEO_PATH}" || { echo "❌ ffprobe failed for ${VIDEO_PATH}"; exit 1; }

# Chain: CE09
echo "[Gate] Spawning CE09 (SQL)..."
CE09_JOB_ID="job-ce09-${PROJECT_ID}"
psql -d "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\") VALUES ('${CE09_JOB_ID}', '${PROJECT_ID}', '${EPISODE_ID}', '${SCENE_ID}', '${SHOT_ID}', 'CE09_MEDIA_SECURITY', 'PENDING', '{\"assetId\": \"${VIDEO_ASSET_ID}\", \"projectId\": \"${PROJECT_ID}\", \"traceId\": \"${TRACE_ID}\", \"engineKey\": \"ce09_real_watermark\"}', NOW(), NOW(), 'org-gate', '${TRACE_ID}') ON CONFLICT (id) DO NOTHING;"
echo "[Gate] CE09 Job: ${CE09_JOB_ID}"
wait_for_job_success "${CE09_JOB_ID}" 30

# Verify Watermark
FINAL_ASSET_KEY=$(psql -d "${DATABASE_URL}" -t -A -c "SELECT \"storageKey\" FROM assets WHERE \"createdByJobId\"='${CE09_JOB_ID}' LIMIT 1")
echo "[Gate] Final Asset Key: ${FINAL_ASSET_KEY}"
if [[ "${FINAL_ASSET_KEY}" != *secure* ]]; then echo "❌ Asset Key missing 'secure' suffix"; exit 1; fi

# ==============================================================================
# PHASE 5D-4: Identity Regression Check (Consistency)
# ==============================================================================
echo "[Gate] Starting Identity Regression Check..."

# 1. Run Consistency Runner (Independent)
echo "[Gate] Running Identity Runner..."
# Sync evidence dir for Runner
echo "${EVID_DIR}" > .current_evidence_dir
./node_modules/.bin/ts-node tools/gate/runners/run-identity-consistency.ts

IDS_FILE="${EVID_DIR}/SHOT_RENDER_JOB_IDS.txt"

if [ ! -f "${IDS_FILE}" ]; then
    echo "[Gate] ❌ Identity Runner produced no ID file."
    exit 1
fi

JOB1=$(sed -n '1p' "$IDS_FILE")
JOB2=$(sed -n '2p' "$IDS_FILE")
echo "[Gate] Identity Jobs: $JOB1, $JOB2"

# 2. SQL Consistency Check (CSV)
SQL_TEMPLATE="tools/gate/sql/audit_identity_consistency.sql"
SQL_RUN="${EVID_DIR}/consistency_query.sql"
sed "s/__JOB1__/$JOB1/g; s/__JOB2__/$JOB2/g" "$SQL_TEMPLATE" > "$SQL_RUN"

CSV_OUT="${EVID_DIR}/AUDIT_IDENTITY_CONSISTENCY.csv"
echo "[Gate] Querying Audit Logs (CSV)..."
psql "${DATABASE_URL}" -f "$SQL_RUN" > "$CSV_OUT"

# 3. Python Assertion (Anchor/Seed/Hash/CharID)
echo "[Gate] Asserting CSV Consistency..."
python3 -c "
import csv, sys
reader = csv.DictReader(open('${CSV_OUT}'))
rows = list(reader)
if len(rows) != 2:
    print(f'❌ Expected 2 rows, got {len(rows)}')
    sys.exit(1)

r1, r2 = rows[0], rows[1]
keys = ['character_id', 'anchor_id', 'seed', 'view_hash']
for k in keys:
    if r1[k] != r2[k]:
        print(f'❌ Inconsistent {k}: {r1[k]} vs {r2[k]}')
        sys.exit(1)
print('✅ Identity Consistency Verified')
"

# 4. Generate SHA256 Index (Append to Gate's Evidence)
echo "[Gate] Generating SHA256 Evidence Index..."
export EVD="${EVID_DIR}"
python3 -c '
import hashlib, json, os
root=os.environ["EVD"]
out=[]
for dirpath,_,files in os.walk(root):
    for fn in sorted(files):
        if fn == "EVIDENCE_INDEX.json": continue
        p=os.path.join(dirpath,fn)
        h=hashlib.sha256(open(p,"rb").read()).hexdigest()
        out.append({"path":os.path.relpath(p,root),"sha256":h})
with open(os.path.join(root,"EVIDENCE_INDEX.json"),"w") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"Index generated with {len(out)} files.")
'

echo "✅ ALL STEPS PASSED."
exit 0
