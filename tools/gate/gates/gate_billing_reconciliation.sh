#!/bin/bash
set -e

# P6-1: Billing Ledger Reconciliation Gate
echo "===================================================="
echo "P6-1 BILLING LEDGER RECONCILIATION GATE"
echo "===================================================="

EVI=$(cat .current_p6_1_evi 2>/dev/null || echo "docs/_evidence/p6_1_billing_ledger_latest")
mkdir -p "$EVI"

echo "[Step 1] Running Reconciliation Script..."
npx ts-node tools/gate/scripts/reconcile_billing.ts \
  "docs/_evidence/p6_0_massive_import_seal_20260204_233835/perf.json" \
  "$EVI/reconciliation_report.json" | tee "$EVI/reconcile.log"

echo "[Step 2] Checking for Duplicate Billing..."
DUPES=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "SELECT COUNT(*) FROM (SELECT \"tenantId\", \"traceId\", \"itemType\", \"itemId\", \"chargeCode\", COUNT(*) FROM billing_ledger GROUP BY \"tenantId\", \"traceId\", \"itemType\", \"itemId\", \"chargeCode\" HAVING COUNT(*) > 1) AS dupes;")

if [ "$DUPES" -gt 0 ]; then
  echo "❌ FAIL: Found $DUPES duplicate billing entries."
  exit 1
fi

echo "✅ No duplicate billing entries found."

echo "[Step 3] Checking Failed Jobs for Posted Charges..."
FAILED_POSTED=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "SELECT COUNT(*) FROM billing_ledger bl INNER JOIN shot_jobs sj ON bl.\"traceId\" = sj.id WHERE sj.status = 'FAILED' AND bl.status = 'POSTED';")

if [ "$FAILED_POSTED" -gt 0 ]; then
  echo "❌ FAIL: Found $FAILED_POSTED POSTED charges for FAILED jobs."
  exit 1
fi

echo "✅ No POSTED charges for FAILED jobs."

echo "[Step 4] Validating Report..."
cat "$EVI/reconciliation_report.json"

echo ""
echo "✅ P6-1 RECONCILIATION GATE PASSED"
