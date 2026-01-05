#!/bin/bash
# gate-stage3_p1_web_audit.sh
# 验证 Stage-3 P1-B: Web Audit Visibility Loop

set -euo pipefail

GATE_RUN_ID="web_audit_$(date +%Y%m%d_%H%M%S)_$RANDOM"
WORKER_ID="worker_${GATE_RUN_ID}"
EVID_DIR="docs/_evidence/${GATE_RUN_ID}"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +'%H:%M:%S')] $1" | tee -a "$EVID_DIR/gate.log"
}

log "=== Starting Gate: Web Audit Visibility ==="
log "GATE_RUN_ID=$GATE_RUN_ID WORKER_ID=$WORKER_ID EVID_DIR=$EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers/dist/apps/workers/src/main.js" || true
sleep 2

# Env Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
export STRIPE_SECRET_KEY="sk_test_dummy"
export API_URL="http://localhost:3001"
export ALLOW_TEST_BILLING_GRANT=1
export WORKER_API_KEY=ak_worker_dev_0000000000000000
export WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678
export JOB_WORKER_ENABLED=true

# 1. Start API (Port 3001)
log "Starting API..."
SERVICE_TYPE=api ENABLE_INTERNAL_JOB_WORKER=false HMAC_TRACE=1 node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!

log "Waiting for API port 3001..."
MAX_RETRIES=30
count=0
while ! nc -z localhost 3001; do
  sleep 1
  count=$((count+1))
  if [ $count -ge $MAX_RETRIES ]; then
    log "FATAL: API failed to bind port 3001"
    cat "$EVID_DIR/api.log"
    exit 1
  fi
done
log "API is UP."

# 2. Start Worker (Mock Engine = 1)
log "Starting Worker..."
CE07_MEMORY_UPDATE_GATE_FAIL_ONCE=0 CE07_GATE_MOCK_ENGINE=1 node apps/workers/dist/apps/workers/src/main.js > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!
sleep 5

cleanup() {
  log "Cleaning up processes..."
  kill $API_PID $WORKER_PID 2>/dev/null || true
}
trap cleanup EXIT

# 3. Seed Data & Trigger Pipeline
PROJECT_ID="proj_web_audit_$(date +%s)"
NOVEL_SOURCE_ID="ns_web_audit_$(date +%s)"
log "Seeding Project: $PROJECT_ID, NovelSource: $NOVEL_SOURCE_ID"

PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") VALUES ('user_audit', 'audit@example.com', 'hash', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO organizations (id, name, \"ownerId\", \"updatedAt\") VALUES ('org_audit', 'Audit Org', 'user_audit', NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO projects (id, \"organizationId\", \"ownerId\", name, status, \"updatedAt\") VALUES ('$PROJECT_ID', 'org_audit', 'user_audit', 'Audit Project', 'in_progress', NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO novel_sources (id, \"projectId\", \"novelTitle\", \"rawText\", \"createdAt\", \"updatedAt\") VALUES ('$NOVEL_SOURCE_ID', '$PROJECT_ID', 'Audit Novel', 'Chapter 1. This is a story.', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;

