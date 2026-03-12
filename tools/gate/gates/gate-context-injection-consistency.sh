#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

GATE_NAME="CONTEXT_INJECTION_CONSISTENCY"
REPO_ROOT="$(pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="$REPO_ROOT/docs/_evidence/context_injection_$TS"
mkdir -p "$EVI"

echo "[GATE] $GATE_NAME - START" | tee "$EVI/GATE_RUN.log"
echo "[EVI] $EVI" | tee -a "$EVI/GATE_RUN.log"

export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/scu"}

# ----------------------------
# 0) Schema probe (no guessing)
# ----------------------------
echo "[GATE] Probing schema..." | tee -a "$EVI/GATE_RUN.log"

psql "$DATABASE_URL" -c "
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('organizations','projects','novel_sources','novel_volumes','novel_chapters','scenes','scenes','shot_jobs','users')
order by table_name, ordinal_position;
" | tee "$EVI/SCHEMA_PROBE.txt" | tee -a "$EVI/GATE_RUN.log"

# helper: test table exists
table_exists() {
  local t="$1"
  psql "$DATABASE_URL" -tAc "select to_regclass('public.${t}') is not null;" | grep -qi "t"
}

# V3.0: Use scenes for Novel Parsing context injection verification
SCENE_TABLE="scenes"
echo "[GATE] Using scene table: $SCENE_TABLE" | tee -a "$EVI/GATE_RUN.log"

# ----------------------------
# 1) Create minimal project context (essential for context injection)
# ----------------------------
TEST_ORG_ID="org_context_test_$TS"
TEST_PROJECT_ID="proj_context_test_$TS"
TEST_NOVEL_ID="nov_ctx_$TS"
TEST_SOURCE_ID="source_ctx_$TS"
TEST_VOL_ID="vol_ctx_$TS"
TEST_CHAPTER_1_ID="chapter_ctx_1_$TS"
TEST_CHAPTER_2_ID="chapter_ctx_2_$TS"

# Find any user id to satisfy FK
USER_ID="$(psql "$DATABASE_URL" -tAc "select id from users limit 1;" | tr -d '[:space:]')"
if [ -z "$USER_ID" ]; then
  echo "[GATE] FAIL - No user found in users table" | tee -a "$EVI/GATE_RUN.log"
  exit 1
fi

