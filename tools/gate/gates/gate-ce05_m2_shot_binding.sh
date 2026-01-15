#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

set -e

# ==============================================================================
# GATE CE05 M2: Director/Shot Integration Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. CE05 Job -> Creates DirectorControlSnapshot (SSOT)
# 2. CE06 Job -> Hooks -> Creates Shot
# 3. Assert Shot has directorControlSnapshotId & identityLockToken
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m2_shot_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M2 Shot Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. Start Services
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
export STRIPE_SECRET_KEY="sk_test_mock_start_key_ce05_m2"

log "Starting API..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# Start Workers (Enable CE05, CE06)
export WORKER_CAPS="CE05_DIRECTOR_CONTROL,CE06_NOVEL_PARSING"
log "Starting Workers..."
pnpm --filter @scu/worker start > "$EVID_DIR/workers.log" 2>&1 &
WORKER_PID=$!
sleep 5

# 2. Trigger Pipeline
log "Triggering CE05+CE06 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m2_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE05_JOB_ID=$(grep "CE05_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE06_JOB_ID=$(grep "CE06_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    kill $API_PID $WORKER_PID || true
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Identity=$IDENTITY_KEY Jobs=$CE05_JOB_ID,$CE06_JOB_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Wait for CE05 Success (Snapshot Creation)
MAX_WAIT=60
START=$(date +%s)
log "Waiting for CE05 ($CE05_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE05"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE05 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE05 Failed"; exit 1; fi
    sleep 2
done

# 4. Wait for CE06 Success (Novel Parsing)
log "Waiting for CE06 ($CE06_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE06"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE06 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE06 Failed"; exit 1; fi
    sleep 2
done

# 5. Wait for Shot Population (Async via Hook) - Allow extra time
log "Waiting for Shot Generation + Binding..."
sleep 5 # Give Hook time to run

# Find the Generated Shot (Not the dummy one from trigger, but the # We search for shots in the project
# Warning: Trigger script created a dummy "shot" for hierarchy. The Hook will create "Analysis Placeholder".
# We want to check "Analysis Placeholder" or any shot with binding.

# Poll for shot with directorControlSnapshotId IS NOT NULL
START_SHOT=$(date +%s)
while true; do
    if [ $(( $(date +%s) - START_SHOT )) -ge 30 ]; then log "Timeout Waiting for Bound Shot"; exit 1; fi
    
    # Query for shots in this project that have directorControlSnapshotId set
    # Note: Trigger uses specific org/project.
    # Join logic: Shot -> Scene -> Episode -> Project?
    # Or just check any shot created > trigger start time?
    # Better: Inspect shots linked to this Project    
    SHOT_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
      SELECT s.id, s.director_control_snapshot_id, s.identity_lock_token 
      FROM shots s
      JOIN scenes sc ON s.\"sceneId\" = sc.id 
      JOIN episodes ep ON sc.\"episodeId\" = ep.id
      WHERE ep.\"projectId\" =       AND s.\"director_control_snapshot_id\" IS NOT NULL
      LIMIT 1
    ")
    
    SHOT_ID=$(echo "$SHOT_ROW" | awk -F     SSOT_ID=$(echo "$SHOT_ROW" | awk -F     SHOT_TOKEN=$(echo "$SHOT_ROW" | awk -F     
    if [ ! -z "$SHOT_ID" ]; then
        log "Found Bound Shot: $SHOT_ID"
        log "  Snapshot ID: $SSOT_ID"
        log "  Identity Token: $SHOT_TOKEN"
        
        # Verify Identity Token matches
        if [ "$SHOT_TOKEN" != "$IDENTITY_KEY" ]; then
             log "FATAL: Identity Token Mismatch! Expected $IDENTITY_KEY, Got $SHOT_TOKEN"
             exit 1
        fi
        
        echo "SHOT_BINDING_VERIFIED=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SNAPSHOT_ID=$SSOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SHOT_ID=$SHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        
        break
    fi
    sleep 2
done

kill $API_PID || true
kill $WORKER_PID || true

log "GATE CE05 M2 SHOT BINDING: SUCCESS"
exit 0

set -e

# ==============================================================================
# GATE CE05 M2: Director/Shot Integration Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. CE05 Job -> Creates DirectorControlSnapshot (SSOT)
# 2. CE06 Job -> Hooks -> Creates Shot
# 3. Assert Shot has directorControlSnapshotId & identityLockToken
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m2_shot_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M2 Shot Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. Start Services
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
export STRIPE_SECRET_KEY="sk_test_mock_start_key_ce05_m2"

log "Starting API..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# Start Workers (Enable CE05, CE06)
export WORKER_CAPS="CE05_DIRECTOR_CONTROL,CE06_NOVEL_PARSING"
log "Starting Workers..."
pnpm --filter @scu/worker start > "$EVID_DIR/workers.log" 2>&1 &
WORKER_PID=$!
sleep 5

# 2. Trigger Pipeline
log "Triggering CE05+CE06 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m2_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE05_JOB_ID=$(grep "CE05_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE06_JOB_ID=$(grep "CE06_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    kill $API_PID $WORKER_PID || true
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Identity=$IDENTITY_KEY Jobs=$CE05_JOB_ID,$CE06_JOB_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Wait for CE05 Success (Snapshot Creation)
MAX_WAIT=60
START=$(date +%s)
log "Waiting for CE05 ($CE05_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE05"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE05 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE05 Failed"; exit 1; fi
    sleep 2
done

# 4. Wait for CE06 Success (Novel Parsing)
log "Waiting for CE06 ($CE06_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE06"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE06 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE06 Failed"; exit 1; fi
    sleep 2
done

# 5. Wait for Shot Population (Async via Hook) - Allow extra time
log "Waiting for Shot Generation + Binding..."
sleep 5 # Give Hook time to run

# Find the Generated Shot (Not the dummy one from trigger, but the # We search for shots in the project
# Warning: Trigger script created a dummy "shot" for hierarchy. The Hook will create "Analysis Placeholder".
# We want to check "Analysis Placeholder" or any shot with binding.

# Poll for shot with directorControlSnapshotId IS NOT NULL
START_SHOT=$(date +%s)
while true; do
    if [ $(( $(date +%s) - START_SHOT )) -ge 30 ]; then log "Timeout Waiting for Bound Shot"; exit 1; fi
    
    # Query for shots in this project that have directorControlSnapshotId set
    # Note: Trigger uses specific org/project.
    # Join logic: Shot -> Scene -> Episode -> Project?
    # Or just check any shot created > trigger start time?
    # Better: Inspect shots linked to this Project    
    SHOT_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
      SELECT s.id, s.director_control_snapshot_id, s.identity_lock_token 
      FROM shots s
      JOIN scenes sc ON s.\"sceneId\" = sc.id 
      JOIN episodes ep ON sc.\"episodeId\" = ep.id
      WHERE ep.\"projectId\" =       AND s.\"director_control_snapshot_id\" IS NOT NULL
      LIMIT 1
    ")
    
    SHOT_ID=$(echo "$SHOT_ROW" | awk -F     SSOT_ID=$(echo "$SHOT_ROW" | awk -F     SHOT_TOKEN=$(echo "$SHOT_ROW" | awk -F     
    if [ ! -z "$SHOT_ID" ]; then
        log "Found Bound Shot: $SHOT_ID"
        log "  Snapshot ID: $SSOT_ID"
        log "  Identity Token: $SHOT_TOKEN"
        
        # Verify Identity Token matches
        if [ "$SHOT_TOKEN" != "$IDENTITY_KEY" ]; then
             log "FATAL: Identity Token Mismatch! Expected $IDENTITY_KEY, Got $SHOT_TOKEN"
             exit 1
        fi
        
        echo "SHOT_BINDING_VERIFIED=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SNAPSHOT_ID=$SSOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SHOT_ID=$SHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        
        break
    fi
    sleep 2
done

kill $API_PID || true
kill $WORKER_PID || true

log "GATE CE05 M2 SHOT BINDING: SUCCESS"
exit 0

set -e

# ==============================================================================
# GATE CE05 M2: Director/Shot Integration Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. CE05 Job -> Creates DirectorControlSnapshot (SSOT)
# 2. CE06 Job -> Hooks -> Creates Shot
# 3. Assert Shot has directorControlSnapshotId & identityLockToken
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m2_shot_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M2 Shot Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. Start Services
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
export STRIPE_SECRET_KEY="sk_test_mock_start_key_ce05_m2"

log "Starting API..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# Start Workers (Enable CE05, CE06)
export WORKER_CAPS="CE05_DIRECTOR_CONTROL,CE06_NOVEL_PARSING"
log "Starting Workers..."
pnpm --filter @scu/worker start > "$EVID_DIR/workers.log" 2>&1 &
WORKER_PID=$!
sleep 5

# 2. Trigger Pipeline
log "Triggering CE05+CE06 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m2_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE05_JOB_ID=$(grep "CE05_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE06_JOB_ID=$(grep "CE06_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    kill $API_PID $WORKER_PID || true
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Identity=$IDENTITY_KEY Jobs=$CE05_JOB_ID,$CE06_JOB_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Wait for CE05 Success (Snapshot Creation)
MAX_WAIT=60
START=$(date +%s)
log "Waiting for CE05 ($CE05_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE05"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE05 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE05 Failed"; exit 1; fi
    sleep 2
done

# 4. Wait for CE06 Success (Novel Parsing)
log "Waiting for CE06 ($CE06_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE06"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE06 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE06 Failed"; exit 1; fi
    sleep 2
done

# 5. Wait for Shot Population (Async via Hook) - Allow extra time
log "Waiting for Shot Generation + Binding..."
sleep 5 # Give Hook time to run

# Find the Generated Shot (Not the dummy one from trigger, but the # We search for shots in the project
# Warning: Trigger script created a dummy "shot" for hierarchy. The Hook will create "Analysis Placeholder".
# We want to check "Analysis Placeholder" or any shot with binding.

# Poll for shot with directorControlSnapshotId IS NOT NULL
START_SHOT=$(date +%s)
while true; do
    if [ $(( $(date +%s) - START_SHOT )) -ge 30 ]; then log "Timeout Waiting for Bound Shot"; exit 1; fi
    
    # Query for shots in this project that have directorControlSnapshotId set
    # Note: Trigger uses specific org/project.
    # Join logic: Shot -> Scene -> Episode -> Project?
    # Or just check any shot created > trigger start time?
    # Better: Inspect shots linked to this Project    
    SHOT_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
      SELECT s.id, s.director_control_snapshot_id, s.identity_lock_token 
      FROM shots s
      JOIN scenes sc ON s.\"sceneId\" = sc.id 
      JOIN episodes ep ON sc.\"episodeId\" = ep.id
      WHERE ep.\"projectId\" =       AND s.\"director_control_snapshot_id\" IS NOT NULL
      LIMIT 1
    ")
    
    SHOT_ID=$(echo "$SHOT_ROW" | awk -F     SSOT_ID=$(echo "$SHOT_ROW" | awk -F     SHOT_TOKEN=$(echo "$SHOT_ROW" | awk -F     
    if [ ! -z "$SHOT_ID" ]; then
        log "Found Bound Shot: $SHOT_ID"
        log "  Snapshot ID: $SSOT_ID"
        log "  Identity Token: $SHOT_TOKEN"
        
        # Verify Identity Token matches
        if [ "$SHOT_TOKEN" != "$IDENTITY_KEY" ]; then
             log "FATAL: Identity Token Mismatch! Expected $IDENTITY_KEY, Got $SHOT_TOKEN"
             exit 1
        fi
        
        echo "SHOT_BINDING_VERIFIED=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SNAPSHOT_ID=$SSOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SHOT_ID=$SHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        
        break
    fi
    sleep 2
done

kill $API_PID || true
kill $WORKER_PID || true

log "GATE CE05 M2 SHOT BINDING: SUCCESS"
exit 0

set -e

# ==============================================================================
# GATE CE05 M2: Director/Shot Integration Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. CE05 Job -> Creates DirectorControlSnapshot (SSOT)
# 2. CE06 Job -> Hooks -> Creates Shot
# 3. Assert Shot has directorControlSnapshotId & identityLockToken
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m2_shot_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M2 Shot Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. Start Services
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
export STRIPE_SECRET_KEY="sk_test_mock_start_key_ce05_m2"

log "Starting API..."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

# Start Workers (Enable CE05, CE06)
export WORKER_CAPS="CE05_DIRECTOR_CONTROL,CE06_NOVEL_PARSING"
log "Starting Workers..."
pnpm --filter @scu/worker start > "$EVID_DIR/workers.log" 2>&1 &
WORKER_PID=$!
sleep 5

# 2. Trigger Pipeline
log "Triggering CE05+CE06 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m2_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE05_JOB_ID=$(grep "CE05_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d CE06_JOB_ID=$(grep "CE06_JOB_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    kill $API_PID $WORKER_PID || true
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Identity=$IDENTITY_KEY Jobs=$CE05_JOB_ID,$CE06_JOB_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Wait for CE05 Success (Snapshot Creation)
MAX_WAIT=60
START=$(date +%s)
log "Waiting for CE05 ($CE05_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE05"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE05 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE05 Failed"; exit 1; fi
    sleep 2
done

# 4. Wait for CE06 Success (Novel Parsing)
log "Waiting for CE06 ($CE06_JOB_ID) Success..."
while true; do
    if [ $(( $(date +%s) - START )) -ge $MAX_WAIT ]; then log "Timeout CE06"; exit 1; fi
    STATUS=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT status FROM shot_jobs WHERE id=    if [ "$STATUS" == "SUCCEEDED" ]; then log "CE06 Succeeded"; break; fi # $gate$
    if [ "$STATUS" == "FAILED" ]; then log "CE06 Failed"; exit 1; fi
    sleep 2
done

# 5. Wait for Shot Population (Async via Hook) - Allow extra time
log "Waiting for Shot Generation + Binding..."
sleep 5 # Give Hook time to run

# Find the Generated Shot (Not the dummy one from trigger, but the # We search for shots in the project
# Warning: Trigger script created a dummy "shot" for hierarchy. The Hook will create "Analysis Placeholder".
# We want to check "Analysis Placeholder" or any shot with binding.

# Poll for shot with directorControlSnapshotId IS NOT NULL
START_SHOT=$(date +%s)
while true; do
    if [ $(( $(date +%s) - START_SHOT )) -ge 30 ]; then log "Timeout Waiting for Bound Shot"; exit 1; fi
    
    # Query for shots in this project that have directorControlSnapshotId set
    # Note: Trigger uses specific org/project.
    # Join logic: Shot -> Scene -> Episode -> Project?
    # Or just check any shot created > trigger start time?
    # Better: Inspect shots linked to this Project    
    SHOT_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
      SELECT s.id, s.director_control_snapshot_id, s.identity_lock_token 
      FROM shots s
      JOIN scenes sc ON s.\"sceneId\" = sc.id 
      JOIN episodes ep ON sc.\"episodeId\" = ep.id
      WHERE ep.\"projectId\" =       AND s.\"director_control_snapshot_id\" IS NOT NULL
      LIMIT 1
    ")
    
    SHOT_ID=$(echo "$SHOT_ROW" | awk -F     SSOT_ID=$(echo "$SHOT_ROW" | awk -F     SHOT_TOKEN=$(echo "$SHOT_ROW" | awk -F     
    if [ ! -z "$SHOT_ID" ]; then
        log "Found Bound Shot: $SHOT_ID"
        log "  Snapshot ID: $SSOT_ID"
        log "  Identity Token: $SHOT_TOKEN"
        
        # Verify Identity Token matches
        if [ "$SHOT_TOKEN" != "$IDENTITY_KEY" ]; then
             log "FATAL: Identity Token Mismatch! Expected $IDENTITY_KEY, Got $SHOT_TOKEN"
             exit 1
        fi
        
        echo "SHOT_BINDING_VERIFIED=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SNAPSHOT_ID=$SSOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        echo "SHOT_ID=$SHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
        
        break
    fi
    sleep 2
done

kill $API_PID || true
kill $WORKER_PID || true

log "GATE CE05 M2 SHOT BINDING: SUCCESS"
exit 0
