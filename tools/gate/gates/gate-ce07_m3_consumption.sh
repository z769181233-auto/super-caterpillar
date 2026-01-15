#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ==============================================================================
# GATE CE07 M3: Memory Consumption (Read → Consume → NO_MUTATION-2)
# ------------------------------------------------------------------------------
# Verifies:
# 1. CONSUMPTION_NON_EMPTY (memory_context contains summary/version)
# 2. IDENTITY_MATCH (identityLockToken required)
# 3. VERSION_CONSISTENT (preferVersion still honored)
# 4. NO_MUTATION_2 (MemorySnapshot count unchanged after consumption)
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce07_m3_consumption_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE07 M3 Consumption Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
sleep 2

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Start API
log "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export API_URL="http://localhost:3001"
export ALLOW_TEST_BILLING_GRANT=1

cd "$(dirname "$0")/../../.."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

if ! pgrep -f "apps/api/dist/main.js" > /dev/null; then
    log "FATAL: API failed to start"
    cat "$EVID_DIR/api.log"
    exit 1
fi

# 3. Setup: Create V1/V2 MemorySnapshot for testing(复用M2 trigger逻辑)
log "Setting up test data..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce07_m2_trigger.ts > "$EVID_DIR/setup_output.txt" 2>&1

PROJECT_ID=$(grep "^PROJECT_ID=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "^IDENTITY_KEY=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$IDENTITY_KEY" ]; then
    log "FATAL: Failed to setup test data"
    cat "$EVID_DIR/setup_output.txt"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "Setup complete: Project=$PROJECT_ID Identity=$IDENTITY_KEY"

# 4. Record DB state before consumption (NO_MUTATION_2 baseline)
BEFORE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

log "DB state before consumption: count=$BEFORE_COUNT"
echo "$BEFORE_COUNT" > "$EVID_DIR/db_count_before.txt"

# 5. Test Consumption: Call Memory Read API (simulating consumption)
log "Test: Consuming memory via read API..."
CONSUME_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY" 2>&1 || echo "{}")
echo "$CONSUME_RESP" > "$EVID_DIR/consumption_response.json"

# 6. Verify CONSUMPTION_NON_EMPTY
log "Verifying consumption result..."
VERSION=$(echo "$CONSUME_RESP" | grep -o SNAPSHOT_ID=$(echo "$CONSUME_RESP" | grep -o 
if [ "$VERSION" = "0" ] || [ -z "$SNAPSHOT_ID" ]; then
    log "FATAL: Consumption result is empty or invalid"
    cat "$EVID_DIR/consumption_response.json"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ CONSUMPTION_NON_EMPTY: version=$VERSION snapshotId=$SNAPSHOT_ID"

# 7. Verify IDENTITY_MATCH
IDENTITY_IN_RESP=$(echo "$CONSUME_RESP" | grep -o 
if [ "$IDENTITY_IN_RESP" != "$IDENTITY_KEY" ]; then
    log "FATAL: Identity mismatch. Expected=$IDENTITY_KEY Got=$IDENTITY_IN_RESP"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ IDENTITY_MATCH verified"

# 8. Verify VERSION_CONSISTENT (preferVersion test)
log "Test: preferVersion=1..."
PREFER_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY&preferVersion=1" 2>&1 || echo "{}")
echo "$PREFER_RESP" > "$EVID_DIR/prefer_v1_response.json"

PREFER_VERSION=$(echo "$PREFER_RESP" | grep -o 
if [ "$PREFER_VERSION" != "1" ]; then
    log "FATAL: VERSION_CONSISTENT failed. Expected v1, got v$PREFER_VERSION"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ VERSION_CONSISTENT verified (preferVersion honored)"

# 9. Verify NO_MUTATION_2 (critical: consumption must not mutate SSOT)
log "Verifying NO_MUTATION_2..."
AFTER_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

echo "$AFTER_COUNT" > "$EVID_DIR/db_count_after.txt"

if [ "$BEFORE_COUNT" != "$AFTER_COUNT" ]; then
    log "FATAL: NO_MUTATION_2 violated! Before=$BEFORE_COUNT After=$AFTER_COUNT"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ NO_MUTATION_2 verified (count stable: $BEFORE_COUNT)"

# 10. Write Evidence
echo "CONSUMPTION_NON_EMPTY=YES" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "VERSION_CONSISTENT=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "NO_MUTATION_2=YES (count=$BEFORE_COUNT)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "STATUS=PASS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "EVIDENCE_DIR=$EVID_DIR" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# Cleanup
kill $API_PID 2>/dev/null || true

log "GATE CE07 M3 CONSUMPTION: SUCCESS"
exit 0

# ==============================================================================
# GATE CE07 M3: Memory Consumption (Read → Consume → NO_MUTATION-2)
# ------------------------------------------------------------------------------
# Verifies:
# 1. CONSUMPTION_NON_EMPTY (memory_context contains summary/version)
# 2. IDENTITY_MATCH (identityLockToken required)
# 3. VERSION_CONSISTENT (preferVersion still honored)
# 4. NO_MUTATION_2 (MemorySnapshot count unchanged after consumption)
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce07_m3_consumption_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE07 M3 Consumption Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
sleep 2

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Start API
log "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export API_URL="http://localhost:3001"
export ALLOW_TEST_BILLING_GRANT=1

cd "$(dirname "$0")/../../.."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

if ! pgrep -f "apps/api/dist/main.js" > /dev/null; then
    log "FATAL: API failed to start"
    cat "$EVID_DIR/api.log"
    exit 1
fi

# 3. Setup: Create V1/V2 MemorySnapshot for testing(复用M2 trigger逻辑)
log "Setting up test data..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce07_m2_trigger.ts > "$EVID_DIR/setup_output.txt" 2>&1

PROJECT_ID=$(grep "^PROJECT_ID=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "^IDENTITY_KEY=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$IDENTITY_KEY" ]; then
    log "FATAL: Failed to setup test data"
    cat "$EVID_DIR/setup_output.txt"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "Setup complete: Project=$PROJECT_ID Identity=$IDENTITY_KEY"

# 4. Record DB state before consumption (NO_MUTATION_2 baseline)
BEFORE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

log "DB state before consumption: count=$BEFORE_COUNT"
echo "$BEFORE_COUNT" > "$EVID_DIR/db_count_before.txt"

# 5. Test Consumption: Call Memory Read API (simulating consumption)
log "Test: Consuming memory via read API..."
CONSUME_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY" 2>&1 || echo "{}")
echo "$CONSUME_RESP" > "$EVID_DIR/consumption_response.json"

# 6. Verify CONSUMPTION_NON_EMPTY
log "Verifying consumption result..."
VERSION=$(echo "$CONSUME_RESP" | grep -o SNAPSHOT_ID=$(echo "$CONSUME_RESP" | grep -o 
if [ "$VERSION" = "0" ] || [ -z "$SNAPSHOT_ID" ]; then
    log "FATAL: Consumption result is empty or invalid"
    cat "$EVID_DIR/consumption_response.json"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ CONSUMPTION_NON_EMPTY: version=$VERSION snapshotId=$SNAPSHOT_ID"

# 7. Verify IDENTITY_MATCH
IDENTITY_IN_RESP=$(echo "$CONSUME_RESP" | grep -o 
if [ "$IDENTITY_IN_RESP" != "$IDENTITY_KEY" ]; then
    log "FATAL: Identity mismatch. Expected=$IDENTITY_KEY Got=$IDENTITY_IN_RESP"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ IDENTITY_MATCH verified"

# 8. Verify VERSION_CONSISTENT (preferVersion test)
log "Test: preferVersion=1..."
PREFER_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY&preferVersion=1" 2>&1 || echo "{}")
echo "$PREFER_RESP" > "$EVID_DIR/prefer_v1_response.json"

PREFER_VERSION=$(echo "$PREFER_RESP" | grep -o 
if [ "$PREFER_VERSION" != "1" ]; then
    log "FATAL: VERSION_CONSISTENT failed. Expected v1, got v$PREFER_VERSION"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ VERSION_CONSISTENT verified (preferVersion honored)"

# 9. Verify NO_MUTATION_2 (critical: consumption must not mutate SSOT)
log "Verifying NO_MUTATION_2..."
AFTER_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

echo "$AFTER_COUNT" > "$EVID_DIR/db_count_after.txt"

if [ "$BEFORE_COUNT" != "$AFTER_COUNT" ]; then
    log "FATAL: NO_MUTATION_2 violated! Before=$BEFORE_COUNT After=$AFTER_COUNT"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ NO_MUTATION_2 verified (count stable: $BEFORE_COUNT)"

# 10. Write Evidence
echo "CONSUMPTION_NON_EMPTY=YES" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "VERSION_CONSISTENT=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "NO_MUTATION_2=YES (count=$BEFORE_COUNT)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "STATUS=PASS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "EVIDENCE_DIR=$EVID_DIR" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# Cleanup
kill $API_PID 2>/dev/null || true

log "GATE CE07 M3 CONSUMPTION: SUCCESS"
exit 0

# ==============================================================================
# GATE CE07 M3: Memory Consumption (Read → Consume → NO_MUTATION-2)
# ------------------------------------------------------------------------------
# Verifies:
# 1. CONSUMPTION_NON_EMPTY (memory_context contains summary/version)
# 2. IDENTITY_MATCH (identityLockToken required)
# 3. VERSION_CONSISTENT (preferVersion still honored)
# 4. NO_MUTATION_2 (MemorySnapshot count unchanged after consumption)
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce07_m3_consumption_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE07 M3 Consumption Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
sleep 2

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Start API
log "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export API_URL="http://localhost:3001"
export ALLOW_TEST_BILLING_GRANT=1

cd "$(dirname "$0")/../../.."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

if ! pgrep -f "apps/api/dist/main.js" > /dev/null; then
    log "FATAL: API failed to start"
    cat "$EVID_DIR/api.log"
    exit 1
fi

# 3. Setup: Create V1/V2 MemorySnapshot for testing(复用M2 trigger逻辑)
log "Setting up test data..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce07_m2_trigger.ts > "$EVID_DIR/setup_output.txt" 2>&1

PROJECT_ID=$(grep "^PROJECT_ID=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "^IDENTITY_KEY=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$IDENTITY_KEY" ]; then
    log "FATAL: Failed to setup test data"
    cat "$EVID_DIR/setup_output.txt"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "Setup complete: Project=$PROJECT_ID Identity=$IDENTITY_KEY"

# 4. Record DB state before consumption (NO_MUTATION_2 baseline)
BEFORE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

log "DB state before consumption: count=$BEFORE_COUNT"
echo "$BEFORE_COUNT" > "$EVID_DIR/db_count_before.txt"

# 5. Test Consumption: Call Memory Read API (simulating consumption)
log "Test: Consuming memory via read API..."
CONSUME_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY" 2>&1 || echo "{}")
echo "$CONSUME_RESP" > "$EVID_DIR/consumption_response.json"

# 6. Verify CONSUMPTION_NON_EMPTY
log "Verifying consumption result..."
VERSION=$(echo "$CONSUME_RESP" | grep -o SNAPSHOT_ID=$(echo "$CONSUME_RESP" | grep -o 
if [ "$VERSION" = "0" ] || [ -z "$SNAPSHOT_ID" ]; then
    log "FATAL: Consumption result is empty or invalid"
    cat "$EVID_DIR/consumption_response.json"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ CONSUMPTION_NON_EMPTY: version=$VERSION snapshotId=$SNAPSHOT_ID"

# 7. Verify IDENTITY_MATCH
IDENTITY_IN_RESP=$(echo "$CONSUME_RESP" | grep -o 
if [ "$IDENTITY_IN_RESP" != "$IDENTITY_KEY" ]; then
    log "FATAL: Identity mismatch. Expected=$IDENTITY_KEY Got=$IDENTITY_IN_RESP"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ IDENTITY_MATCH verified"

# 8. Verify VERSION_CONSISTENT (preferVersion test)
log "Test: preferVersion=1..."
PREFER_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY&preferVersion=1" 2>&1 || echo "{}")
echo "$PREFER_RESP" > "$EVID_DIR/prefer_v1_response.json"

PREFER_VERSION=$(echo "$PREFER_RESP" | grep -o 
if [ "$PREFER_VERSION" != "1" ]; then
    log "FATAL: VERSION_CONSISTENT failed. Expected v1, got v$PREFER_VERSION"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ VERSION_CONSISTENT verified (preferVersion honored)"

# 9. Verify NO_MUTATION_2 (critical: consumption must not mutate SSOT)
log "Verifying NO_MUTATION_2..."
AFTER_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

echo "$AFTER_COUNT" > "$EVID_DIR/db_count_after.txt"

if [ "$BEFORE_COUNT" != "$AFTER_COUNT" ]; then
    log "FATAL: NO_MUTATION_2 violated! Before=$BEFORE_COUNT After=$AFTER_COUNT"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ NO_MUTATION_2 verified (count stable: $BEFORE_COUNT)"

# 10. Write Evidence
echo "CONSUMPTION_NON_EMPTY=YES" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "VERSION_CONSISTENT=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "NO_MUTATION_2=YES (count=$BEFORE_COUNT)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "STATUS=PASS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "EVIDENCE_DIR=$EVID_DIR" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# Cleanup
kill $API_PID 2>/dev/null || true

log "GATE CE07 M3 CONSUMPTION: SUCCESS"
exit 0

# ==============================================================================
# GATE CE07 M3: Memory Consumption (Read → Consume → NO_MUTATION-2)
# ------------------------------------------------------------------------------
# Verifies:
# 1. CONSUMPTION_NON_EMPTY (memory_context contains summary/version)
# 2. IDENTITY_MATCH (identityLockToken required)
# 3. VERSION_CONSISTENT (preferVersion still honored)
# 4. NO_MUTATION_2 (MemorySnapshot count unchanged after consumption)
# ==============================================================================

# 0. Setup
EVID_DIR="docs/_evidence/ce07_m3_consumption_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

log "Starting CE07 M3 Consumption Gate..."
log "EVID_DIR: $EVID_DIR"

# Cleanup
pkill -f "apps/api/dist/main.js" || true
pgrep -f "node.*apps/api" | xargs kill -9 2>/dev/null || true
sleep 2

# 1. DB Setup
export POSTGRES_DB="${POSTGRES_DB:-scu}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"

# 2. Start API
log "Starting API..."
export STRIPE_SECRET_KEY="sk_test_dummy"
export API_URL="http://localhost:3001"
export ALLOW_TEST_BILLING_GRANT=1

cd "$(dirname "$0")/../../.."
node apps/api/dist/main.js > "$EVID_DIR/api.log" 2>&1 &
API_PID=$!
sleep 5

if ! pgrep -f "apps/api/dist/main.js" > /dev/null; then
    log "FATAL: API failed to start"
    cat "$EVID_DIR/api.log"
    exit 1
fi

# 3. Setup: Create V1/V2 MemorySnapshot for testing(复用M2 trigger逻辑)
log "Setting up test data..."
npx ts-node -P apps/api/tsconfig.json apps/api/src/dev/ce07_m2_trigger.ts > "$EVID_DIR/setup_output.txt" 2>&1

PROJECT_ID=$(grep "^PROJECT_ID=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d IDENTITY_KEY=$(grep "^IDENTITY_KEY=" "$EVID_DIR/setup_output.txt" | cut -d= -f2 | tr -d 
if [ -z "$PROJECT_ID" ] || [ -z "$IDENTITY_KEY" ]; then
    log "FATAL: Failed to setup test data"
    cat "$EVID_DIR/setup_output.txt"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "Setup complete: Project=$PROJECT_ID Identity=$IDENTITY_KEY"

# 4. Record DB state before consumption (NO_MUTATION_2 baseline)
BEFORE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

log "DB state before consumption: count=$BEFORE_COUNT"
echo "$BEFORE_COUNT" > "$EVID_DIR/db_count_before.txt"

# 5. Test Consumption: Call Memory Read API (simulating consumption)
log "Test: Consuming memory via read API..."
CONSUME_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY" 2>&1 || echo "{}")
echo "$CONSUME_RESP" > "$EVID_DIR/consumption_response.json"

# 6. Verify CONSUMPTION_NON_EMPTY
log "Verifying consumption result..."
VERSION=$(echo "$CONSUME_RESP" | grep -o SNAPSHOT_ID=$(echo "$CONSUME_RESP" | grep -o 
if [ "$VERSION" = "0" ] || [ -z "$SNAPSHOT_ID" ]; then
    log "FATAL: Consumption result is empty or invalid"
    cat "$EVID_DIR/consumption_response.json"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ CONSUMPTION_NON_EMPTY: version=$VERSION snapshotId=$SNAPSHOT_ID"

# 7. Verify IDENTITY_MATCH
IDENTITY_IN_RESP=$(echo "$CONSUME_RESP" | grep -o 
if [ "$IDENTITY_IN_RESP" != "$IDENTITY_KEY" ]; then
    log "FATAL: Identity mismatch. Expected=$IDENTITY_KEY Got=$IDENTITY_IN_RESP"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ IDENTITY_MATCH verified"

# 8. Verify VERSION_CONSISTENT (preferVersion test)
log "Test: preferVersion=1..."
PREFER_RESP=$(curl -s "http://localhost:3001/api/projects/$PROJECT_ID/memory/latest?identityLockToken=$IDENTITY_KEY&preferVersion=1" 2>&1 || echo "{}")
echo "$PREFER_RESP" > "$EVID_DIR/prefer_v1_response.json"

PREFER_VERSION=$(echo "$PREFER_RESP" | grep -o 
if [ "$PREFER_VERSION" != "1" ]; then
    log "FATAL: VERSION_CONSISTENT failed. Expected v1, got v$PREFER_VERSION"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ VERSION_CONSISTENT verified (preferVersion honored)"

# 9. Verify NO_MUTATION_2 (critical: consumption must not mutate SSOT)
log "Verifying NO_MUTATION_2..."
AFTER_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c " # $gate$
    SELECT COUNT(*) FROM memory_snapshots WHERE project_id=" | xargs)

echo "$AFTER_COUNT" > "$EVID_DIR/db_count_after.txt"

if [ "$BEFORE_COUNT" != "$AFTER_COUNT" ]; then
    log "FATAL: NO_MUTATION_2 violated! Before=$BEFORE_COUNT After=$AFTER_COUNT"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

log "✅ NO_MUTATION_2 verified (count stable: $BEFORE_COUNT)"

# 10. Write Evidence
echo "CONSUMPTION_NON_EMPTY=YES" > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "IDENTITY_MATCH=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "VERSION_CONSISTENT=YES" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "NO_MUTATION_2=YES (count=$BEFORE_COUNT)" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "STATUS=PASS" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
echo "EVIDENCE_DIR=$EVID_DIR" >> "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"

# Cleanup
kill $API_PID 2>/dev/null || true

log "GATE CE07 M3 CONSUMPTION: SUCCESS"
exit 0
