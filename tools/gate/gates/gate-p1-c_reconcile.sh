#!/bin/bash
set -e

# P1-C Billing Reconciliation & Settlement Gate
# Goal: DRIFT = 0

GATE_NAME="P1-C Reconcile"
ORG_ID="p1c-org"
PROJECT_ID="p1c-test-proj"
INITIAL_CREDITS=1000
EXPECTED_SETTLE=150

echo "--- [GATE] $GATE_NAME START ---"

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

# 1. Start API in background if not running
if ! lsof -i:3000 > /dev/null; then
    echo "Starting API..."
    export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/scu"}
    export API_PORT=3000
    export JWT_SECRET=test-secret
    export JWT_REFRESH_SECRET=test-refresh-secret
    export NODE_ENV=development
    pnpm -w --filter api dev > gate_api.log 2>&1 &
    API_PID=$!
    # Wait for API
    echo "Waiting for API to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/ping > /dev/null; then
            echo "API is up."
            break
        fi
        sleep 1
    done
fi

# 2. Seed Data
echo "[1/4] Seeding Ledgers..."
pnpm -w exec tsx tools/gate/gates/p1c_seed_helper.ts --action=seed_ledgers --orgId=$ORG_ID

# 3. Trigger Settlement via API
echo "[2/4] Triggering Settlement..."
# Generate JWT using helper
# JwtStrategy expects sub, email, tier, orgId
JWT=$(pnpm -w exec tsx tools/gate/gates/gen_token.ts "{\"sub\": \"gate-tester-id\", \"email\": \"gate-tester@test.local\", \"tier\": \"PRO\", \"orgId\": \"$ORG_ID\"}" "test-secret")

curl -s -X POST http://localhost:3000/api/billing/settle \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}" | jq .

echo ""
echo "[3/4] Running SQL Reconciliation..."

# Assertion 1: BILLED ledgers count == billing_events count
LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM cost_ledgers WHERE \"projectId\"='$PROJECT_ID' AND \"billing_status\"='BILLED';")
EVENT_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM billing_events WHERE project_id='$PROJECT_ID';")

echo "Assertion 1: Count Check..."
echo "  BILLED Ledgers: $LEDGER_COUNT"
echo "  Billing Events: $EVENT_COUNT"

if [ "$LEDGER_COUNT" -ne "$EVENT_COUNT" ]; then
    echo "❌ Assertion 1 Failed: BILLED Ledger Count ($LEDGER_COUNT) != Billing Event Count ($EVENT_COUNT)"
    exit 1
fi

# Assertion 2: Idempotency (Distinct cost_ledger_id coverage)
DISTINCT_LEDGER_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(DISTINCT cost_ledger_id) FROM billing_events WHERE project_id='$PROJECT_ID' AND cost_ledger_id IS NOT NULL;")
NULL_LEDGER_CHECK=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM billing_events WHERE project_id='$PROJECT_ID' AND cost_ledger_id IS NULL;")

echo "Assertion 2: Idempotency & Uniqueness Check..."
echo "  Distinct Ledger IDs: $DISTINCT_LEDGER_COUNT"
echo "  Null Ledger ID Count: $NULL_LEDGER_CHECK"

if [ "$DISTINCT_LEDGER_COUNT" -ne "$EVENT_COUNT" ] || [ "$NULL_LEDGER_CHECK" -ne 0 ]; then
    echo "❌ Assertion 2 Failed: Uniqueness or Null check failed!"
    exit 1
fi

# Assertion 3: Value Consistency (ROUND(SUM, 6))
SUM_LEDGER_ROUND=$(psql "$DATABASE_URL" -t -A -c "SELECT ROUND(SUM(\"totalCredits\")::numeric, 6) FROM cost_ledgers WHERE \"projectId\"='$PROJECT_ID' AND \"billing_status\"='BILLED';")
SUM_EVENT_ROUND=$(psql "$DATABASE_URL" -t -A -c "SELECT ROUND(ABS(SUM(credits_delta))::numeric, 6) FROM billing_events WHERE project_id='$PROJECT_ID';")

# Note: Check for NULL fields in billing_events
NULL_CREDITS_CHECK=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM billing_events WHERE project_id='$PROJECT_ID' AND credits_delta IS NULL;")

echo "Assertion 3: Rounded Sum & Null Field Check..."
echo "  Sum(Ledger): $SUM_LEDGER_ROUND"
echo "  Sum(Event):  $SUM_EVENT_ROUND"
echo "  Null Credits Count: $NULL_CREDITS_CHECK"

if [ "$SUM_LEDGER_ROUND" != "$SUM_EVENT_ROUND" ] || [ "$NULL_CREDITS_CHECK" -ne 0 ]; then
    echo "❌ Assertion 3 Failed: Rounded Sum Mismatch or NULL credits detected!"
    exit 1
fi

QUERY_CREDITS="SELECT credits FROM organizations WHERE id='$ORG_ID';"
FINAL_CREDITS=$(psql "$DATABASE_URL" -t -A -c "$QUERY_CREDITS")
DELTA_CREDITS=$(echo "$INITIAL_CREDITS - $FINAL_CREDITS" | bc)

DRIFT=$(echo "$SUM_EVENT_ROUND - $DELTA_CREDITS" | bc)
echo "Final Drift Check: $DRIFT"

if [ "$(echo "$DRIFT == 0" | bc)" -eq 1 ]; then
    echo "✅ DRIFT = 0. Strong Consistency Verified."
else
    echo "❌ Drift detected: $DRIFT"
    exit 1
fi

# 4. Audit Verification
echo "[4/4] Verifying Audit Logs..."
# Check Integrity: nonce, signature, timestamp MUST NOT BE NULL
# Check Traceability: details->_traceId MUST NOT BE NULL
INVALID_AUDITS=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM audit_logs WHERE action LIKE 'billing.%' AND (nonce IS NULL OR signature IS NULL OR timestamp IS NULL OR (details->>'_traceId') IS NULL);")
AUDIT_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM audit_logs WHERE (\"resourceId\" = '$PROJECT_ID' OR \"resourceId\" = '$ORG_ID') AND action LIKE 'billing.%';")

echo "Audit Integrity Check..."
echo "  Invalid Audits (Null nonce/sig/ts or missing _traceId): $INVALID_AUDITS"
echo "  Total Billing Audits: $AUDIT_COUNT"

if [ "$INVALID_AUDITS" -ne 0 ]; then
    echo "❌ Audit Integrity Failed: Found $INVALID_AUDITS audits with missing evidence fields!"
    # List them for debug
    psql "$DATABASE_URL" -c "SELECT action, nonce, signature, timestamp, (details->>'_traceId') as trace_id FROM audit_logs WHERE action LIKE 'billing.%' AND (nonce IS NULL OR signature IS NULL OR timestamp IS NULL OR (details->>'_traceId') IS NULL) LIMIT 5;"
    exit 1
fi

if [ "$AUDIT_COUNT" -gt 0 ]; then
    echo "✅ Audit Logs Verified (Integrity & Count OK)."
else
    echo "❌ Missing Audit Logs (Found only $AUDIT_COUNT)!"
    exit 1
fi

# Cleanup
if [ ! -z "$API_PID" ]; then
    kill $API_PID
fi

echo "--- [GATE] $GATE_NAME PASS ---"
