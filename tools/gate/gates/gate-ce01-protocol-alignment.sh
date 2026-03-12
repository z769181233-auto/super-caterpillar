#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# GATE 13: CE01 Protocol Alignment
# Goal: Verify Bible V3.0 Protocol (text_chunk, prev_context) maps to Production DB (scenes) without data loss.

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
TS="$(date +%Y%m%d_%H%M%S)"
EVI="docs/_evidence/gate13_ce01_${TS}"
mkdir -p "$EVI"

TRACE="trace_ce01_${TS}"
JOB_ID="job_gate13_${TS}"
ORG_ID="org-gate"
PROJ_ID="proj_gate13_${TS}"

echo "[GATE13] Starting CE01 Verification at ${TS}..."
echo "[GATE13] Evidence Dir: ${EVI}"

# 1) Prepare Bible Input (Canonical V3.0 Payload)
cat > "$EVI/ce01_input.json" <<JSON
{
  "text_chunk": "Gate 13 Test Chapter. Hero walks into the tavern.",
  "prev_context": "Summary: Hero is wearing red robes and carrying a sword.",
  "traceId": "${TRACE}"
}
JSON
echo "[GATE13] Bible Payload Prepared:"
cat "$EVI/ce01_input.json"

# 2) Seed User & Project
# Ensure User exists
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO users(id, email, \"passwordHash\", \"userType\", role, tier, quota, \"defaultOrganizationId\", \"createdAt\", \"updatedAt\")
VALUES ('user-gate', 'gate@scu.com', 'hash', 'admin', 'ADMIN', 'Free', '{}'::jsonb, '${ORG_ID}', now(), now())
ON CONFLICT (id) DO NOTHING;
" > "$EVI/db_seed_user.txt" 2>&1 || (echo "User Seed Failed:"; cat "$EVI/db_seed_user.txt"; exit 1)

# Ensure Project exists
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO projects(id, name, description, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\")
VALUES ('${PROJ_ID}', 'gate13-ce01', 'gate13 verification', 'user-gate', '${ORG_ID}', 'in_progress', now(), now())
ON CONFLICT (id) DO NOTHING;
" > "$EVI/db_seed_project.txt" 2>&1 || (echo "Project Seed Failed:"; cat "$EVI/db_seed_project.txt"; exit 1)

# Ensure Novel Source exists
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novel_sources(id, \"projectId\", \"organizationId\", \"rawText\", \"fileName\", \"fileKey\", \"fileSize\", \"createdAt\", \"updatedAt\")
VALUES ('src_${PROJ_ID}', '${PROJ_ID}', '${ORG_ID}', 'Dummy Content for Gate 13', 'gate13_dummy.txt', '${PROJ_ID}/gate13.txt', 1024, now(), now())
ON CONFLICT (id) DO NOTHING;
" > "$EVI/db_seed_source.txt" 2>&1 || (echo "NovelSource Seed Failed:"; cat "$EVI/db_seed_source.txt"; exit 1)

# Ensure Novel (Canonical Tier) exists for CE06 Processor Lookup
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO novels(id, project_id, title, author, organization_id, raw_file_url, total_tokens, status, file_name, file_size, file_type, character_count, chapter_count, created_at, updated_at)
VALUES ('nov_${PROJ_ID}', '${PROJ_ID}', 'Gate13 Validated Novel', 'Gate', '${ORG_ID}', '${PROJ_ID}/gate13.txt', 0, 'UPLOADED', 'gate13_dummy.txt', 1024, 'text/plain', 1000, 1, now(), now())
ON CONFLICT (project_id) DO NOTHING;
" > "$EVI/db_seed_novel.txt" 2>&1 || (echo "Novel Seed Failed:"; cat "$EVI/db_seed_novel.txt"; exit 1)

echo "[GATE13] Project & Source Seeded."

# 3) Insert Job via Adapter Compatibility Mode
# Note: We insert the raw Bible payload. The CE06 Processor must normalize it via Adapter.
# We construct the payload manually using JSON string because we might not have pg_read_file permission.
# We simulate a CE06_NOVEL_PARSING job which receives this payload.

PAYLOAD_JSON=$(cat "$EVI/ce01_input.json")

# Escape single quotes for SQL
PAYLOAD_SQL=$(echo "$PAYLOAD_JSON" | sed "s/'/''/g")

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO shot_jobs(
  id, \"organizationId\", \"projectId\", status, type, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\"
) VALUES (
  '${JOB_ID}', '${ORG_ID}', '${PROJ_ID}', 'PENDING', 'CE06_NOVEL_PARSING', 5,
  '${PAYLOAD_SQL}'::jsonb,
  now(), now(), '${TRACE}'
);
" > "$EVI/db_insert_job.txt" 2>&1 || (echo "Job Insert Failed:"; cat "$EVI/db_insert_job.txt"; exit 1)

echo "[GATE13] Job Inserted (Type: CE06_NOVEL_PARSING). Waiting for Processor..."

# 4) Poll Job Status
MAX_RETRIES=60
count=0
while [ $count -lt $MAX_RETRIES ]; do
  status=$(psql "$DATABASE_URL" -t -A -c "SELECT status FROM shot_jobs WHERE id='${JOB_ID}';")
  echo "Poll [$count/$MAX_RETRIES] Status: $status" | tee -a "$EVI/poll_job_status.log"
  
  if [[ "$status" == "SUCCEEDED" ]]; then
    echo "[GATE13] Parent Job SUCCEEDED. Waiting for child jobs (CHUNK_PARSE)..."
    for j in {0..30}; do
      child_count=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJ_ID}' AND status IN ('PENDING', 'RUNNING', 'RETRYING');")
      if [ "$child_count" == "0" ]; then
        echo "[GATE13] All jobs in project finished."
        break
      fi
      echo "Waiting for child jobs... ($child_count remaining)"
      sleep 2
    done
    break
  fi
  
  if [[ "$status" == "FAILED" ]]; then
    echo "[GATE13] Job FAILED."
    psql "$DATABASE_URL" -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id='${JOB_ID}';" | tee "$EVI/job_failed_detail.txt"
    exit 1
  fi
  
  sleep 2
  count=$((count + 1))
done

if [ $count -eq $MAX_RETRIES ]; then
  echo "[GATE13] Timeout waiting for job."
  exit 1
fi

# 5) DB Assertion: Verify Persistence (Job Topology Printout)
echo "[GATE13] Dumping raw job topology for project..."

psql "$DATABASE_URL" -c "
SELECT id, type, status, \"traceId\", \"createdAt\", payload
FROM shot_jobs
WHERE \"projectId\"='${PROJ_ID}'
ORDER BY \"createdAt\" ASC;
" > "$EVI/jobs_topology.txt"

cat "$EVI/jobs_topology.txt"

# 5.1 Temporary soft-assert to check if text_chunk exists anywhere in the payload dumps
if grep -q "Hero walks into the tavern" "$EVI/jobs_topology.txt"; then
  echo "✅ PASS: text_chunk found SOMEWHERE in the job topology."
else
  echo "⚠️ WARN: text_chunk NOT FOUND in any job payload dump. (Topology captured for review)"
fi

# We intentionally exit 1 here during Phase C-R17 to force the CI to halt and show us the logs
# without falsely signaling a complete pass before we lock the true assertion rules in V6.
echo "❌ FAIL: Halting Gate 13 for C-R17 Job Topology Review."
exit 1

# 5.2 Assert 'prev_context' propagation
if grep -q "red robes" "$EVI/jobs_rows.txt"; then
  echo "✅ PASS: prev_context logic trace found in DB."
else
  echo "⚠️ WARN: prev_context not implicitly tracked in child job payload. (SCAN adapter drops it or Mock mode used)."
fi

# 6) Artifact Pointers
cat > "$EVI/ARTIFACTS_POINTERS.txt" <<TXT
Gate13 CE01 Protocol Alignment
TRACE=${TRACE}
JOB_ID=${JOB_ID}
EVI=${EVI}
- ce01_input.json
- poll_job_status.log
- scenes_rows.txt
TXT

(
  cd "$EVI"
  shasum -a 256 * > SHA256SUMS.txt
  shasum -a 256 -c SHA256SUMS.txt > shasum_check.log
)

echo "[GATE13] SHA256 Verification:"
cat "$EVI/shasum_check.log"

echo "🏆 GATE13 PASS: CE01 Protocol Aligned."
