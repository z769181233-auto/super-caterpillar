#!/bin/bash
# tools/ops/cleanup_p25_2_15m.sh
# 目的：压测后批量清理 p25_ 系列压测数据，恢复环境纯净。

set -euo pipefail

echo "=============================================="
echo "CLEANUP: P25 Scaling Data Purge"
echo "=============================================="

if [ "${1:-}" != "--confirm" ]; then
    echo "[DRY-RUN] Found the following counts for p25_ prefix:"
    psql "$DATABASE_URL" -c "SELECT type, count(*) as count FROM shot_jobs WHERE trace_id LIKE 'probe_p25%' OR trace_id LIKE 'trace_mock%' OR projectId LIKE 'proj_p25%' GROUP BY type;"
    echo "Run with --confirm to execute deletion."
    exit 0
fi

echo "[CLEANUP] Purging data..."

# Order matters for constraints
psql "$DATABASE_URL" -c "DELETE FROM billing_events WHERE \"project_id\" LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM assets WHERE \"projectId\" LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM cost_ledgers WHERE \"projectId\" LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM shots WHERE id IN (SELECT s.id FROM shots s JOIN scenes sc ON s.\"sceneId\" = sc.id WHERE sc.project_id LIKE 'proj_p25%');"
psql "$DATABASE_URL" -c "DELETE FROM scenes WHERE project_id LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM episodes WHERE \"projectId\" LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM shot_jobs WHERE \"projectId\" LIKE 'proj_p25%';"
psql "$DATABASE_URL" -c "DELETE FROM projects WHERE id LIKE 'proj_p25%';"

echo "[CLEANUP] Running VACUUM ANALYZE..."
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

echo "=============================================="
echo "✅ CLEANUP COMPLETE"
echo "=============================================="
