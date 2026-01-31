#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# ==============================================================================
# GATE CE05 M3: ShotPlanning/DirectorControlSnapshot Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. DirectorControlSnapshot (SSOT) exists
# 2. ShotPlanning created with binding
# 3. Assert ShotPlanning has directorControlSnapshotId & identityLockToken
# 4. Assert Version Match & Identity Match
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m3_shotplan_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M3 ShotPlanning Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Trigger Pipeline
log "Triggering CE05 M3 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m3_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SNAPSHOT_ID=$(grep "SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOTPLANNING_ID=$(grep "SHOTPLANNING_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOT_ID=$(grep "SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$SNAPSHOT_ID" ] || [ -z "$SHOTPLANNING_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Snapshot=$SNAPSHOT_ID ShotPlanning=$SHOTPLANNING_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "SNAPSHOT_ID=$SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Verify DirectorControlSnapshot exists
log "Verifying DirectorControlSnapshot..."
SNAPSHOT_VERSION=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT version FROM director_control_snapshots WHERE id= # $gate$
if [ -z "$SNAPSHOT_VERSION" ]; then
    log "FATAL: DirectorControlSnapshot not found"
    exit 1
fi

log "DirectorControlSnapshot Version: $SNAPSHOT_VERSION"

# 4. Verify ShotPlanning Binding
log "Verifying ShotPlanning Binding..."
SP_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
  SELECT director_control_snapshot_id, identity_lock_token
  FROM shot_plannings
  WHERE id=")

SP_SNAPSHOT_ID=$(echo "$SP_ROW" | awk -F SP_IDENTITY_TOKEN=$(echo "$SP_ROW" | awk -F 
log "ShotPlanning SnapshotID: $SP_SNAPSHOT_ID"
log "ShotPlanning IdentityToken: $SP_IDENTITY_TOKEN"

# 5. Assert Binding Not Null
if [ -z "$SP_SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId is NULL"
    exit 1
fi

echo "BINDING_NOT_NULL=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 6. Assert Snapshot ID Match
if [ "$SP_SNAPSHOT_ID" != "$SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId ($SP_SNAPSHOT_ID) != Snapshot.id ($SNAPSHOT_ID)"
    exit 1
fi

echo "SNAPSHOT_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 7. Assert Identity Match
if [ "$SP_IDENTITY_TOKEN" != "$IDENTITY_KEY" ]; then
    log "FATAL: ShotPlanning.identityLockToken ($SP_IDENTITY_TOKEN) != Snapshot.identityKey ($IDENTITY_KEY)"
    exit 1
fi

echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

log "GATE CE05 M3 SHOTPLANNING BINDING: SUCCESS"
exit 0
set -e

# ==============================================================================
# GATE CE05 M3: ShotPlanning/DirectorControlSnapshot Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. DirectorControlSnapshot (SSOT) exists
# 2. ShotPlanning created with binding
# 3. Assert ShotPlanning has directorControlSnapshotId & identityLockToken
# 4. Assert Version Match & Identity Match
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m3_shotplan_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M3 ShotPlanning Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Trigger Pipeline
log "Triggering CE05 M3 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m3_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SNAPSHOT_ID=$(grep "SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOTPLANNING_ID=$(grep "SHOTPLANNING_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOT_ID=$(grep "SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$SNAPSHOT_ID" ] || [ -z "$SHOTPLANNING_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Snapshot=$SNAPSHOT_ID ShotPlanning=$SHOTPLANNING_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "SNAPSHOT_ID=$SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Verify DirectorControlSnapshot exists
log "Verifying DirectorControlSnapshot..."
SNAPSHOT_VERSION=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT version FROM director_control_snapshots WHERE id= # $gate$
if [ -z "$SNAPSHOT_VERSION" ]; then
    log "FATAL: DirectorControlSnapshot not found"
    exit 1
fi

log "DirectorControlSnapshot Version: $SNAPSHOT_VERSION"

# 4. Verify ShotPlanning Binding
log "Verifying ShotPlanning Binding..."
SP_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
  SELECT director_control_snapshot_id, identity_lock_token
  FROM shot_plannings
  WHERE id=")

SP_SNAPSHOT_ID=$(echo "$SP_ROW" | awk -F SP_IDENTITY_TOKEN=$(echo "$SP_ROW" | awk -F 
log "ShotPlanning SnapshotID: $SP_SNAPSHOT_ID"
log "ShotPlanning IdentityToken: $SP_IDENTITY_TOKEN"

# 5. Assert Binding Not Null
if [ -z "$SP_SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId is NULL"
    exit 1
fi

echo "BINDING_NOT_NULL=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 6. Assert Snapshot ID Match
if [ "$SP_SNAPSHOT_ID" != "$SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId ($SP_SNAPSHOT_ID) != Snapshot.id ($SNAPSHOT_ID)"
    exit 1
fi

echo "SNAPSHOT_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 7. Assert Identity Match
if [ "$SP_IDENTITY_TOKEN" != "$IDENTITY_KEY" ]; then
    log "FATAL: ShotPlanning.identityLockToken ($SP_IDENTITY_TOKEN) != Snapshot.identityKey ($IDENTITY_KEY)"
    exit 1
fi

echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

log "GATE CE05 M3 SHOTPLANNING BINDING: SUCCESS"
exit 0
set -e

# ==============================================================================
# GATE CE05 M3: ShotPlanning/DirectorControlSnapshot Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. DirectorControlSnapshot (SSOT) exists
# 2. ShotPlanning created with binding
# 3. Assert ShotPlanning has directorControlSnapshotId & identityLockToken
# 4. Assert Version Match & Identity Match
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m3_shotplan_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M3 ShotPlanning Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Trigger Pipeline
log "Triggering CE05 M3 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m3_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SNAPSHOT_ID=$(grep "SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOTPLANNING_ID=$(grep "SHOTPLANNING_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOT_ID=$(grep "SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$SNAPSHOT_ID" ] || [ -z "$SHOTPLANNING_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Snapshot=$SNAPSHOT_ID ShotPlanning=$SHOTPLANNING_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "SNAPSHOT_ID=$SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Verify DirectorControlSnapshot exists
log "Verifying DirectorControlSnapshot..."
SNAPSHOT_VERSION=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT version FROM director_control_snapshots WHERE id= # $gate$
if [ -z "$SNAPSHOT_VERSION" ]; then
    log "FATAL: DirectorControlSnapshot not found"
    exit 1
fi

log "DirectorControlSnapshot Version: $SNAPSHOT_VERSION"

# 4. Verify ShotPlanning Binding
log "Verifying ShotPlanning Binding..."
SP_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
  SELECT director_control_snapshot_id, identity_lock_token
  FROM shot_plannings
  WHERE id=")

SP_SNAPSHOT_ID=$(echo "$SP_ROW" | awk -F SP_IDENTITY_TOKEN=$(echo "$SP_ROW" | awk -F 
log "ShotPlanning SnapshotID: $SP_SNAPSHOT_ID"
log "ShotPlanning IdentityToken: $SP_IDENTITY_TOKEN"

# 5. Assert Binding Not Null
if [ -z "$SP_SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId is NULL"
    exit 1
fi

echo "BINDING_NOT_NULL=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 6. Assert Snapshot ID Match
if [ "$SP_SNAPSHOT_ID" != "$SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId ($SP_SNAPSHOT_ID) != Snapshot.id ($SNAPSHOT_ID)"
    exit 1
fi

echo "SNAPSHOT_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 7. Assert Identity Match
if [ "$SP_IDENTITY_TOKEN" != "$IDENTITY_KEY" ]; then
    log "FATAL: ShotPlanning.identityLockToken ($SP_IDENTITY_TOKEN) != Snapshot.identityKey ($IDENTITY_KEY)"
    exit 1
fi

echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

log "GATE CE05 M3 SHOTPLANNING BINDING: SUCCESS"
exit 0
set -e

# ==============================================================================
# GATE CE05 M3: ShotPlanning/DirectorControlSnapshot Binding
# ------------------------------------------------------------------------------
# Verifies:
# 1. DirectorControlSnapshot (SSOT) exists
# 2. ShotPlanning created with binding
# 3. Assert ShotPlanning has directorControlSnapshotId & identityLockToken
# 4. Assert Version Match & Identity Match
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m3_shotplan_binding_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE05 M3 ShotPlanning Binding Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pkill -f "apps/workers" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
pgrep -f "node.*apps/worker" | xargs kill -9 2>/dev/null || true

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Trigger Pipeline
log "Triggering CE05 M3 Pipeline..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m3_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "IDENTITY_KEY=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SNAPSHOT_ID=$(grep "SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOTPLANNING_ID=$(grep "SHOTPLANNING_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d SHOT_ID=$(grep "SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$SNAPSHOT_ID" ] || [ -z "$SHOTPLANNING_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    exit 1
fi

log "Tracked: Project=$PROJECT_ID Snapshot=$SNAPSHOT_ID ShotPlanning=$SHOTPLANNING_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_KEY=$IDENTITY_KEY" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "SNAPSHOT_ID=$SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Verify DirectorControlSnapshot exists
log "Verifying DirectorControlSnapshot..."
SNAPSHOT_VERSION=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT version FROM director_control_snapshots WHERE id= # $gate$
if [ -z "$SNAPSHOT_VERSION" ]; then
    log "FATAL: DirectorControlSnapshot not found"
    exit 1
fi

log "DirectorControlSnapshot Version: $SNAPSHOT_VERSION"

# 4. Verify ShotPlanning Binding
log "Verifying ShotPlanning Binding..."
SP_ROW=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c " # $gate$
  SELECT director_control_snapshot_id, identity_lock_token
  FROM shot_plannings
  WHERE id=")

SP_SNAPSHOT_ID=$(echo "$SP_ROW" | awk -F SP_IDENTITY_TOKEN=$(echo "$SP_ROW" | awk -F 
log "ShotPlanning SnapshotID: $SP_SNAPSHOT_ID"
log "ShotPlanning IdentityToken: $SP_IDENTITY_TOKEN"

# 5. Assert Binding Not Null
if [ -z "$SP_SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId is NULL"
    exit 1
fi

echo "BINDING_NOT_NULL=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 6. Assert Snapshot ID Match
if [ "$SP_SNAPSHOT_ID" != "$SNAPSHOT_ID" ]; then
    log "FATAL: ShotPlanning.directorControlSnapshotId ($SP_SNAPSHOT_ID) != Snapshot.id ($SNAPSHOT_ID)"
    exit 1
fi

echo "SNAPSHOT_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 7. Assert Identity Match
if [ "$SP_IDENTITY_TOKEN" != "$IDENTITY_KEY" ]; then
    log "FATAL: ShotPlanning.identityLockToken ($SP_IDENTITY_TOKEN) != Snapshot.identityKey ($IDENTITY_KEY)"
    exit 1
fi

echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

log "GATE CE05 M3 SHOTPLANNING BINDING: SUCCESS"
exit 0
