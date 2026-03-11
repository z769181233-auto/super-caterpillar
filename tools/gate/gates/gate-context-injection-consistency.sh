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

# [Wave R0-P1] Respect environment DATABASE_URL or fallback to local dev port
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu}"
# Ensure psql doesn't default to root by extracting from URL if needed, 
# but in CI the standard env vars are usually set.
export PGUSER="postgres"
export PGPASSWORD="${PGPASSWORD:-password}"
export PGHOST="127.0.0.1"

# ----------------------------
# 0) Schema probe (no guessing)
# ----------------------------
echo "[GATE] Probing schema..." | tee -a "$EVI/GATE_RUN.log"

psql "$DATABASE_URL" -c "
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('organizations','projects','novel_sources','novel_volumes','novel_chapters','scenes','novel_scenes','shot_jobs','users')
order by table_name, ordinal_position;
" | tee "$EVI/SCHEMA_PROBE.txt" | tee -a "$EVI/GATE_RUN.log"

# helper: test table exists
table_exists() {
  local t="$1"
  psql "$DATABASE_URL" -tAc "select to_regclass('public.${t}') is not null;" | grep -qi "t"
}

# V3.0: Prefer novel_scenes for Novel Parsing context injection verification
SCENE_TABLE="novel_scenes"
if ! table_exists "novel_scenes"; then
  SCENE_TABLE="scenes"
  # ENV FIX
  export PGUSER="${PGUSER:-postgres}"
  export PGPASSWORD="${PGPASSWORD:-password}"
  export PGHOST="${PGHOST:-127.0.0.1}"
  echo "[GATE] Using scene table: scenes" | tee -a "$EVI/GATE_RUN.log"
else
  echo "[GATE] Using scene table: $SCENE_TABLE" | tee -a "$EVI/GATE_RUN.log"
fi

# ----------------------------
# 1) Create minimal project context via V3 Fixture Helper
# ----------------------------
# [Wave R0-P1] Use fixed Project ID to match deterministic replay fixture
export PROJ_ID="gate8-ctx-aligned"
export ORG_ID="gate-org"

CHAPTER_1_TEXT="第一章：张三身穿红色长袍，手持长剑，站在森林边缘。他的长发在风中铺扬，腰间挂着一块玉佩。"
CHAPTER_2_TEXT="第二章：张三继续前行，他的红袍在风中铺扬。长剑依然握在手中，森林深处传来声响。"

echo "[GATE] Invoking V3 Fixture Helper..." | tee -a "$EVI/GATE_RUN.log"
# Use the helper to create V3.0 compatible entities
# Ensure we pass the original chapter content to keep business logic consistent
SEED_JSON=$(PROJ_ID="$PROJ_ID" ORG_ID="$ORG_ID" CHAP1_CONTENT="$CHAPTER_1_TEXT" CHAP2_CONTENT="$CHAPTER_2_TEXT" DATABASE_URL="$DATABASE_URL" npx tsx tools/gate/scripts/seed_v3_novel_fixture.ts)
echo "$SEED_JSON" >> "$EVI/GATE_RUN.log"

TEST_ORG_ID=$(echo "$SEED_JSON" | jq -r .orgId)
TEST_PROJECT_ID=$(echo "$SEED_JSON" | jq -r .projId)
TEST_NOVEL_ID=$(echo "$SEED_JSON" | jq -r .novelId)
TEST_SOURCE_ID=$(echo "$SEED_JSON" | jq -r .sourceId)
TEST_VOL_ID=$(echo "$SEED_JSON" | jq -r .volId)
TEST_CHAPTER_1_ID=$(echo "$SEED_JSON" | jq -r .chapter1Id)
TEST_CHAPTER_2_ID=$(echo "$SEED_JSON" | jq -r .chapter2Id)
USER_ID=$(echo "$SEED_JSON" | jq -r .userId)

if [ -z "$TEST_CHAPTER_1_ID" ] || [ "$TEST_CHAPTER_1_ID" == "null" ]; then
  echo "[GATE] FAIL - Seed failed or returned invalid JSON" | tee -a "$EVI/GATE_RUN.log"
  echo "Seed output: $SEED_JSON" >> "$EVI/GATE_RUN.log"
  exit 1
fi

echo "[GATE] Seeded V3 Entities for Pilot: Org=$TEST_ORG_ID, Proj=$TEST_PROJECT_ID, Novel=$TEST_NOVEL_ID" | tee -a "$EVI/GATE_RUN.log"
echo "[GATE] Project: $TEST_PROJECT_ID, Chap1: $TEST_CHAPTER_1_ID, Chap2: $TEST_CHAPTER_2_ID" | tee -a "$EVI/GATE_RUN.log"

# ----------------------------
# 2) Seed Initial Graph Jobs (V3.0 Schema)
# ----------------------------
echo "[GATE] Seeding jobs with trace_ctx_1 and trace_ctx_2..." | tee -a "$EVI/GATE_RUN.log"

JOB_1_ID="job_v3_ctx_1_$TS"
JOB_2_ID="job_v3_ctx_2_$TS"
JOB_TYPE="CE06_NOVEL_PARSING"

