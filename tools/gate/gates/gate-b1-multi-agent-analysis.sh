#!/bin/bash
set -e

echo "=================================================="
echo "GATE: Phase 2 B1 Multi-Agent Integration"
echo "=================================================="

# 1. Setup Environment
export USE_MULTI_AGENT=true
export MOCK_LLM=true
export GATE_MODE=true

# 2. Preparation: Clear existing jobs and prepare file
set -a && source .env.local && set +a

echo "Clearing existing job queue..."
psql "$DATABASE_URL" -c "DELETE FROM shot_jobs WHERE status IN ('PENDING', 'RUNNING', 'FAILED');"

STORAGE_ROOT="${STORAGE_ROOT:-.data/storage}"
mkdir -p "$STORAGE_ROOT/uploads"
SRC_FILE="tools/gate/data/wangu_shendi_15m.txt"
if [ -f "$SRC_FILE" ]; then
  cp "$SRC_FILE" "$STORAGE_ROOT/uploads/wangu_shendi_15m.txt"
else
  echo "李傲天走进幽静的山谷，四周寂静无声。" > "$STORAGE_ROOT/uploads/wangu_shendi_15m.txt"
fi

# 3. Create a dummy project and episode
PROJECT_ID="proj_b1_test_$(date +%s)"
ORG_ID="org_b1_test"
EPISODE_ID="ep_b1_test_$(date +%s)"

echo "Setting up Test Project: $PROJECT_ID"
set -a && source .env.local && set +a

psql "$DATABASE_URL" <<EOF
INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES ('$ORG_ID', 'B1 Test Org', 'system', now()) ON CONFLICT DO NOTHING;
INSERT INTO projects (id, name, "organizationId", "ownerId", "updatedAt") VALUES ('$PROJECT_ID', 'B1 Test Proj', '$ORG_ID', 'system', now());
INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES ('season_$PROJECT_ID', '$PROJECT_ID', 1, 'Season 1', now());
INSERT INTO novel_sources (id, "projectId", "organizationId", "totalChapters", status, "fileKey", "fileName", "fileSize", "updatedAt") VALUES ('ns_$PROJECT_ID', '$PROJECT_ID', '$ORG_ID', 1, 'PARSING', 'uploads/wangu_shendi_15m.txt', 'wangu.txt', 100, now());
INSERT INTO episodes (id, "projectId", "seasonId", index, name) VALUES ('$EPISODE_ID', '$PROJECT_ID', 'season_$PROJECT_ID', 1, 'B1 Test Episode');
EOF

# 3. Trigger Job manually (Mocking the queue)
echo "Triggering NOVEL_CHUNK_PARSE job..."
# Note: We call the worker code directly or via a mock job in DB
# For this gate, we will run start_audit_services.sh then insert a job into DB.

bash start_audit_services.sh &
AUDIT_PID=$!

sleep 12 # Wait for services to start

# Insert job
JOB_ID="job_b1_$(date +%s)"
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", \"episodeId\", type, status, payload, \"updatedAt\") VALUES ('$JOB_ID', '$PROJECT_ID', '$ORG_ID', '$EPISODE_ID', 'NOVEL_CHUNK_PARSE', 'PENDING', '{\"projectId\": \"$PROJECT_ID\", \"episodeId\": \"$EPISODE_ID\", \"startByte\": 0, \"endByte\": 100, \"fileKey\": \"uploads/wangu_shendi_15m.txt\"}', now());"

echo "Waiting for Job completion..."
MAX_WAIT=60
COUNT=0
while [ $COUNT -lt $MAX_WAIT ]; do
  STATUS=$(psql "$DATABASE_URL" -t -A -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';")
  echo "  Job Status: $STATUS"
  if [ "$STATUS" == "SUCCEEDED" ]; then
    break
  fi
  if [ "$STATUS" == "FAILED" ]; then
    echo "[FAIL] Job Failed."
    kill $AUDIT_PID || true
    exit 1
  fi
  sleep 2
  COUNT=$((COUNT+2))
done

# 4. Verify Results
echo "Verifying DB Artifacts..."
SHOT_VALS=$(psql "$DATABASE_URL" -t -A -c "SELECT shot_type, camera_movement, lighting_preset FROM shots WHERE \"sceneId\" IN (SELECT id FROM scenes WHERE \"episodeId\"='$EPISODE_ID') LIMIT 1;")

echo "Resulting Shot Details: $SHOT_VALS"

if [[ "$SHOT_VALS" == "FULL_SHOT|PAN|NATURAL" ]]; then
  echo "[PASS] Multi-Agent visual parameters correctly persisted to DB!"
else
  echo "[FAIL] DB parameters mismatch. Expected FULL_SHOT|PAN|NATURAL, got $SHOT_VALS"
  kill $AUDIT_PID || true
  exit 1
fi

# 5. Cleanup
kill $AUDIT_PID || true
echo "Gate B1 PASS"
