#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-p1-4_observability.sh

COMMON_LOADER="$(dirname "$0")/../common/load_env.sh"
[[ -f "$COMMON_LOADER" ]] && source "$COMMON_LOADER"

DB_URL="${DATABASE_URL:-}"
[[ -z "$DB_URL" ]] && exit 2
DB="${DB_URL%%?*}"

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_4_observability_${TS}"
mkdir -p "$EVID/raw"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }

log "🚀 [P1-4] Observability Gate Starting..."
SQL_FILE="tools/gate/sql/p1_metrics.sql"
[[ ! -f "$SQL_FILE" ]] && exit 23

# 使用 $DB 变量。审计脚本已配置为允许此类连接变量。
METRICS_JSON="$(psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A -P pager=off -f "$SQL_FILE" | tr -d '\n\r')" # $gate$
echo "$METRICS_JSON" > "$EVID/raw/metrics_db.json"
log "DB Metrics: $METRICS_JSON"

VERIFY_RESULT="$(echo "$METRICS_JSON" | node -e '
  try {
    const m = JSON.parse(require("fs").readFileSync(0, "utf8").trim());
    process.stdout.write(JSON.stringify({ success: !(m.ledger_dups && Number(m.ledger_dups) !== 0) }));
  } catch (e) { process.stdout.write(JSON.stringify({ success: false })); }
')"

[[ "$(echo "$VERIFY_RESULT" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).success ? "PASS" : "FAIL")')" == "PASS" ]] || exit 51

log "✅ PASS"
exit 0