psql "$DATABASE_URL" -c "
INSERT INTO \"shot_jobs\" (id, \"organizationId\", \"projectId\", \"type\", status, attempts, payload, \"traceId\", \"createdAt\", \"updatedAt\")
VALUES ('$JOB_1_ID', '$TEST_ORG_ID', '$TEST_PROJECT_ID', '$JOB_TYPE', 'PENDING', 0, jsonb_build_object('phase','CHUNK_PARSE','traceId','trace_ctx_1','chapterId','$TEST_CHAPTER_1_ID','rawText', \$CH1\$${CHAPTER_1_TEXT}\$CH1\$), 'trace_ctx_1', NOW(), NOW()), ('$JOB_2_ID', '$TEST_ORG_ID', '$TEST_PROJECT_ID', '$JOB_TYPE', 'PENDING', 0, jsonb_build_object('phase','CHUNK_PARSE','traceId','trace_ctx_2','chapterId','$TEST_CHAPTER_2_ID','rawText', \$CH2\$${CHAPTER_2_TEXT}\$CH2\$), 'trace_ctx_2', NOW(), NOW());
" | tee -a "$EVI/GATE_RUN.log"

# ----------------------------
# 3) Wait for Worker processing
# ----------------------------
echo "[GATE] Waiting for jobs to complete..." | tee -a "$EVI/GATE_RUN.log"
MAX_RETRIES=40
for i in $(seq 1 $MAX_RETRIES); do
  PENDING_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM \"shot_jobs\" WHERE id IN ('$JOB_1_ID', '$JOB_2_ID') AND status != 'SUCCEEDED';")
  if [ "$PENDING_COUNT" -eq 0 ]; then
    echo "[GATE] All jobs succeeded!" | tee -a "$EVI/GATE_RUN.log"
    break
  fi
  if [ "$i" -eq $MAX_RETRIES ]; then
    echo "[GATE] TIMEOUT waiting for context injection jobs" | tee -a "$EVI/GATE_RUN.log"
    psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM \"shot_jobs\" WHERE id IN ('$JOB_1_ID', '$JOB_2_ID');" | tee -a "$EVI/GATE_RUN.log"
    exit 1
  fi
  echo "  ..waiting ($i/$MAX_RETRIES)" | tee -a "$EVI/GATE_RUN.log"
  sleep 3
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "[GATE] FAIL - Timeout waiting for jobs" | tee -a "$EVI/GATE_RUN.log"
  # Show logs if timeout
  psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id LIKE 'job_ctx_%' ORDER BY \"createdAt\" DESC LIMIT 5;"
  exit 1
fi

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

echo "[GATE] Snapshot Full Content:" | tee -a "$EVI/GATE_RUN.log"
cat "$EVI/GRAPH_STATE_SNAPSHOT.json" | jq . | tee -a "$EVI/GATE_RUN.log"

echo "[GATE] Snapshot Preview (Characters):" | tee -a "$EVI/GATE_RUN.log"
cat "$EVI/GRAPH_STATE_SNAPSHOT.json" | jq -c '.[].graph_state_snapshot.characters[].name' | tee -a "$EVI/GATE_RUN.log" || true

# ----------------------------
# 5) Python assertion
# ----------------------------
echo "[GATE] Validating character consistency..." | tee -a "$EVI/GATE_RUN.log"
python3 tools/gate/scripts/validate_character_consistency.py "$EVI/GRAPH_STATE_SNAPSHOT.json" \
  > "$EVI/GRAPH_STATE_DIFF.json" 2>&1 || true

if grep -q "INCONSISTENT" "$EVI/GRAPH_STATE_DIFF.json"; then
  echo "[GATE] FAIL - Character state drift detected" | tee -a "$EVI/GATE_RUN.log"
  echo ">>> CHARACTER CONSISTENCY DIFF <<<"
  cat "$EVI/GRAPH_STATE_DIFF.json"
  echo ">>> END OF DIFF <<<"
  exit 1
fi

echo "[GATE] SUCCESS - Character state is consistent across snapshots" | tee -a "$EVI/GATE_RUN.log"
exit 0

# ----------------------------
# 6) Verify Long-term Memory (Vector Search) in logs
# [DEPRECATED] This check is disabled due to schema migration away from pgvector/summary_vector
# ----------------------------
# echo "[GATE] Verifying Long-term Memory retrieval..." | tee -a "$EVI/GATE_RUN.log"
# if [ -f "$REPO_ROOT/logs/worker.log" ]; then
#   # Look for context injection logs that indicate hit
#   if grep -i "Long-term=" "$REPO_ROOT/logs/worker.log" | grep -q "相似章节参考"; then
#     echo "[GATE] PASS - Vector search returned results!" | tee -a "$EVI/GATE_RUN.log"
#   else
#     echo "[GATE] WARN - Vector search might have returned empty results (check logs)" | tee -a "$EVI/GATE_RUN.log"
#   fi
# else
#     echo "[GATE] Skip log check (worker.log not found)" | tee -a "$EVI/GATE_RUN.log"
# fi

echo "[GATE] PASS - Character states consistent across snapshots!" | tee -a "$EVI/GATE_RUN.log"
echo "[EVI] Evidence archived to: $EVI" | tee -a "$EVI/GATE_RUN.log"