echo "[GATE] Creating full project hierarchy (hierarchical fix)..." | tee -a "$EVI/GATE_RUN.log"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVI/GATE_RUN.log"
-- Org
INSERT INTO organizations (id, name, "ownerId", "createdAt", "updatedAt")
VALUES ('$TEST_ORG_ID', 'Context Test Org', '$USER_ID', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

-- Project
INSERT INTO projects (id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt")
VALUES ('$TEST_PROJECT_ID', 'Context Injection Test', '$USER_ID', '$TEST_ORG_ID', 'in_progress', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

-- NovelSource
INSERT INTO novel_sources (id, "projectId", "organizationId", "rawText", "fileName", "fileKey", "fileSize", "createdAt", "updatedAt")
VALUES ('$TEST_SOURCE_ID', '$TEST_PROJECT_ID', '$TEST_ORG_ID', '测试文本', 'novel.txt', 'key_ctx_$TS', 1024, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

-- Novels (Canonical Wrapper Required by Processor)
INSERT INTO novels (id, project_id, title, created_at, updated_at)
VALUES ('$TEST_NOVEL_ID', '$TEST_PROJECT_ID', 'Context Injection Test Novel', NOW(), NOW()) ON CONFLICT (project_id) DO NOTHING;

-- Volume (Use novel_source_id variant pointing to Novels.id)
INSERT INTO novel_volumes (id, "project_id", "novel_source_id", "index", title, "created_at", "updated_at")
VALUES ('$TEST_VOL_ID', '$TEST_PROJECT_ID', '$TEST_NOVEL_ID', 1, '第一卷', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

--# Chapters (Point to Novels.id)
INSERT INTO novel_chapters (id, "volume_id", "novel_source_id", "index", title, summary, "created_at", "updated_at")
VALUES 
  ('$TEST_CHAPTER_1_ID', '$TEST_VOL_ID', '$TEST_NOVEL_ID', 1, '第一章', '张三初次登场', NOW(), NOW()),
  ('$TEST_CHAPTER_2_ID', '$TEST_VOL_ID', '$TEST_NOVEL_ID', 2, '第二章', '张三继续前行', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL

# V3.0 P0-2: Inject a dummy vector for Chapter 1 to test Long-term memory retrieval
# Hardened: Generate vector literal in Bash, then inject into SQL (Avoid definition inside SQL heredoc)
DUMMY_VECTOR="[$(printf '0.1,%.0s' {1..1535})0.1]"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVI/GATE_RUN.log"
UPDATE novel_chapters 
SET summary_vector = '$DUMMY_VECTOR'::vector 
WHERE id = '$TEST_CHAPTER_1_ID';
SQL

# ----------------------------
# 2) Create two CE06 parsing jobs in shot_jobs (with TOP-LEVEL traceId)
# ----------------------------
CHAPTER_1_TEXT="第一章：张三身穿红色长袍，手持长剑，站在森林边缘。他的长发在风中铺扬，腰间挂着一块玉佩。"
CHAPTER_2_TEXT="第二章：张三继续前行，他的红袍在风中铺扬。长剑依然握在手中，森林深处传来声响。"

JOB_1_ID="job_ctx_1_$TS"
JOB_2_ID="job_ctx_2_$TS"
JOB_TYPE="CE06_NOVEL_PARSING"

echo "[GATE] Creating jobs in shot_jobs (with top-level traceId)..." | tee -a "$EVI/GATE_RUN.log"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVI/GATE_RUN.log"
INSERT INTO shot_jobs
  (id, "organizationId", "projectId", type, status, priority, payload, "traceId", "createdAt", "updatedAt")
VALUES
  ('$JOB_1_ID', '$TEST_ORG_ID', '$TEST_PROJECT_ID', '$JOB_TYPE', 'PENDING', 0,
   jsonb_build_object('phase','CHUNK_PARSE','traceId','trace_ctx_1','chapterId','$TEST_CHAPTER_1_ID','raw_text', \$CH1\$${CHAPTER_1_TEXT}\$CH1\$),
   'trace_ctx_1', NOW(), NOW()),
  ('$JOB_2_ID', '$TEST_ORG_ID', '$TEST_PROJECT_ID', '$JOB_TYPE', 'PENDING', 0,
   jsonb_build_object('phase','CHUNK_PARSE','traceId','trace_ctx_2','chapterId','$TEST_CHAPTER_2_ID','raw_text', \$CH2\$${CHAPTER_2_TEXT}\$CH2\$),
   'trace_ctx_2', NOW(), NOW());
SQL

# ----------------------------
# 3) Poll statuses (increased timeout)
# ----------------------------
echo "[GATE] Polling job status (120s timeout)..." | tee -a "$EVI/GATE_RUN.log"
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  JOB_1_STATUS="$(psql "$DATABASE_URL" -tAc "SELECT status FROM shot_jobs WHERE id='$JOB_1_ID';" | tr -d '[:space:]')"
  JOB_2_STATUS="$(psql "$DATABASE_URL" -tAc "SELECT status FROM shot_jobs WHERE id='$JOB_2_ID';" | tr -d '[:space:]')"

  echo "[GATE] Job status: JOB1=$JOB_1_STATUS, JOB2=$JOB_2_STATUS" | tee -a "$EVI/GATE_RUN.log"

  if [ "$JOB_1_STATUS" = "SUCCEEDED" ] && [ "$JOB_2_STATUS" = "SUCCEEDED" ]; then
    echo "[GATE] Both jobs SUCCEEDED" | tee -a "$EVI/GATE_RUN.log"
    break
  fi

  if [ "$JOB_1_STATUS" = "FAILED" ] || [ "$JOB_2_STATUS" = "FAILED" ]; then
    echo "[GATE] FAIL - Job failed" | tee -a "$EVI/GATE_RUN.log"
    psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id IN ('$JOB_1_ID', '$JOB_2_ID');" | tee -a "$EVI/GATE_RUN.log"
    exit 1
  fi

  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "[GATE] FAIL - Timeout waiting for jobs" | tee -a "$EVI/GATE_RUN.log"
  # Show logs if timeout
  psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id LIKE 'job_ctx_%' ORDER BY \"createdAt\" DESC LIMIT 5;"
  exit 1
fi

# ----------------------------
# 3.5) Persistence Pre-check (Critical V3.0 Fix)
# ----------------------------
echo "[GATE] Verifying persistence in ${SCENE_TABLE}..." | tee -a "$EVI/GATE_RUN.log"
# Hardened check: Count scenes for this project where graph_state_snapshot is actual JSON content
SCENE_RESULT=$(psql "$DATABASE_URL" -tAc "
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE graph_state_snapshot IS NOT NULL)
  FROM "${SCENE_TABLE}"
  WHERE project_id = '$TEST_PROJECT_ID';")

SCENE_TOTAL=$(echo "$SCENE_RESULT" | cut -d'|' -f1 | tr -d '[:space:]')
SCENE_WITH_DATA=$(echo "$SCENE_RESULT" | cut -d'|' -f2 | tr -d '[:space:]')

echo "[GATE] Persistence Audit: Total=$SCENE_TOTAL, WithSnapshot=$SCENE_WITH_DATA" | tee -a "$EVI/GATE_RUN.log"

if [ "$SCENE_TOTAL" -lt 2 ]; then
  echo "[GATE] FAIL - Expected at least 2 scenes in total, which is the baseline for consistency verification." | tee -a "$EVI/GATE_RUN.log"
  echo "[GATE] Dumping debug info from memory_short_term..."
  psql "$DATABASE_URL" -c "SELECT id, \"chapterId\", length(\"characterStates\"::text) as state_len FROM memory_short_term WHERE \"projectId\" = '$TEST_PROJECT_ID';" | tee -a "$EVI/GATE_RUN.log"
  exit 1
fi

if [ "$SCENE_WITH_DATA" -lt 2 ]; then
  echo "[GATE] FAIL - Success Criteria Not Met. Expected >=2 scenes with graph_state_snapshot." | tee -a "$EVI/GATE_RUN.log"
  echo "[GATE] Dumping debug info from memory_short_term..."
  psql "$DATABASE_URL" -c "SELECT id, \"chapterId\", length(\"characterStates\"::text) as state_len FROM memory_short_term WHERE \"projectId\" = '$TEST_PROJECT_ID';" | tee -a "$EVI/GATE_RUN.log"
  exit 1
fi
echo "[GATE] Persistence Pre-check PASS."

# ----------------------------
# 4) Extract snapshots
# ----------------------------
echo "[GATE] Extracting graph_state_snapshot as JSON..." | tee -a "$EVI/GATE_RUN.log"

# Fix: Use only 'id' for sort_key as scenes might miss createdAt
psql "$DATABASE_URL" -tAc "
SELECT COALESCE(
  jsonb_agg(to_jsonb(t) ORDER BY t.sort_key),
  '[]'::jsonb
)
FROM (
  SELECT
    id,
    graph_state_snapshot,
    id as sort_key
  FROM ${SCENE_TABLE}
  WHERE graph_state_snapshot IS NOT NULL
    AND project_id = '$TEST_PROJECT_ID'
  ORDER BY sort_key DESC
  LIMIT 20
) t;
" | tee "$EVI/GRAPH_STATE_SNAPSHOT.json" | tee -a "$EVI/GATE_RUN.log"

# ----------------------------
# 5) Python assertion
# ----------------------------
echo "[GATE] Validating character consistency..." | tee -a "$EVI/GATE_RUN.log"
python3 tools/gate/scripts/validate_character_consistency.py "$EVI/GRAPH_STATE_SNAPSHOT.json" \
  > "$EVI/GRAPH_STATE_DIFF.json"

if grep -q "INCONSISTENT" "$EVI/GRAPH_STATE_DIFF.json"; then
  echo "[GATE] FAIL - Character state drift detected" | tee -a "$EVI/GATE_RUN.log"
  cat "$EVI/GRAPH_STATE_DIFF.json" | tee -a "$EVI/GATE_RUN.log"
  exit 1
fi

# ----------------------------
# 6) Vector Search Info (Optional/Informational in CI)
# ----------------------------
echo "[GATE] Note: Long-term Memory retrieval is typically verified via worker trace/logs." | tee -a "$EVI/GATE_RUN.log"
if [ -f "$REPO_ROOT/logs/worker.log" ]; then
  if grep -i "Long-term=" "$REPO_ROOT/logs/worker.log" | grep -q "相似章节参考"; then
    echo "[GATE] Log Check: Vector search hit detected in worker.log" | tee -a "$EVI/GATE_RUN.log"
  fi
fi

echo "[GATE] PASS - Character states consistent across snapshots!" | tee -a "$EVI/GATE_RUN.log"
echo "[EVI] Evidence archived to: $EVI" | tee -a "$EVI/GATE_RUN.log"
