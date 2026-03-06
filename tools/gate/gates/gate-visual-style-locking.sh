#!/usr/bin/env bash
set -euo pipefail

GATE_NAME="VISUAL_STYLE_LOCKING"
REPO_ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="$REPO_ROOT/docs/_evidence/visual_style_locking_$TS"
mkdir -p "$EVI"

echo "[GATE] $GATE_NAME - START" | tee "$EVI/GATE_RUN.log"

if [ -f .env.local ]; then
  set -a; source .env.local; set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu}"

# 1) Setup Context with Style Prompt
TEST_ORG_ID="org_style_$TS"
TEST_PROJECT_ID="proj_style_$TS"
TEST_SOURCE_ID="source_style_$TS"
TEST_VOL_ID="vol_style_$TS"
TEST_CHAPTER_ID="chapter_style_$TS"
STYLE_PROMPT="Vibrant Neon Cyberpunk Style, high contrast, blue and magenta lighting"

USER_ID="$(psql "$DATABASE_URL" -tAc "select id from users limit 1;" | tr -d '[:space:]')"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVI/GATE_RUN.log"
INSERT INTO organizations (id, name, "ownerId", "createdAt", "updatedAt")
VALUES ('$TEST_ORG_ID', 'Style Test Org', '$USER_ID', NOW(), NOW());

INSERT INTO projects (id, name, "ownerId", "organizationId", status, style_prompt, "createdAt", "updatedAt")
VALUES ('$TEST_PROJECT_ID', 'Style Locking Test', '$USER_ID', '$TEST_ORG_ID', 'in_progress', '$STYLE_PROMPT', NOW(), NOW());

INSERT INTO novels (id, project_id, title, created_at, updated_at)
VALUES ('$TEST_SOURCE_ID', '$TEST_PROJECT_ID', '风格锁定测试小说', NOW(), NOW());

INSERT INTO novel_volumes (id, project_id, novel_source_id, index, title, created_at, updated_at)
VALUES ('$TEST_VOL_ID', '$TEST_PROJECT_ID', '$TEST_SOURCE_ID', 1, '第一卷', NOW(), NOW());

INSERT INTO novel_chapters (id, volume_id, novel_source_id, index, title, summary, is_system_controlled, created_at, updated_at)
VALUES ('$TEST_CHAPTER_ID', '$TEST_VOL_ID', '$TEST_SOURCE_ID', 1, '测试章节', '测试摘要', true, NOW(), NOW());
SQL

# 2) Create Job
CHAPTER_TEXT="在一个繁华的都市。"
JOB_ID="job_style_$TS"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVI/GATE_RUN.log"
INSERT INTO shot_jobs
  (id, "organizationId", "projectId", type, status, priority, payload, "traceId", "createdAt", "updatedAt")
VALUES
  ('$JOB_ID', '$TEST_ORG_ID', '$TEST_PROJECT_ID', 'CE06_NOVEL_PARSING', 'PENDING', 0,
   jsonb_build_object(
     'phase', 'CHUNK_PARSE',
     'chapterId', '$TEST_CHAPTER_ID',
     'raw_text', \$CH\$${CHAPTER_TEXT}\$CH\$
   ),
   'trace_style_$TS', NOW(), NOW());
SQL

# 3) Poll Status
TIMEOUT=180
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  STATUS="$(psql "$DATABASE_URL" -tAc "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | tr -d '[:space:]')"
  echo "[GATE] Job status: $STATUS"
  if [ "$STATUS" = "SUCCEEDED" ]; then break; fi
  if [ "$STATUS" = "FAILED" ]; then exit 1; fi
  sleep 5 ; ELAPSED=$((ELAPSED + 5))
done

# 4) Verify Enrichment
echo "[GATE] Verifying style prompt inheritance in enriched_text..." | tee -a "$EVI/GATE_RUN.log"
ENRICHED_TEXT="$(psql "$DATABASE_URL" -tAc "SELECT enriched_text FROM scenes WHERE chapter_id='$TEST_CHAPTER_ID' LIMIT 1;")"
echo "Enriched Text: $ENRICHED_TEXT" | tee -a "$EVI/GATE_RUN.log"

if [[ "$ENRICHED_TEXT" == *"$STYLE_PROMPT"* ]]; then
  echo "[GATE] PASS - Style prompt successfully inherited!" | tee -a "$EVI/GATE_RUN.log"
else
  echo "[GATE] FAIL - Style prompt not found in enriched_text" | tee -a "$EVI/GATE_RUN.log"
  exit 1
fi
