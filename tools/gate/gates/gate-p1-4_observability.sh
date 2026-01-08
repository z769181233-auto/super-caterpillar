#!/bin/bash
set -euo pipefail

# gate-p1-4_observability.sh
# Verifies system observability metrics against the SSOT Spec.
# Enforces Zero Duplicates and Health Thresholds via direct DB inspection.

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi
DB="${DB_URL%%\?*}"

# --- Safety Guard ---
if ! echo "$DB" | grep -Eq 'localhost|127\.0\.0\.1'; then
  echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  exit 99
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_4_observability_${TS}"
mkdir -p "$EVID/raw"
RUN_STARTED_AT_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
export RUN_STARTED_AT_ISO
log "RUN_STARTED_AT_ISO: ${RUN_STARTED_AT_ISO}"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A -P pager=off "$@"; }

# Check Node requirement
if ! command -v node >/dev/null 2>&1; then
  log "❌ node not found. This gate requires Node.js."
  exit 22
fi

log "🚀 [P1-4] Observability Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"

# 1. Run Metrics SQL
log "== Step 1: Querying Metrics SSOT =="
SQL_FILE="tools/gate/sql/p1_metrics.sql"
if [[ ! -f "$SQL_FILE" ]]; then
  log "❌ SQL file not found: $SQL_FILE"
  exit 23
fi

METRICS_JSON="$(psqlq -f "$SQL_FILE" | tr -d '\r' | awk 'NF{print}')"
echo "$METRICS_JSON" > "$EVID/raw/metrics_db.json"
log "DB Metrics: $METRICS_JSON"

# 2. Threshold Verification (Node.js)
log "== Step 2: Verifying Thresholds =="
VERIFY_RESULT="$(echo "$METRICS_JSON" | node -e '
  const fs = require("fs");
  try {
    const input = fs.readFileSync(0, "utf-8");
    const m = JSON.parse(input);
    const errors = [];
    
    // 1. Ledger Duplicates MUST be 0
    if (m.ledger_dups !== 0) {
      errors.push(`FAIL: Ledger Duplicates Detected: ${m.ledger_dups}`);
    }

    // 2. Health Sanity (Pending Leak)
    const PENDING_LIMIT = 50; 
    if (m.jobs_pending > PENDING_LIMIT) {
      errors.push(`FAIL: Pending Jobs Leaked: ${m.jobs_pending} > ${PENDING_LIMIT}`);
    }

    if (errors.length > 0) {
      console.log(JSON.stringify({ success: false, errors }));
    } else {
      console.log(JSON.stringify({ success: true, metrics: m }));
    }
  } catch (e) {
    console.log(JSON.stringify({ success: false, errors: ["JSON Parse Error: " + e.message] }));
  }
')"

# Robust Check (require fs, explicit string output)
CHECK_STATUS="$(echo "$VERIFY_RESULT" | node -e '
  const fs = require("fs");
  try {
    const res = JSON.parse(fs.readFileSync(0, "utf-8"));
    console.log(res.success === true ? "PASS" : "FAIL");
  } catch(e) {
    console.log("FAIL_PARSE");
  }
')"

if [[ "$CHECK_STATUS" == "PASS" ]]; then
  log "✅ DB Metrics Verification PASS"
else
  ERRORS="$(echo "$VERIFY_RESULT" | node -e '
    const fs = require("fs");
    try {
      const res = JSON.parse(fs.readFileSync(0, "utf-8"));
      if (res.errors) console.log(res.errors.join(", "));
      else console.log("Unknown Error");
    } catch(e) {
      console.log("Result Parse Error: " + e.message);
    }
  ')"
  log "❌ DB Metrics Verification FAIL: $ERRORS"
  echo "$ERRORS" > "$EVID/failure_reason.txt"
  exit 51
fi

# 3. Final Report
cat > "${EVID}/FINAL_REPORT.md" <<EOF
# P1-4 Observability Gate - FINAL REPORT

- Timestamp: ${TS}
- DB Verification: PASS
- Ledger Duplicates: 0

## Metrics Snapshot
\`\`\`json
${METRICS_JSON}
\`\`\`

## Evidence
- gate.log
- raw/metrics_db.json
EOF

log "✅ P1-4 Gate PASS. Report: ${EVID}/FINAL_REPORT.md"
