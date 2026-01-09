#!/bin/bash
set -e

# --- [GATE] P1-D Billing Readonly Closure ---
GATE_NAME="P1-D Billing Readonly"
echo "--- [GATE] $GATE_NAME START ---"

# --- JWT Secret must be explicitly set (no fallback) ---
if [ -z "$JWT_SECRET" ]; then
  echo "❌ Missing JWT_SECRET (P1-D requires explicit secret; no fallback allowed)."
  exit 1
fi

# --- Audit signing secret must be explicitly set (P1-D key governance) ---
if [ -z "$AUDIT_SIGNING_SECRET" ]; then
  echo "❌ Missing AUDIT_SIGNING_SECRET (P1-D requires explicit audit signing secret; no fallback allowed)."
  exit 1
fi

# Environment setup (use existing secrets from caller)
export API_PORT=3001
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"
export JWT_SECRET="${JWT_SECRET}"  # Ensure JWT_SECRET is exported to API subprocess
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$JWT_SECRET}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export LOG_LEVEL="debug"
export NODE_ENV="development"

# Start API in background
pkill -f "node apps/api/dist/main" || true
(cd apps/api && npm run dev) > api_gate_p1d_output.txt 2>&1 &
API_PID=$!

echo "Starting API..."
# Wait for API
for i in {1..30}; do
    if curl -s http://localhost:$API_PORT/health > /dev/null; then
        echo "API is up."
        break
    fi
    if [ $i -eq 30 ]; then 
        echo "❌ API failed to start"
        cat api_gate_p1d_output.txt
        exit 1
    fi
    sleep 2
done

# 1. Setup Test Data
ORG_ID="org-p1d-test"
PROJECT_ID="proj-p1d-test"
USER_ID="user-p1d-test"

# Delete old test data (order matters for FK constraints)
psql "$DATABASE_URL" -c "DELETE FROM billing_events WHERE project_id = '$PROJECT_ID';"
psql "$DATABASE_URL" -c "DELETE FROM cost_ledgers WHERE \"projectId\" = '$PROJECT_ID';"
psql "$DATABASE_URL" -c "DELETE FROM projects WHERE id = '$PROJECT_ID';"
psql "$DATABASE_URL" -c "DELETE FROM organizations WHERE id = '$ORG_ID';"
psql "$DATABASE_URL" -c "DELETE FROM users WHERE id = '$USER_ID';"
# Create test user first (required for ownerId FK)
psql "$DATABASE_URL" -c "INSERT INTO users (id, email, \"passwordHash\", \"updatedAt\") VALUES ('$USER_ID', 'p1d-test@test.com', 'test-hash', NOW()) ON CONFLICT (id) DO NOTHING;"
# Create org with ownerId
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, \"updatedAt\") VALUES ('$ORG_ID', 'P1D Test Org', '$USER_ID', 1000, NOW());"
# Create project (required for CostLedger FK)
psql "$DATABASE_URL" -c "INSERT INTO projects (id, name, \"organizationId\", \"ownerId\", \"updatedAt\") VALUES ('$PROJECT_ID', 'P1D Test Project', '$ORG_ID', '$USER_ID', NOW());"

# Generate Token using zero-dependency HS256 JWT generator
# JwtPayload interface expects: sub, email, tier, orgId
JWT_PAYLOAD="{\"sub\":\"$USER_ID\",\"email\":\"p1d-test@test.com\",\"tier\":\"Free\",\"orgId\":\"$ORG_ID\"}"
TOKEN=$(node tools/gate/gates/jwt_hs256.js "$JWT_SECRET" "$JWT_PAYLOAD" 3600)
if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate JWT."
  exit 1
fi
echo "JWT generated successfully."

# Seed Ledgers (create 5 PENDING CostLedgers with total credits = 150)
echo "Seeding test data..."
for i in 1 2 3 4 5; do
  CREDITS=$((10 * i))  # 10, 20, 30, 40, 50 = Sum 150
  psql "$DATABASE_URL" -c "INSERT INTO cost_ledgers (id, \"projectId\", \"orgId\", \"jobId\", \"jobType\", \"totalCredits\", \"billing_status\", \"created_at\") VALUES ('ledger-p1d-$i', '$PROJECT_ID', '$ORG_ID', 'job-p1d-$i', 'SHOT_RENDER', $CREDITS, 'PENDING', NOW());"
done
echo "✅ Seeded 5 PENDING CostLedgers. Total Credits: 150"

