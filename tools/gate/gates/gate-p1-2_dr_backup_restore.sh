#!/bin/bash
set -euo pipefail

# P1-2: DR Backup & Restore Gate
# 目标:备份 → 清库 → 恢复 → 核心表行数一致 + FK orphan=0
# 证据:FINAL_REPORT.md + assets/*.log

source "$(dirname "${BASH_SOURCE[0]}")/../common/load_env.sh"

export API_PORT="${API_PORT:-3001}"
export API_URL="${API_URL:-http://127.0.0.1:${API_PORT}/api}"

TS="$(date +%Y%m%d_%H%M%S)"
EVID_DIR="docs/_evidence/p1_2_dr_backup_restore_${TS}"
ASSETS_DIR="${EVID_DIR}/assets"
mkdir -p "${ASSETS_DIR}"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "${ASSETS_DIR}/gate.log"; }
fail() { log "❌ $*"; exit 1; }

DB_URL_CLEAN="${DATABASE_URL%%\?*}"

psqllog() {
  local name="$1"
  local sql="$2"
  {
    echo "---- SQL ----"
    echo "$sql"
    echo "---- OUT ----"
    echo "$sql" | psql "${DB_URL_CLEAN}" -v ON_ERROR_STOP=1 -X
    echo
  } >> "${ASSETS_DIR}/${name}.log" 2>&1
}

snap_sql='
SELECT ''users'' as tbl, count(*) as cnt FROM users
UNION ALL SELECT ''organizations'', count(*) FROM organizations
UNION ALL SELECT ''projects'', count(*) FROM projects
UNION ALL SELECT ''seasons'', count(*) FROM seasons
UNION ALL SELECT ''episodes'', count(*) FROM episodes
UNION ALL SELECT ''scenes'', count(*) FROM scenes
UNION ALL SELECT ''shots'', count(*) FROM shots
UNION ALL SELECT ''shot_jobs'', count(*) FROM shot_jobs
UNION ALL SELECT ''worker_nodes'', count(*) FROM worker_nodes
UNION ALL SELECT ''cost_ledgers'', count(*) FROM cost_ledgers
UNION ALL SELECT ''billing_events'', count(*) FROM billing_events
UNION ALL SELECT ''audit_logs'', count(*) FROM audit_logs
ORDER BY tbl;
'

orphan_sql='
SELECT ''scenes_orphan'' as check, count(*) as cnt
FROM scenes s LEFT JOIN episodes e ON s."episodeId"=e.id WHERE e.id IS NULL;
SELECT ''shots_orphan'' as check, count(*) as cnt
FROM shots sh LEFT JOIN scenes sc ON sh."sceneId"=sc.id WHERE sc.id IS NULL;
SELECT ''shot_jobs_orphan'' as check, count(*) as cnt
FROM shot_jobs sj LEFT JOIN projects p ON sj."projectId"=p.id WHERE p.id IS NULL;
'

log "🚀 [P1-2 DR] Starting gate..."
log "DB_URL_CLEAN=${DB_URL_CLEAN}"
log "EVID_DIR=${EVID_DIR}"

# --- 0) Safety guard: must be non-prod gate db ---
if ! echo "${DB_URL_CLEAN}" | grep -Eq '(localhost|127\.0\.0\.1)'; then
  fail "Refusing to run DR gate on non-local DB_URL_CLEAN. (safety guard)"
fi

# --- 1) Snapshot BEFORE ---
log "📸 Snapshot BEFORE backup..."
psqllog "sql_snapshot_before" "${snap_sql}"
psqllog "sql_orphans_before" "${orphan_sql}"

# --- 2) Backup ---
log "💾 Running backup script..."
BACKUP_OUT="${ASSETS_DIR}/backup.log"
set +e
bash tools/backup/db_backup.sh 2>&1 | tee "${BACKUP_OUT}"
set -e

BACKUP_FILE="$(grep -Eo '\.data/backups/[^ ]+\.dump\.gz' "${BACKUP_OUT}" | tail -1 || true)"
[[ -n "${BACKUP_FILE}" ]] || fail "Could not detect BACKUP_FILE from backup.log"

log "✅ Backup file: ${BACKUP_FILE}"

# --- 3) Drop & recreate schema (gate-only) ---
log "🧨 Dropping schema public..."
{
  echo 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
} | psql "${DB_URL_CLEAN}" -v ON_ERROR_STOP=1 -X >> "${ASSETS_DIR}/drop_schema.log" 2>&1

# --- 4) Restore ---
log "♻️ Restoring from backup..."
bash tools/backup/db_restore.sh "${BACKUP_FILE}" 2>&1 | tee "${ASSETS_DIR}/restore.log"

# --- 5) Snapshot AFTER ---
log "📸 Snapshot AFTER restore..."
psqllog "sql_snapshot_after" "${snap_sql}"
psqllog "sql_orphans_after" "${orphan_sql}"

# --- 6) Assert equality: diff snapshots ---
awk '/^\s*(users|organizations|projects|seasons|episodes|scenes|shots|shot_jobs|worker_nodes|cost_ledgers|billing_events|audit_logs)\s*\|/ {gsub(/ /,""); print}' \
  "${ASSETS_DIR}/sql_snapshot_before.log" > "${ASSETS_DIR}/snap_before.norm" || true
awk '/^\s*(users|organizations|projects|seasons|episodes|scenes|shots|shot_jobs|worker_nodes|cost_ledgers|billing_events|audit_logs)\s*\|/ {gsub(/ /,""); print}' \
  "${ASSETS_DIR}/sql_snapshot_after.log" > "${ASSETS_DIR}/snap_after.norm" || true

if ! diff -u "${ASSETS_DIR}/snap_before.norm" "${ASSETS_DIR}/snap_after.norm" > "${ASSETS_DIR}/snapshot_diff.log"; then
  fail "Snapshot row counts mismatch after restore. See assets/snapshot_diff.log"
fi

# Orphan must be 0
orph_after="$(awk '/orphan/ {print $NF}' "${ASSETS_DIR}/sql_orphans_after.log" | tail -3 | tr -d ' ' | tr '\n' ' ' )"
echo "orphans_after=${orph_after}" >> "${ASSETS_DIR}/dr_assertions.log"

if ! awk '/orphan/ {gsub(/ /,""); if ($NF!="0") exit 1} END{exit 0}' "${ASSETS_DIR}/sql_orphans_after.log"; then
  fail "FK orphan detected after restore. See assets/sql_orphans_after.log"
fi

# --- 7) FINAL_REPORT ---
cat > "${EVID_DIR}/FINAL_REPORT.md" <<EOF
# P1-2 DR Backup & Restore Gate - FINAL REPORT

- Timestamp: ${TS}
- DB_URL_CLEAN: (redacted)
- Backup file: ${BACKUP_FILE}
- Result: PASS

## Key Assertions
- Backup produced dump + metadata (see backup.log)
- Restore completed (see restore.log)
- Core table row counts match (see snapshot_diff.log = empty diff)
- FK orphan checks all 0

## Evidence Files
- assets/gate.log
- assets/backup.log
- assets/restore.log
- assets/drop_schema.log
- assets/sql_snapshot_before.log
- assets/sql_snapshot_after.log
- assets/sql_orphans_before.log
- assets/sql_orphans_after.log
- assets/snapshot_diff.log
EOF

log "✅ Gate Passed. Evidence: ${EVID_DIR}"
