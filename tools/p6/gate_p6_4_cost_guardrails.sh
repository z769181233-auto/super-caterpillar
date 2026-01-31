#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p6_4_cost_guardrails.sh <evidence_dir>}"
mkdir -p "$EVI"

need git

log "[P6-4] scan for credits/ledger bypass in code (exclude tools/smoke)..."
BYPASS="$(grep_hits_fileline '(DISABLE|BYPASS|SKIP)_(CREDITS|LEDGER|QUOTA)|CREDITS_DISABLED|LEDGER_DISABLED|FREE_CREDITS' apps packages tools | grep -v 'tools/smoke/' || true)"
printf "%s\n" "$BYPASS" | sed '/^$/d' > "$EVI/p6_4_bypass_scan_fileline.txt"
if [ -s "$EVI/p6_4_bypass_scan_fileline.txt" ]; then
  log "[P6-4] FAIL: bypass-like flags detected (see p6_4_bypass_scan_fileline.txt)"
  exit 1
fi

log "[P6-4] running negative tests (required)..."
NEG=""
if [ -f negative_tests.sh ]; then
  NEG="negative_tests.sh"
elif [ -f tools/negative_tests.sh ]; then
  NEG="tools/negative_tests.sh"
elif [ -f tools/gate/gates/negative_tests.sh ]; then
  NEG="tools/gate/gates/negative_tests.sh"
fi
[ -n "$NEG" ] || die "negative_tests.sh not found (required for P6-4)"

bash "$NEG" 2>&1 | tee "$EVI/p6_4_negative_tests.log"

REPORT="$EVI/p6_4_cost_guardrails_audit.json"
json_write "$REPORT" "$(node - <<'NODE'
const out = {
  gate: "P6-4",
  name: "cost guardrails (no bypass + negative tests)",
  status: "PASS",
  artifacts: {
    bypass_scan_fileline: "p6_4_bypass_scan_fileline.txt",
    negative_tests_log: "p6_4_negative_tests.log",
  },
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
NODE
)"
