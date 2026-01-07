#!/bin/bash
set -e

# ==============================================================================
# GATE CE05 M4: Version Consistency & Migration
# ------------------------------------------------------------------------------
# Verifies:
# 1. V1 Snapshot → V1 Shot/ShotPlanning binding preserved
# 2. V2 Snapshot → V2 Shot/ShotPlanning binding (latest version)
# 3. Old records NOT auto-migrated (default behavior)
# 4. VERSION_CONSISTENCY assertion
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce05_m4_version_consistency_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +'%H:%M:%S')] $1" | tee -a "$EVID_DIR/gate.log"
}

log "Starting CE05 M4 Version Consistency Gate..."
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
log "Triggering CE05 M4 Multi-Version Test..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce05_m4_trigger.ts > "$EVID_DIR/trigger_output.txt" 2>&1

PROJECT_ID=$(grep "^PROJECT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d '\r')
V1_SNAPSHOT_ID=$(grep "^V1_SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d '\r')
V2_SNAPSHOT_ID=$(grep "^V2_SNAPSHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d '\r')
V1_SHOT_ID=$(grep "^V1_SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d '\r')
V2_SHOT_ID=$(grep "^V2_SHOT_ID=" "$EVID_DIR/trigger_output.txt" | cut -d= -f2 | tr -d '\r')

if [ -z "$PROJECT_ID" ] || [ -z "$V1_SNAPSHOT_ID" ] || [ -z "$V2_SNAPSHOT_ID" ]; then
    log "FATAL: Failed to get keys from trigger output"
    cat "$EVID_DIR/trigger_output.txt"
    exit 1
fi

log "Tracked: Project=$PROJECT_ID V1=$V1_SNAPSHOT_ID V2=$V2_SNAPSHOT_ID"

echo "PROJECT_ID=$PROJECT_ID" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "V1_SNAPSHOT_ID=$V1_SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "V2_SNAPSHOT_ID=$V2_SNAPSHOT_ID" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 3. Verify V1 Shot still points to V1 (NO Auto-Migration)
log "Verifying V1 Shot binding preserved..."
V1_SHOT_SNAPSHOT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT director_control_snapshot_id FROM shots WHERE id='$V1_SHOT_ID'" | xargs)

if [ "$V1_SHOT_SNAPSHOT" != "$V1_SNAPSHOT_ID" ]; then
    log "FATAL: V1 Shot was auto-migrated! Expected=$V1_SNAPSHOT_ID Got=$V1_SHOT_SNAPSHOT"
    exit 1
fi

log "✅ V1 Shot preserved binding: $V1_SHOT_SNAPSHOT"
echo "V1_BINDING_PRESERVED=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 4. Verify V2 Shot points to V2 (Latest Version Binding)
log "Verifying V2 Shot binding to latest..."
V2_SHOT_SNAPSHOT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT director_control_snapshot_id FROM shots WHERE id='$V2_SHOT_ID'" | xargs)

if [ "$V2_SHOT_SNAPSHOT" != "$V2_SNAPSHOT_ID" ]; then
    log "FATAL: V2 Shot not bound to latest! Expected=$V2_SNAPSHOT_ID Got=$V2_SHOT_SNAPSHOT"
    exit 1
fi

log "✅ V2 Shot bound to latest: $V2_SHOT_SNAPSHOT"
echo "V2_BINDING_LATEST=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# 5. Verify Version Consistency (V1 != V2)
if [ "$V1_SNAPSHOT_ID" == "$V2_SNAPSHOT_ID" ]; then
    log "FATAL: V1 and V2 snapshots are the same!"
    exit 1
fi

echo "VERSION_CONSISTENCY=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

log "GATE CE05 M4 VERSION CONSISTENCY: SUCCESS"
exit 0
