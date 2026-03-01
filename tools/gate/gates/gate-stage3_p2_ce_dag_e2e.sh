#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr EVID_DIR="docs/_evidence/p2_ce_dag_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_CE_DAG_E2E] Starting Gate (RUN_ID: $RUN_ID)..."
log "🧹 Cleaning up old processes..."
pkill -f pkill -f pkill -f sleep 2

log "🔌 Starting API..."
pnpm -w turbo run dev --filter=api > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 2

# Wait for API ready
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    log "API listening on 3001"
    break
  fi
  sleep 1
done

log "👷 Starting Worker..."
pnpm -w turbo run dev --filter=@scu/worker > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

sleep 4

# Cleanup on exit
trap "log 
log "🌱 Seeding Project (RUN_ID: $RUN_ID)..."
PROJECT_NAME="P2_CE_DAG_E2E_${TS}"
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO projects (id, \"organizationId\", name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO seasons (id, \"projectId\", title, \"index\", \"updatedAt\") 
VALUES (
INSERT INTO episodes (id, \"seasonId\", \"index\", \"name\") 
VALUES (
INSERT INTO scenes (id, \"episodeId\", \"index\", \"title\", \"summary\") 
VALUES (

INSERT INTO shots (id, \"sceneId\", \"index\", type, params) 
VALUES (
INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"updatedAt\")
VALUES (


INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
(((ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, \"isActive\" = true;

INSERT INTO engine_versions (id, \"engineId\", \"versionName\", config, enabled, \"createdAt\", \"updatedAt\")
VALUES 
(((ON CONFLICT (\"engineId\", \"versionName\") DO NOTHING;

INSERT INTO api_keys (id, \"key\", \"secretHash\", \"updatedAt\")
VALUES (ON CONFLICT DO NOTHING;

"

log "✅ Data Seeded (PROJ_ID: $PROJ_ID, SHOT_ID: $SHOT_ID, SOURCE_ID: $SOURCE_ID)"

log "🎬 Triggering CE DAG E2E..."
DAG_OUT=$(PROJ_ID="$PROJ_ID" SOURCE_ID="$SOURCE_ID" SHOT_ID="$SHOT_ID" API_BASE="http://localhost:3001" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_ce_dag_gate.ts 2>&1)

echo "$DAG_OUT" | tee "$EVID_DIR/dag_trigger.log"

TRACE_ID=$(echo "$DAG_OUT" | grep "TRACE_ID=" | cut -d= -f2)
CE06_JOB_ID=$(echo "$DAG_OUT" | grep "CE06_JOB_ID=" | cut -d= -f2)
CE03_JOB_ID=$(echo "$DAG_OUT" | grep "CE03_JOB_ID=" | cut -d= -f2)
CE04_JOB_ID=$(echo "$DAG_OUT" | grep "CE04_JOB_ID=" | cut -d= -f2)

if [ -z "$TRACE_ID" ] || [ -z "$CE06_JOB_ID" ] || [ -z "$CE03_JOB_ID" ] || [ -z "$CE04_JOB_ID" ]; then
  log "❌ Failed to extract job IDs from DAG trigger output"
  exit 1
fi

log "   TRACE_ID: $TRACE_ID"
log "   CE06_JOB_ID: $CE06_JOB_ID"
log "   CE03_JOB_ID: $CE03_JOB_ID"
log "   CE04_JOB_ID: $CE04_JOB_ID"

log "⏳ Waiting for jobs to complete..."
for i in {1..60}; do
  CE06_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE03_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE04_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id= # $gate$
  log "   [CE06] $CE06_STATUS | [CE03] $CE03_STATUS | [CE04] $CE04_STATUS"

  if [ "$CE06_STATUS" = "SUCCEEDED" ] && [ "$CE03_STATUS" = "SUCCEEDED" ] && [ "$CE04_STATUS" = "SUCCEEDED" ]; then
    log "✅ All jobs SUCCEEDED"
    break
  fi

  if [ "$CE06_STATUS" = "FAILED" ] || [ "$CE03_STATUS" = "FAILED" ] || [ "$CE04_STATUS" = "FAILED" ]; then
    log "❌ At least one job FAILED"
    psql -d scu -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id IN (    exit 1
  fi

  sleep 2
done

log "🔍 Verifying DB with precise projectId+engine+jobId+traceId binding..."

# CE03: Bind by projectId + engine + jobId + traceId
CE03_SCORE=$(psql -d scu -t -c "SELECT qm.\"visualDensityScore\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE03] Density Score: $CE03_SCORE (TraceID: $TRACE_ID, JobID: $CE03_JOB_ID)" # $gate$

if [ -n "$CE03_SCORE" ] && [ "$CE03_SCORE" != "null" ] && (( $(echo "$CE03_SCORE > 0" | bc -l) )); then
    log "✅ CE03 Valid (score: $CE03_SCORE > 0)"
else
    log "❌ CE03 Invalid: expected > 0, got     exit 1
fi

# CE04: Bind by projectId + engine + jobId + traceId
CE04_SCORE=$(psql -d scu -t -c "SELECT qm.\"enrichmentQuality\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE04] Enrichment Quality: $CE04_SCORE (TraceID: $TRACE_ID, JobID: $CE04_JOB_ID)" # $gate$

if [ -n "$CE04_SCORE" ] && [ "$CE04_SCORE" != "null" ] && (( $(echo "$CE04_SCORE > 0" | bc -l) )); then
    log "✅ CE04 Valid (score: $CE04_SCORE > 0)"
else
    log "❌ CE04 Invalid: expected > 0, got     exit 1
fi

# Generate Evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
[P2 CE DAG E2E Gate PASS - $(date)]
RUN_ID: $RUN_ID
TRACE_ID: $TRACE_ID
CE06_JOB_ID: $CE06_JOB_ID (SUCCEEDED)
CE03_DENSITY_SCORE: $CE03_SCORE (>0)
CE04_ENRICHMENT_QUALITY: $CE04_SCORE (>0)
EOF

log "📝 Evidence saved to: $EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
log "✅ Gate Passed. Evidence at $EVID_DIR"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr EVID_DIR="docs/_evidence/p2_ce_dag_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_CE_DAG_E2E] Starting Gate (RUN_ID: $RUN_ID)..."
log "🧹 Cleaning up old processes..."
pkill -f pkill -f pkill -f sleep 2

log "🔌 Starting API..."
pnpm -w turbo run dev --filter=api > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 2

# Wait for API ready
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    log "API listening on 3001"
    break
  fi
  sleep 1
done

log "👷 Starting Worker..."
pnpm -w turbo run dev --filter=@scu/worker > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

sleep 4

# Cleanup on exit
trap "log 
log "🌱 Seeding Project (RUN_ID: $RUN_ID)..."
PROJECT_NAME="P2_CE_DAG_E2E_${TS}"
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO projects (id, \"organizationId\", name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO seasons (id, \"projectId\", title, \"index\", \"updatedAt\") 
VALUES (
INSERT INTO episodes (id, \"seasonId\", \"index\", \"name\") 
VALUES (
INSERT INTO scenes (id, \"episodeId\", \"index\", \"title\", \"summary\") 
VALUES (

INSERT INTO shots (id, \"sceneId\", \"index\", type, params) 
VALUES (
INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"updatedAt\")
VALUES (


INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
(((ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, \"isActive\" = true;

INSERT INTO engine_versions (id, \"engineId\", \"versionName\", config, enabled, \"createdAt\", \"updatedAt\")
VALUES 
(((ON CONFLICT (\"engineId\", \"versionName\") DO NOTHING;

INSERT INTO api_keys (id, \"key\", \"secretHash\", \"updatedAt\")
VALUES (ON CONFLICT DO NOTHING;

"

log "✅ Data Seeded (PROJ_ID: $PROJ_ID, SHOT_ID: $SHOT_ID, SOURCE_ID: $SOURCE_ID)"

log "🎬 Triggering CE DAG E2E..."
DAG_OUT=$(PROJ_ID="$PROJ_ID" SOURCE_ID="$SOURCE_ID" SHOT_ID="$SHOT_ID" API_BASE="http://localhost:3001" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_ce_dag_gate.ts 2>&1)

echo "$DAG_OUT" | tee "$EVID_DIR/dag_trigger.log"

TRACE_ID=$(echo "$DAG_OUT" | grep "TRACE_ID=" | cut -d= -f2)
CE06_JOB_ID=$(echo "$DAG_OUT" | grep "CE06_JOB_ID=" | cut -d= -f2)
CE03_JOB_ID=$(echo "$DAG_OUT" | grep "CE03_JOB_ID=" | cut -d= -f2)
CE04_JOB_ID=$(echo "$DAG_OUT" | grep "CE04_JOB_ID=" | cut -d= -f2)

if [ -z "$TRACE_ID" ] || [ -z "$CE06_JOB_ID" ] || [ -z "$CE03_JOB_ID" ] || [ -z "$CE04_JOB_ID" ]; then
  log "❌ Failed to extract job IDs from DAG trigger output"
  exit 1
fi

log "   TRACE_ID: $TRACE_ID"
log "   CE06_JOB_ID: $CE06_JOB_ID"
log "   CE03_JOB_ID: $CE03_JOB_ID"
log "   CE04_JOB_ID: $CE04_JOB_ID"

log "⏳ Waiting for jobs to complete..."
for i in {1..60}; do
  CE06_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE03_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE04_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id= # $gate$
  log "   [CE06] $CE06_STATUS | [CE03] $CE03_STATUS | [CE04] $CE04_STATUS"

  if [ "$CE06_STATUS" = "SUCCEEDED" ] && [ "$CE03_STATUS" = "SUCCEEDED" ] && [ "$CE04_STATUS" = "SUCCEEDED" ]; then
    log "✅ All jobs SUCCEEDED"
    break
  fi

  if [ "$CE06_STATUS" = "FAILED" ] || [ "$CE03_STATUS" = "FAILED" ] || [ "$CE04_STATUS" = "FAILED" ]; then
    log "❌ At least one job FAILED"
    psql -d scu -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id IN (    exit 1
  fi

  sleep 2
done

log "🔍 Verifying DB with precise projectId+engine+jobId+traceId binding..."

# CE03: Bind by projectId + engine + jobId + traceId
CE03_SCORE=$(psql -d scu -t -c "SELECT qm.\"visualDensityScore\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE03] Density Score: $CE03_SCORE (TraceID: $TRACE_ID, JobID: $CE03_JOB_ID)" # $gate$

if [ -n "$CE03_SCORE" ] && [ "$CE03_SCORE" != "null" ] && (( $(echo "$CE03_SCORE > 0" | bc -l) )); then
    log "✅ CE03 Valid (score: $CE03_SCORE > 0)"
else
    log "❌ CE03 Invalid: expected > 0, got     exit 1
fi

# CE04: Bind by projectId + engine + jobId + traceId
CE04_SCORE=$(psql -d scu -t -c "SELECT qm.\"enrichmentQuality\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE04] Enrichment Quality: $CE04_SCORE (TraceID: $TRACE_ID, JobID: $CE04_JOB_ID)" # $gate$

if [ -n "$CE04_SCORE" ] && [ "$CE04_SCORE" != "null" ] && (( $(echo "$CE04_SCORE > 0" | bc -l) )); then
    log "✅ CE04 Valid (score: $CE04_SCORE > 0)"
else
    log "❌ CE04 Invalid: expected > 0, got     exit 1
fi

# Generate Evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
[P2 CE DAG E2E Gate PASS - $(date)]
RUN_ID: $RUN_ID
TRACE_ID: $TRACE_ID
CE06_JOB_ID: $CE06_JOB_ID (SUCCEEDED)
CE03_DENSITY_SCORE: $CE03_SCORE (>0)
CE04_ENRICHMENT_QUALITY: $CE04_SCORE (>0)
EOF

log "📝 Evidence saved to: $EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
log "✅ Gate Passed. Evidence at $EVID_DIR"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr EVID_DIR="docs/_evidence/p2_ce_dag_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_CE_DAG_E2E] Starting Gate (RUN_ID: $RUN_ID)..."
log "🧹 Cleaning up old processes..."
pkill -f pkill -f pkill -f sleep 2

log "🔌 Starting API..."
pnpm -w turbo run dev --filter=api > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 2

# Wait for API ready
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    log "API listening on 3001"
    break
  fi
  sleep 1
done

log "👷 Starting Worker..."
pnpm -w turbo run dev --filter=@scu/worker > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

sleep 4

# Cleanup on exit
trap "log 
log "🌱 Seeding Project (RUN_ID: $RUN_ID)..."
PROJECT_NAME="P2_CE_DAG_E2E_${TS}"
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO projects (id, \"organizationId\", name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO seasons (id, \"projectId\", title, \"index\", \"updatedAt\") 
VALUES (
INSERT INTO episodes (id, \"seasonId\", \"index\", \"name\") 
VALUES (
INSERT INTO scenes (id, \"episodeId\", \"index\", \"title\", \"summary\") 
VALUES (

INSERT INTO shots (id, \"sceneId\", \"index\", type, params) 
VALUES (
INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"updatedAt\")
VALUES (


INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
(((ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, \"isActive\" = true;

INSERT INTO engine_versions (id, \"engineId\", \"versionName\", config, enabled, \"createdAt\", \"updatedAt\")
VALUES 
(((ON CONFLICT (\"engineId\", \"versionName\") DO NOTHING;

INSERT INTO api_keys (id, \"key\", \"secretHash\", \"updatedAt\")
VALUES (ON CONFLICT DO NOTHING;

"

log "✅ Data Seeded (PROJ_ID: $PROJ_ID, SHOT_ID: $SHOT_ID, SOURCE_ID: $SOURCE_ID)"

log "🎬 Triggering CE DAG E2E..."
DAG_OUT=$(PROJ_ID="$PROJ_ID" SOURCE_ID="$SOURCE_ID" SHOT_ID="$SHOT_ID" API_BASE="http://localhost:3001" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_ce_dag_gate.ts 2>&1)

echo "$DAG_OUT" | tee "$EVID_DIR/dag_trigger.log"

TRACE_ID=$(echo "$DAG_OUT" | grep "TRACE_ID=" | cut -d= -f2)
CE06_JOB_ID=$(echo "$DAG_OUT" | grep "CE06_JOB_ID=" | cut -d= -f2)
CE03_JOB_ID=$(echo "$DAG_OUT" | grep "CE03_JOB_ID=" | cut -d= -f2)
CE04_JOB_ID=$(echo "$DAG_OUT" | grep "CE04_JOB_ID=" | cut -d= -f2)

if [ -z "$TRACE_ID" ] || [ -z "$CE06_JOB_ID" ] || [ -z "$CE03_JOB_ID" ] || [ -z "$CE04_JOB_ID" ]; then
  log "❌ Failed to extract job IDs from DAG trigger output"
  exit 1
fi

log "   TRACE_ID: $TRACE_ID"
log "   CE06_JOB_ID: $CE06_JOB_ID"
log "   CE03_JOB_ID: $CE03_JOB_ID"
log "   CE04_JOB_ID: $CE04_JOB_ID"

log "⏳ Waiting for jobs to complete..."
for i in {1..60}; do
  CE06_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE03_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE04_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id= # $gate$
  log "   [CE06] $CE06_STATUS | [CE03] $CE03_STATUS | [CE04] $CE04_STATUS"

  if [ "$CE06_STATUS" = "SUCCEEDED" ] && [ "$CE03_STATUS" = "SUCCEEDED" ] && [ "$CE04_STATUS" = "SUCCEEDED" ]; then
    log "✅ All jobs SUCCEEDED"
    break
  fi

  if [ "$CE06_STATUS" = "FAILED" ] || [ "$CE03_STATUS" = "FAILED" ] || [ "$CE04_STATUS" = "FAILED" ]; then
    log "❌ At least one job FAILED"
    psql -d scu -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id IN (    exit 1
  fi

  sleep 2
done

log "🔍 Verifying DB with precise projectId+engine+jobId+traceId binding..."

# CE03: Bind by projectId + engine + jobId + traceId
CE03_SCORE=$(psql -d scu -t -c "SELECT qm.\"visualDensityScore\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE03] Density Score: $CE03_SCORE (TraceID: $TRACE_ID, JobID: $CE03_JOB_ID)" # $gate$

if [ -n "$CE03_SCORE" ] && [ "$CE03_SCORE" != "null" ] && (( $(echo "$CE03_SCORE > 0" | bc -l) )); then
    log "✅ CE03 Valid (score: $CE03_SCORE > 0)"
else
    log "❌ CE03 Invalid: expected > 0, got     exit 1
fi

# CE04: Bind by projectId + engine + jobId + traceId
CE04_SCORE=$(psql -d scu -t -c "SELECT qm.\"enrichmentQuality\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE04] Enrichment Quality: $CE04_SCORE (TraceID: $TRACE_ID, JobID: $CE04_JOB_ID)" # $gate$

if [ -n "$CE04_SCORE" ] && [ "$CE04_SCORE" != "null" ] && (( $(echo "$CE04_SCORE > 0" | bc -l) )); then
    log "✅ CE04 Valid (score: $CE04_SCORE > 0)"
else
    log "❌ CE04 Invalid: expected > 0, got     exit 1
fi

# Generate Evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
[P2 CE DAG E2E Gate PASS - $(date)]
RUN_ID: $RUN_ID
TRACE_ID: $TRACE_ID
CE06_JOB_ID: $CE06_JOB_ID (SUCCEEDED)
CE03_DENSITY_SCORE: $CE03_SCORE (>0)
CE04_ENRICHMENT_QUALITY: $CE04_SCORE (>0)
EOF

log "📝 Evidence saved to: $EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
log "✅ Gate Passed. Evidence at $EVID_DIR"
set -e

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_ID="$(uuidgen | tr EVID_DIR="docs/_evidence/p2_ce_dag_e2e_${TS}"
mkdir -p "$EVID_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID_DIR/gate.log"; }

log "🚀 [P2_CE_DAG_E2E] Starting Gate (RUN_ID: $RUN_ID)..."
log "🧹 Cleaning up old processes..."
pkill -f pkill -f pkill -f sleep 2

log "🔌 Starting API..."
pnpm -w turbo run dev --filter=api > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 2

# Wait for API ready
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    log "API listening on 3001"
    break
  fi
  sleep 1
done

log "👷 Starting Worker..."
pnpm -w turbo run dev --filter=@scu/worker > "$EVID_DIR/worker.log" 2>&1 &
WORKER_PID=$!

sleep 4

# Cleanup on exit
trap "log 
log "🌱 Seeding Project (RUN_ID: $RUN_ID)..."
PROJECT_NAME="P2_CE_DAG_E2E_${TS}"
USER_ID="user_${RUN_ID}"
ORG_ID="org_${RUN_ID}"
PROJ_ID="proj_${RUN_ID}"
SEASON_ID="season_${RUN_ID}"
EPISODE_ID="episode_${RUN_ID}"
SCENE_ID="scene_${RUN_ID}"
SHOT_ID="shot_${RUN_ID}"
SOURCE_ID="source_${RUN_ID}"

psql -d scu -c "
INSERT INTO users (id, email, \"passwordHash\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO projects (id, \"organizationId\", name, \"ownerId\", \"createdAt\", \"updatedAt\") 
VALUES (
INSERT INTO seasons (id, \"projectId\", title, \"index\", \"updatedAt\") 
VALUES (
INSERT INTO episodes (id, \"seasonId\", \"index\", \"name\") 
VALUES (
INSERT INTO scenes (id, \"episodeId\", \"index\", \"title\", \"summary\") 
VALUES (

INSERT INTO shots (id, \"sceneId\", \"index\", type, params) 
VALUES (
INSERT INTO novel_sources (id, \"projectId\", \"rawText\", \"updatedAt\")
VALUES (


INSERT INTO engines (id, \"engineKey\", \"adapterName\", \"adapterType\", config, enabled, \"createdAt\", \"updatedAt\", code, \"isActive\", name, type)
VALUES 
(((ON CONFLICT (\"engineKey\") DO UPDATE SET code = EXCLUDED.code, \"isActive\" = true;

INSERT INTO engine_versions (id, \"engineId\", \"versionName\", config, enabled, \"createdAt\", \"updatedAt\")
VALUES 
(((ON CONFLICT (\"engineId\", \"versionName\") DO NOTHING;

INSERT INTO api_keys (id, \"key\", \"secretHash\", \"updatedAt\")
VALUES (ON CONFLICT DO NOTHING;

"

log "✅ Data Seeded (PROJ_ID: $PROJ_ID, SHOT_ID: $SHOT_ID, SOURCE_ID: $SOURCE_ID)"

log "🎬 Triggering CE DAG E2E..."
DAG_OUT=$(PROJ_ID="$PROJ_ID" SOURCE_ID="$SOURCE_ID" SHOT_ID="$SHOT_ID" API_BASE="http://localhost:3001" \
  npx ts-node -P apps/api/tsconfig.json apps/api/src/scripts/p2_ce_dag_gate.ts 2>&1)

echo "$DAG_OUT" | tee "$EVID_DIR/dag_trigger.log"

TRACE_ID=$(echo "$DAG_OUT" | grep "TRACE_ID=" | cut -d= -f2)
CE06_JOB_ID=$(echo "$DAG_OUT" | grep "CE06_JOB_ID=" | cut -d= -f2)
CE03_JOB_ID=$(echo "$DAG_OUT" | grep "CE03_JOB_ID=" | cut -d= -f2)
CE04_JOB_ID=$(echo "$DAG_OUT" | grep "CE04_JOB_ID=" | cut -d= -f2)

if [ -z "$TRACE_ID" ] || [ -z "$CE06_JOB_ID" ] || [ -z "$CE03_JOB_ID" ] || [ -z "$CE04_JOB_ID" ]; then
  log "❌ Failed to extract job IDs from DAG trigger output"
  exit 1
fi

log "   TRACE_ID: $TRACE_ID"
log "   CE06_JOB_ID: $CE06_JOB_ID"
log "   CE03_JOB_ID: $CE03_JOB_ID"
log "   CE04_JOB_ID: $CE04_JOB_ID"

log "⏳ Waiting for jobs to complete..."
for i in {1..60}; do
  CE06_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE03_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id=  CE04_STATUS=$(psql -d scu -t -c "SELECT status FROM shot_jobs WHERE id= # $gate$
  log "   [CE06] $CE06_STATUS | [CE03] $CE03_STATUS | [CE04] $CE04_STATUS"

  if [ "$CE06_STATUS" = "SUCCEEDED" ] && [ "$CE03_STATUS" = "SUCCEEDED" ] && [ "$CE04_STATUS" = "SUCCEEDED" ]; then
    log "✅ All jobs SUCCEEDED"
    break
  fi

  if [ "$CE06_STATUS" = "FAILED" ] || [ "$CE03_STATUS" = "FAILED" ] || [ "$CE04_STATUS" = "FAILED" ]; then
    log "❌ At least one job FAILED"
    psql -d scu -c "SELECT id, status, \"lastError\" FROM shot_jobs WHERE id IN (    exit 1
  fi

  sleep 2
done

log "🔍 Verifying DB with precise projectId+engine+jobId+traceId binding..."

# CE03: Bind by projectId + engine + jobId + traceId
CE03_SCORE=$(psql -d scu -t -c "SELECT qm.\"visualDensityScore\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE03] Density Score: $CE03_SCORE (TraceID: $TRACE_ID, JobID: $CE03_JOB_ID)" # $gate$

if [ -n "$CE03_SCORE" ] && [ "$CE03_SCORE" != "null" ] && (( $(echo "$CE03_SCORE > 0" | bc -l) )); then
    log "✅ CE03 Valid (score: $CE03_SCORE > 0)"
else
    log "❌ CE03 Invalid: expected > 0, got     exit 1
fi

# CE04: Bind by projectId + engine + jobId + traceId
CE04_SCORE=$(psql -d scu -t -c "SELECT qm.\"enrichmentQuality\" FROM quality_metrics qm JOIN shot_jobs sj ON sj.\"projectId\" = qm.\"projectId\" WHERE qm.\"projectId\"=log "   [CE04] Enrichment Quality: $CE04_SCORE (TraceID: $TRACE_ID, JobID: $CE04_JOB_ID)" # $gate$

if [ -n "$CE04_SCORE" ] && [ "$CE04_SCORE" != "null" ] && (( $(echo "$CE04_SCORE > 0" | bc -l) )); then
    log "✅ CE04 Valid (score: $CE04_SCORE > 0)"
else
    log "❌ CE04 Invalid: expected > 0, got     exit 1
fi

# Generate Evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
[P2 CE DAG E2E Gate PASS - $(date)]
RUN_ID: $RUN_ID
TRACE_ID: $TRACE_ID
CE06_JOB_ID: $CE06_JOB_ID (SUCCEEDED)
CE03_DENSITY_SCORE: $CE03_SCORE (>0)
CE04_ENRICHMENT_QUALITY: $CE04_SCORE (>0)
EOF

log "📝 Evidence saved to: $EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
log "✅ Gate Passed. Evidence at $EVID_DIR"