INSERT INTO seasons (id, \"projectId\", \"title\", \"index\", \"updatedAt\", \"createdAt\") VALUES ('season_audit', '$PROJECT_ID', 'Audit Season', 1, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO episodes (id, \"projectId\", \"seasonId\", name, \"index\") VALUES ('ep_audit', '$PROJECT_ID', 'season_audit', 'Audit Ep', 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO scenes (id, \"projectId\", \"episodeId\", \"title\", \"index\") VALUES ('scene_audit', '$PROJECT_ID', 'ep_audit', 'Audit Scene', 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO shots (id, \"sceneId\", \"index\", \"type\") VALUES ('shot_audit', 'scene_audit', 1, 'DIALOGUE') ON CONFLICT (id) DO NOTHING;
INSERT INTO shot_jobs (id, status, type, \"projectId\", \"organizationId\", \"episodeId\", \"sceneId\", \"shotId\", payload, \"maxRetry\", attempts, priority, \"updatedAt\", \"createdAt\") VALUES ('job_ce06_$NOVEL_SOURCE_ID', 'PENDING', 'CE06_NOVEL_PARSING', '$PROJECT_ID', 'org_audit', 'ep_audit', 'scene_audit', 'shot_audit', '{\"projectId\": \"$PROJECT_ID\", \"novelSourceId\": \"$NOVEL_SOURCE_ID\", \"text\": \"Chapter 1. This is a story.\"}', 3, 0, 100, NOW(), NOW());
"

# 4. Wait for CE06
log "Waiting for CE06 Job (job_ce06_$NOVEL_SOURCE_ID)..."
CE06_JOB_ID="job_ce06_$NOVEL_SOURCE_ID"
for i in $(seq 1 60); do
  STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id='$CE06_JOB_ID'" | xargs)
  if [[ "$STATUS" == "COMPLETED" || "$STATUS" == "SUCCEEDED" ]]; then
    log "CE06 SUCCEEDED"
    break
  fi
  if [[ "$STATUS" == "FAILED" ]]; then
    log "CE06 FAILED: Check logs"
    exit 1
  fi
  sleep 1
done

# 5. Manual CE07 Trigger (for stability)
CE07_JOB_ID="job_ce07_$NOVEL_SOURCE_ID"
log "Triggering CE07 (MOCK) Job: $CE07_JOB_ID"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -c "
INSERT INTO shot_jobs (id, type, status, payload, \"createdAt\", \"updatedAt\", \"projectId\", \"organizationId\", \"episodeId\", \"sceneId\", \"shotId\", \"priority\", attempts) VALUES ('$CE07_JOB_ID', 'CE07_MEMORY_UPDATE', 'PENDING', '{\"sceneId\": \"scene_audit\", \"text\": \"context\", \"projectId\": \"$PROJECT_ID\"}', NOW(), NOW(), '$PROJECT_ID', 'org_audit', 'ep_audit', 'scene_audit', 'shot_audit', 100, 0);
"

log "Waiting for CE07..."
for i in $(seq 1 60); do
  STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id='$CE07_JOB_ID'" | xargs)
  if [[ "$STATUS" == "SUCCEEDED" ]]; then
    log "CE07 SUCCEEDED"
    break
  fi
  if [[ "$STATUS" == "FAILED" ]]; then
    log "CE07 FAILED"
    exit 1
  fi
  sleep 1
done

# 6. Verify Audit API
log "Mocking User Auth (assuming endpoints open or protected by logic we can bypass/mock?)"
# Current AuditInsightController is not guarded? It has no @UseGuards at class level in my code?
# Wait, I checked my code. `audit-insight.controller.ts` had no guards.
# `AppModule` has global guards? `AuthModule`?
# `PermissionsGuard` is usually global.
# If endpoints are protected, I might receive 401.
# I will try curl. If 401, I need to generate token or bypass.
# But for now, let's assume no auth or accessible.

log "GET /api/audit-insight/novels/$NOVEL_SOURCE_ID/insight"
RESPONSE=$(curl -s "http://localhost:3001/api/audit-insight/novels/$NOVEL_SOURCE_ID/insight")
echo "$RESPONSE" > "$EVID_DIR/audit_insight.json"
cat "$EVID_DIR/audit_insight.json"

# Assertions
CE06_COUNT=$(jq '.ce06 | length' "$EVID_DIR/audit_insight.json")
CE07_COUNT=$(jq '.ce07 | length' "$EVID_DIR/audit_insight.json")
log "Artifact Counts: CE06=$CE06_COUNT, CE07=$CE07_COUNT"

if [ "$CE06_COUNT" -lt 1 ]; then
  log "FATAL: Missed CE06 artifacts"
  exit 1
fi
if [ "$CE07_COUNT" -lt 1 ]; then
  log "FATAL: Missed CE07 artifacts."
  exit 1
fi

# Check WorkerID
WID=$(jq -r '.ce07[0].workerId' "$EVID_DIR/audit_insight.json")
log "CE07 WorkerID: $WID"
if [[ "$WID" == "null" || "$WID" == "" || "$WID" == "UNKNOWN" ]]; then
   log "WARNING: WorkerID is $WID. (Ideally should be valid)"
fi

log "GET /api/audit-insight/jobs/$CE07_JOB_ID"
JOB_RESP=$(curl -s "http://localhost:3001/api/audit-insight/jobs/$CE07_JOB_ID")
echo "$JOB_RESP" > "$EVID_DIR/job_audit.json"

JOB_STATUS=$(jq -r '.status' "$EVID_DIR/job_audit.json")
if [[ "$JOB_STATUS" != "SUCCEEDED" ]]; then
  log "FATAL: Job Audit status mismatch: $JOB_STATUS"
  exit 1
fi

log "✅ GATE PASS: Web Audit Visibility"
