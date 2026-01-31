#!/usr/bin/env bash
set -euo pipefail
EVI="${1:?usage: gate_p6_billing.sh <evi_dir>}"
J="$EVI/billing_reconciliation.json"
echo "[GATE-P6-1] checking $J"

# Check if array has items
LEN=$(jq '. | length' "$J")
if [ "$LEN" -eq 0 ]; then
  echo "WARN: No billing records found in run."
  exit 0
fi

# Verify each record
# using python for float comparison
python3 - <<PY
import json, sys
with open("$J") as f:
    data = json.load(f)

for item in data:
    delta = float(item['balance_delta'])
    ledger = float(item['ledger_debit_sum'])
    err = float(item['relative_error'])
    
    if abs(delta - ledger) > 1e-6:
        print(f"FAIL: delta {delta} != ledger {ledger}")
        sys.exit(1)
        
    if err >= 0.01:
        print(f"FAIL: relative error {err} >= 0.01")
        sys.exit(1)

print("PASS: Billing reconciliation consistent")
PY
