#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE 14: CE02 Visual Density Integration
# Goal: Verify Bible V3.0 CE02 Protocol (text -> score, breakdown, verdict) maps to Production DB (chapters/scenes).

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu}"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="docs/_evidence/gate14_ce02_${TS}"
mkdir -p "$EVI"

TRACE="trace_ce02_${TS}"
JOB_ID="job_gate14_${TS}"
ORG_ID="org-gate"
PROJ_ID="proj_gate14_${TS}"
VOL_ID="vol_gate14_${TS}"
CHAP_ID="chap_gate14_${TS}"
SCENE_ID="scene_gate14_${TS}"

echo "[GATE14] Starting CE02 Verification at ${TS}..."
echo "[GATE14] Evidence Dir: ${EVI}"

# 1) Prepare Bible Input (Canonical V3.0 Payload for CE02)
cat > "$EVI/ce02_input.json" <<JSON
{
  "text": "The dragon soared over the burning ruins of the obsidian tower, its scales shimmering like molten gold.",
  "chapterId": "${CHAP_ID}",
  "sceneId": "${SCENE_ID}",
  "traceId": "${TRACE}",
  "pipelineRunId": "run_gate14_${TS}"
}
JSON
echo "[GATE14] Bible Payload Prepared."

# 2) Seed Database Hierarchy
echo "[GATE14] Seeding DB Hierarchy..."

# User & Project
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO users(id, email, \"passwordHash\", \"userType\", role, tier, quota, \"defaultOrganizationId\", \"createdAt\", \"updatedAt\")
VALUES ('user-gate', 'gate@scu.com', 'hash', 'admin', 'ADMIN', 'Basic', '{}'::jsonb, '${ORG_ID}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO projects(id, name, description, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\")
VALUES ('${PROJ_ID}', 'gate14-ce02', 'gate14 verification', 'user-gate', '${ORG_ID}', 'in_progress', now(), now())
ON CONFLICT (id) DO NOTHING;
" > /dev/null

# Source
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novels(id, project_id, title, file_name, created_at, updated_at)
VALUES ('src_${PROJ_ID}', '${PROJ_ID}', 'Dummy', 'gate14.txt', now(), now());
" > /dev/null

# Volume
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_volumes(id, project_id, novel_source_id, index, title, created_at, updated_at)
VALUES ('${VOL_ID}', '${PROJ_ID}', 'src_${PROJ_ID}', 1, 'Gate Volume', now(), now());
" > /dev/null

# Chapter
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_chapters(id, volume_id, novel_source_id, index, title, created_at, updated_at)
VALUES ('${CHAP_ID}', '${VOL_ID}', 'src_${PROJ_ID}', 1, 'Gate Chapter', now(), now());
" > /dev/null

# Scene
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO scenes(id, chapter_id, scene_index, title, project_id, created_at, updated_at)
VALUES ('${SCENE_ID}', '${CHAP_ID}', 1, 'Gate Scene', '${PROJ_ID}', now(), now());
" > /dev/null

echo "[GATE14] DB Hierarchy Seeded."

# 3) Insert CE02 Job
PAYLOAD_JSON=$(cat "$EVI/ce02_input.json")
PAYLOAD_SQL=$(echo "$PAYLOAD_JSON" | sed "s/'/''/g")

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO shot_jobs(
  id, \"organizationId\", \"projectId\", status, type, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\"
) VALUES (
  '${JOB_ID}', '${ORG_ID}', '${PROJ_ID}', 'PENDING', 'CE02_VISUAL_DENSITY', 5,
  '${PAYLOAD_SQL}'::jsonb,
  now(), now(), '${TRACE}'
);
" > /dev/null

echo "[GATE14] Job Inserted: ${JOB_ID}. Waiting for Worker..."

# 4) Poll Job Status
MAX_RETRIES=60
count=0
while [ $count -lt $MAX_RETRIES ]; do
  status=$(psql "$DATABASE_URL" -t -A -c "SELECT status FROM shot_jobs WHERE id='${JOB_ID}';")
  echo "Poll [$count/$MAX_RETRIES] Status: $status" | tee -a "$EVI/poll_job_status.log"
  
  if [[ "$status" == "SUCCEEDED" ]]; then
    echo "[GATE14] Job SUCCEEDED."
    break
  fi
  
  if [[ "$status" == "FAILED" ]]; then
    echo "[GATE14] Job FAILED."
    psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id='${JOB_ID}';" | tee "$EVI/job_failed_detail.txt"
    exit 1
  fi
  
  sleep 2
  count=$((count + 1))
done

if [ $count -eq $MAX_RETRIES ]; then
  echo "[GATE14] Timeout waiting for job."
  exit 1
fi

# 5) Assertions
echo "[GATE14] Verifying Persistence..."

# Chapter Assertion
VAL_CHAP=$(psql "$DATABASE_URL" -t -A -c "SELECT visual_density_score FROM novel_chapters WHERE id='${CHAP_ID}';")
META_CHAP=$(psql "$DATABASE_URL" -t -A -c "SELECT visual_density_meta FROM novel_chapters WHERE id='${CHAP_ID}';")

echo "Chapter Score: $VAL_CHAP" | tee "$EVI/chapter_assertion.txt"
echo "Chapter Meta: $META_CHAP" | tee -a "$EVI/chapter_assertion.txt"

if [[ -n "$VAL_CHAP" && "$VAL_CHAP" != "null" ]]; then
  echo "✅ PASS: Chapter score updated." | tee -a "$EVI/chapter_assertion.txt"
else
  echo "❌ FAIL: Chapter score is empty." | tee -a "$EVI/chapter_assertion.txt"
  exit 1
fi

if [[ "$META_CHAP" == *"verdict"* ]]; then
  echo "✅ PASS: Chapter meta updated with verdict." | tee -a "$EVI/chapter_assertion.txt"
else
  echo "❌ FAIL: Chapter meta missing verdict." | tee -a "$EVI/chapter_assertion.txt"
  exit 1
fi

# Scene Assertion
VAL_SCENE=$(psql "$DATABASE_URL" -t -A -c "SELECT visual_density_score FROM scenes WHERE id='${SCENE_ID}';")
echo "Scene Score: $VAL_SCENE" | tee "$EVI/scene_assertion.txt"

if [[ -n "$VAL_SCENE" && "$VAL_SCENE" != "null" ]]; then
  echo "✅ PASS: Scene score updated." | tee -a "$EVI/scene_assertion.txt"
else
  echo "❌ FAIL: Scene score is empty." | tee -a "$EVI/scene_assertion.txt"
  exit 1
fi

# 6) Archiving
(
  cd "$EVI"
  shasum -a 256 * > SHA256SUMS.txt
)

echo "🏆 GATE14 PASS: CE02 Visual Density Integrated."
