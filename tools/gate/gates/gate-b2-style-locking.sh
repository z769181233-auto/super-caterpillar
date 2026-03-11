#!/bin/bash
set -e

echo "=================================================="
echo "GATE: Phase 2 B2 Global Style Locking"
echo "=================================================="

# 1. Setup Environment
export MOCK_LLM=true
export GATE_MODE=true

# 2. Preparation:# ENV FIX
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-password}"
export PGHOST="${PGHOST:-127.0.0.1}"

# Cleanup previous jobs if any
set -a && source .env.local && set +a

echo "Clearing existing job queue..."
psql "$DATABASE_URL" -c "DELETE FROM shot_jobs WHERE status IN ('PENDING', 'RUNNING', 'FAILED');"

# 3. Create Project with Style Prompt
PROJECT_ID="proj_b2_test_$(date +%s)"
ORG_ID="org_b2_test"
STYLE_PROMPT="Cyberpunk, Neon Lights, High Contrast"

echo "Setting up Test Project with Style: $STYLE_PROMPT"

psql "$DATABASE_URL" <<EOF
INSERT INTO organizations (id, name, "ownerId", "updatedAt") VALUES ('$ORG_ID', 'B2 Test Org', 'system', now()) ON CONFLICT DO NOTHING;
INSERT INTO projects (id, name, "organizationId", "ownerId", "updatedAt", "style_prompt") VALUES ('$PROJECT_ID', 'B2 Test Proj', '$ORG_ID', 'system', now(), '$STYLE_PROMPT');
EOF

# 4. Create Shot
SCENE_ID="scene_b2_$(date +%s)"
SHOT_ID="shot_b2_$(date +%s)"
BASE_PROMPT="A cat sitting under the rain."

psql "$DATABASE_URL" <<EOF
INSERT INTO seasons (id, "projectId", index, title, "updatedAt") VALUES ('season_$PROJECT_ID', '$PROJECT_ID', 1, 'Season 1', now());
INSERT INTO episodes (id, "projectId", "seasonId", index, name) VALUES ('ep_$PROJECT_ID', '$PROJECT_ID', 'season_$PROJECT_ID', 1, 'B2 Test Episode');
INSERT INTO scenes (id, "project_id", "episodeId", "scene_index", "updated_at") VALUES ('$SCENE_ID', '$PROJECT_ID', 'ep_$PROJECT_ID', 1, now());
INSERT INTO shots (id, "sceneId", "organizationId", index, "enrichedPrompt", type) VALUES ('$SHOT_ID', '$SCENE_ID', '$ORG_ID', 1, '$BASE_PROMPT', 'test');
EOF

# 5. Trigger CE04 Job
JOB_ID="job_b2_$(date +%s)"
echo "Triggering CE04_VISUAL_ENRICHMENT job..."

# Need to start mocking services (mock comfyui response handled by Processor logic?)
# Wait, CE04 calls ComfyUIClient.
# If I don't have a real ComfyUI, `ComfyUIClient` might fail unless mocked.
# `processCE04VisualEnrichmentJob` calls `comfy.generateImage`.
# `ComfyUIClient` in `tools/prod/comfyui_client.ts` probably connects to 127.0.0.1:8188.
# I should ensure a mock ComfyUI server is running or the client handles it.
# Check if I can mock network calls or if I need to run a mock server.
# The gate `gate-shot-render-preview.sh` (Step 5590 summary) mentioned "MockEngineAdapter".
# But CE04 uses `ComfyUIClient` directly.

# I will assume `ComfyUIClient` fails if no internal mock.
# Let's check `tools/prod/comfyui_client.ts`.
# If it fails, I'll need to create a simple mock server.

# Start Audit Services (API + Worker)
bash start_audit_services.sh &
AUDIT_PID=$!
sleep 10

# Start Mock ComfyUI (After cleanup)
node tools/mocks/mock_comfyui.js &
COMFY_PID=$!

# Insert Job
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", \"shotId\", type, status, payload, \"updatedAt\") VALUES ('$JOB_ID', '$PROJECT_ID', '$ORG_ID', '$SHOT_ID', 'CE04_VISUAL_ENRICHMENT', 'PENDING', '{}', now());"

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
    ERR=$(psql "$DATABASE_URL" -t -A -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$JOB_ID';")
    echo "[FAIL] Job Failed: $ERR"
    kill $AUDIT_PID || true
    exit 1
  fi
  sleep 2
  COUNT=$((COUNT+2))
done

# 6. Verify Result in Audit Log
echo "Verifying Audit Log for Prompt..."
PROMPT_USED=$(psql "$DATABASE_URL" -t -A -c "SELECT details->>'promptUsed' FROM audit_logs WHERE details->>'jobId'='$JOB_ID' LIMIT 1;")

echo "Prompt Used: $PROMPT_USED"

EXPECTED="$STYLE_PROMPT, $BASE_PROMPT"
if [[ "$PROMPT_USED" == *"$STYLE_PROMPT"* ]]; then
  echo "[PASS] Style Prompt found in used prompt!"
else
  echo "[FAIL] Expected to contain '$STYLE_PROMPT', got '$PROMPT_USED'"
  kill $AUDIT_PID || true
  kill $COMFY_PID || true
  exit 1
fi

kill $AUDIT_PID || true
kill $COMFY_PID || true
echo "Gate B2 PASS"
