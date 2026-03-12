#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE 15: CE11 Shot Generator Integration
# Goal: Verify Bible V3.0 CE11 Protocol (sceneId -> shots) maps to Production DB (shots table).

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="docs/_evidence/gate15_ce11_${TS}"
mkdir -p "$EVI"

TRACE="trace_ce11_${TS}"
JOB_ID="job_gate15_${TS}"
ORG_ID="org-gate"
PROJ_ID="proj_gate15_${TS}"
VOL_ID="vol_gate15_${TS}"
CHAP_ID="chap_gate15_${TS}"
SCENE_ID="scene_gate15_${TS}"

echo "[GATE15] Starting CE11 Verification at ${TS}..."
echo "[GATE15] Evidence Dir: ${EVI}"

# 1) Prepare Bible Input (Canonical V3.0 Payload for CE11)
echo "[GATE15] Bible Payload Prepared."

# 2) Seed Database Hierarchy
echo "[GATE15] Seeding DB Hierarchy..."

# User & Project
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO users(id, email, \"passwordHash\", \"userType\", role, tier, quota, \"defaultOrganizationId\", \"createdAt\", \"updatedAt\")
VALUES ('user-gate', 'gate@scu.com', 'hash', 'admin', 'ADMIN', 'Free', NULL, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO organizations(id, name, \"ownerId\", \"createdAt\", \"updatedAt\")
VALUES ('${ORG_ID}', 'Gate Org', 'user-gate', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO projects(id, name, description, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\")
VALUES ('${PROJ_ID}', 'gate15-ce11', 'gate15 verification', 'user-gate', '${ORG_ID}', 'in_progress', now(), now())
ON CONFLICT (id) DO NOTHING;
" > /dev/null

# Source
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_sources(id, \"projectId\", \"organizationId\", \"rawText\", \"fileName\", \"fileKey\", \"fileSize\", \"createdAt\", \"updatedAt\")
VALUES ('src_${PROJ_ID}', '${PROJ_ID}', '${ORG_ID}', 'Dummy', 'gate15.txt', '${PROJ_ID}/gate15.txt', 1024, now(), now());
" > /dev/null

# Novel (Missing Relational Bridge)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novels(id, project_id, title, created_at, updated_at)
VALUES ('nov_${PROJ_ID}', '${PROJ_ID}', 'Gate 15 Novel', now(), now());
" > /dev/null

# Volume
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_volumes(id, project_id, novel_source_id, index, title, created_at, updated_at)
VALUES ('${VOL_ID}', '${PROJ_ID}', 'nov_${PROJ_ID}', 1, 'Gate Volume', now(), now());
" > /dev/null

# Chapter
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_chapters(id, volume_id, novel_source_id, index, title, created_at, updated_at)
VALUES ('${CHAP_ID}', '${VOL_ID}', 'nov_${PROJ_ID}', 1, 'Gate Chapter', now(), now());
" > /dev/null

# Scene (Bible Input Source)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO scenes(id, chapter_id, scene_index, title, enriched_text, project_id, created_at, updated_at)
VALUES ('${SCENE_ID}', '${CHAP_ID}', 1, 'Gate Scene', 'Cyberpunk city, neon lights, busy streets.', '${PROJ_ID}', now(), now());
" > /dev/null

# Production Hierarchy (Required for shots FK)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO seasons(id, \"projectId\", index, title, \"createdAt\", \"updatedAt\")
VALUES ('sea_${TS}', '${PROJ_ID}', 1, 'Gate Season', now(), now());
INSERT INTO episodes(id, \"seasonId\", \"projectId\", index, name)
VALUES ('epi_${TS}', 'sea_${TS}', '${PROJ_ID}', 1, 'Gate Episode');
UPDATE scenes SET \"episodeId\" = 'epi_${TS}', \"reviewStatus\" = 'DRAFT', updated_at = now() WHERE id = '${SCENE_ID}';
" > /dev/null

echo "[GATE15] DB Hierarchy Seeded."

# Determine JOB_SCENE_ID based on Negative Test Flag
JOB_SCENE_ID="${SCENE_ID}"
if [ "${CE11_NEGATIVE_TEST:-0}" = "1" ]; then
  echo "[GATE15][NEGATIVE] Configuring Job to use INVALID Scene ID..."
  JOB_SCENE_ID="non_existent_scene_${TS}"
fi

# 3) Prepare Bible Input (Canonical V3.0 Payload for CE11)
# NOTE: We generate this AFTER deciding the JOB_SCENE_ID to ensure Negative Test uses the invalid one.
cat > "$EVI/ce11_input.json" <<JSON
{
  "novelSceneId": "${JOB_SCENE_ID}",
  "traceId": "${TRACE}",
  "pipelineRunId": "run_gate15_${TS}"
}
JSON
echo "[GATE15] Bible Payload Prepared with novelSceneId=${JOB_SCENE_ID}"
PAYLOAD_JSON=$(cat "$EVI/ce11_input.json")
PAYLOAD_SQL=$(echo "$PAYLOAD_JSON" | sed "s/'/''/g")

# 4) Insert CE11 Job
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO shot_jobs(
  id, \"organizationId\", \"projectId\", status, type, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\"
) VALUES (
  '${JOB_ID}', '${ORG_ID}', '${PROJ_ID}', 'PENDING', 'CE11_SHOT_GENERATOR', 5,
  '${PAYLOAD_SQL}'::jsonb,
  now(), now(), '${TRACE}'
);
" > /dev/null

echo "[GATE15] Job Inserted: ${JOB_ID}. Waiting for Worker..."

# 5) Poll Job Status
MAX_RETRIES=60
count=0
while [ $count -lt $MAX_RETRIES ]; do
  status=$(psql "$DATABASE_URL" -t -A -c "SELECT status FROM shot_jobs WHERE id='${JOB_ID}';")
  echo "Poll [$count/$MAX_RETRIES] Status: $status" | tee -a "$EVI/poll_job_status.log"
  
  if [[ "$status" == "SUCCEEDED" ]]; then
    echo "[GATE15] Job SUCCEEDED."
    break
  fi
  
  if [[ "$status" == "FAILED" ]]; then
    echo "[GATE15] Job FAILED."
    psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id='${JOB_ID}';" | tee "$EVI/job_failed_detail.txt"
    
    if [ "${CE11_NEGATIVE_TEST:-0}" = "1" ]; then
        echo "✅ PASS: Negative Test FAILED as expected."
        exit 0
    else
        echo "❌ UNEXPECTED FAIL: Job failed in Positive Test."
        exit 1
    fi
  fi
  
  sleep 2
  count=$((count + 1))
done

if [ $count -eq $MAX_RETRIES ]; then
  echo "[GATE15] Timeout waiting for job."
  exit 1
fi

# 6) Assertions
echo "[GATE15] Verifying Persistence in shots table..."

# Shot Count Assertion
SHOT_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM shots WHERE \"sceneId\"='${SCENE_ID}';")
echo "Shot Count: $SHOT_COUNT" | tee "$EVI/shot_assertion.txt"

if [ "$SHOT_COUNT" -gt 0 ]; then
  echo "✅ PASS: Shots created ($SHOT_COUNT)." | tee -a "$EVI/shot_assertion.txt"
else
  # NOTE: If we are in Negative Mode and reached here (via SUCCEEDED), meaning Negative Failed to Fail.
  if [ "${CE11_NEGATIVE_TEST:-0}" = "1" ]; then
     echo "❌ FAIL: Job SUCCEEDED in Negative Mode. This is unexpected." | tee -a "$EVI/shot_assertion.txt"
     exit 1
  fi
  echo "❌ FAIL: No shots created." | tee -a "$EVI/shot_assertion.txt"
  exit 1
fi

# Shot Content Assertion (Verification of visual_prompt and index)
SHOTS_DETAIL=$(psql "$DATABASE_URL" -c "SELECT id, index, visual_prompt, shot_type FROM shots WHERE \"sceneId\"='${SCENE_ID}' ORDER BY index ASC;")
echo "$SHOTS_DETAIL" | tee -a "$EVI/shot_assertion.txt"

# Assert visual_prompt is not empty for first shot
FIRST_PROMPT=$(psql "$DATABASE_URL" -t -A -c "SELECT visual_prompt FROM shots WHERE \"sceneId\"='${SCENE_ID}' AND index=1;")
if [[ -n "$FIRST_PROMPT" && "$FIRST_PROMPT" != "null" ]]; then
  echo "✅ PASS: First shot has visual_prompt: $FIRST_PROMPT" | tee -a "$EVI/shot_assertion.txt"
else
  echo "❌ FAIL: First shot visual_prompt is empty." | tee -a "$EVI/shot_assertion.txt"
  exit 1
fi

# Assert index 2 exists (since my mock returns 2 shots)
SECOND_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT id FROM shots WHERE \"sceneId\"='${SCENE_ID}' AND index=2;")
if [[ -n "$SECOND_ID" ]]; then
  echo "✅ PASS: Second shot exists (index=2)." | tee -a "$EVI/shot_assertion.txt"
else
  echo "❌ FAIL: Second shot missing." | tee -a "$EVI/shot_assertion.txt"
  exit 1
fi

# 7) Archiving
(
  cd "$EVI"
  shasum -a 256 * > SHA256SUMS.txt
)

echo "🏆 GATE15 PASS: CE11 Shot Generator Integrated."
