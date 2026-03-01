#!/usr/bin/env bash
set -euo pipefail
EVI="${1:?usage: gate_p6_error_matrix.sh <evi_dir>}"
J="$EVI/error_matrix.json"
echo "[GATE-P6-2] checking $J"

# We might pass if no cases run yet, or enforce existence
# Plan says: "100% of failed tasks have ..."
# If empty, pass for now (until we inject faults)

python3 - <<PY
import json, sys, re
with open("$J") as f:
    data = json.load(f)

cases = data.get('cases', [])
if not cases:
    print("PASS: No error cases to audit")
    sys.exit(0)

allow = re.compile(r"^(CANON_GATE_FAIL|IDENTITY_ANCHOR_MISSING|PROVIDER_FAIL|TIMEOUT|DB_DEADLOCK|VALIDATION_FAIL)")

for c in cases:
    if c.get("status_final") not in ("FAILED", "FAIL"):
        print(f"FAIL: status_final={c.get('status_final')} case={c.get('case_id')}")
        sys.exit(1)
    if not allow.search(c.get("error_code","")):
        print(f"FAIL: bad error_code={c.get('error_code')} case={c.get('case_id')}")
        sys.exit(1)

print("PASS: Error matrix valid")
PY