# 2. Trigger Settlement
echo "[1/4] Triggering Settlement..."
curl -s -X POST http://localhost:$API_PORT/api/billing/settle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}" > settle_res.json
cat settle_res.json

# 3. Test Read APIs
echo "[2/4] Testing Read APIs..."

echo "Checking /api/billing/events..."
EVENTS_RES=$(curl -s "http://localhost:$API_PORT/api/billing/events?projectId=$PROJECT_ID" -H "Authorization: Bearer $TOKEN")
EVENT_COUNT=$(echo $EVENTS_RES | jq '.total')
if [ "$EVENT_COUNT" -ne 5 ]; then
    echo "❌ Event count mismatch: Expected 5, got $EVENT_COUNT"
    echo $EVENTS_RES
    exit 1
fi
echo "✅ /api/billing/events OK (Total: $EVENT_COUNT)"

echo "Checking /api/billing/ledgers..."
LEDGERS_RES=$(curl -s "http://localhost:$API_PORT/api/billing/ledgers?projectId=$PROJECT_ID&status=BILLED" -H "Authorization: Bearer $TOKEN")
LEDGER_COUNT=$(echo $LEDGERS_RES | jq '.total')
if [ "$LEDGER_COUNT" -ne 5 ]; then
    echo "❌ Ledger count mismatch: Expected 5, got $LEDGER_COUNT"
    exit 1
fi
echo "✅ /api/billing/ledgers OK (Total: $LEDGER_COUNT)"

echo "Checking /api/billing/summary..."
SUMMARY_RES=$(curl -s "http://localhost:$API_PORT/api/billing/summary?projectId=$PROJECT_ID" -H "Authorization: Bearer $TOKEN")
SUM_DELTA=$(echo $SUMMARY_RES | jq '.totalCreditsDelta')
# Note: creditsDelta is positive for CONSUME in current implementation
if [ "$SUM_DELTA" != "150" ]; then
    echo "❌ Summary delta mismatch: Expected 150, got $SUM_DELTA"
    exit 1
fi
echo "✅ /api/billing/summary OK (Delta: $SUM_DELTA)"

echo "Checking /api/billing/reconcile/status..."
RECONCILE_RES=$(curl -s "http://localhost:$API_PORT/api/billing/reconcile/status?projectId=$PROJECT_ID" -H "Authorization: Bearer $TOKEN")
IS_CONSISTENT=$(echo $RECONCILE_RES | jq '.isConsistent')
if [ "$IS_CONSISTENT" != "true" ]; then
    echo "❌ Reconcile status returned inconsistent!"
    echo $RECONCILE_RES
    exit 1
fi
echo "✅ /billing/reconcile/status OK (Consistent: true)"

# 4. Verify Audit Governance
echo "[3/4] Verifying Audit Governance..."
# Check auditKeyVersion
V1_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM audit_logs WHERE \"resourceId\" = '$PROJECT_ID' AND payload->>'auditKeyVersion' = 'v1';")
if [ "$V1_COUNT" -eq 0 ]; then
    echo "❌ No v1 audit keys found for this project!"
    exit 1
fi
echo "✅ Audit Key Version 'v1' verified in DB."

# Check _traceId presence
TRACE_MISSED=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM audit_logs WHERE action LIKE 'billing.settle%' AND (details->>'_traceId') IS NULL;")
if [ "$TRACE_MISSED" -ne 0 ]; then
    echo "❌ Found $TRACE_MISSED audits missing _traceId in details!"
    exit 1
fi
echo "✅ Trace Isolation verified."

# 5. Regression Check (P1-C Legacy Gate)
echo "[4/4] Running Legacy Column Isolation Check..."
COLUMN_EXISTS=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='trace_id';")
if [ "$COLUMN_EXISTS" -eq 1 ]; then
    LEGACY_TRACE_WRITES=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM audit_logs WHERE action LIKE 'billing.%' AND (trace_id IS NOT NULL AND trace_id <> '');")
    if [ "$LEGACY_TRACE_WRITES" -ne 0 ]; then
        echo "❌ Legacy Column Isolation Failed: Found $LEGACY_TRACE_WRITES audits writing to physical trace_id column!"
        exit 1
    fi
fi
echo "✅ Legacy Isolation Regression OK."

# Cleanup
if [ ! -z "$API_PID" ]; then
    kill $API_PID
fi

echo "--- [GATE] $GATE_NAME PASS ---"
