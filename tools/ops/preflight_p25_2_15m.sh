#!/bin/bash
# tools/ops/preflight_p25_2_15m.sh
# 目的：在 15M (P25-2) 压测前执行环境健康审计，防止物理崩溃。

set -euo pipefail

DISK_THRESHOLD=80
JOB_THRESHOLD=10000

echo "=============================================="
echo "PREFLIGHT: P25-2 15M Words Scaling Guard"
echo "=============================================="

# 1. Disk Check
log_disk() {
    USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "[CHECK] Disk Usage: ${USAGE}% (Limit: ${DISK_THRESHOLD}%)"
    if [ "$USAGE" -gt "$DISK_THRESHOLD" ]; then
        echo "❌ FAIL: Disk usage exceeds threshold."
        exit 1
    fi
}

# 2. DB Bloat & Index Check
log_db() {
    echo "[CHECK] Analyzing DB Health (Inflated tables / Dead tuples)..."
    # Execute query to check for dead tuples/bloat (Simplified for CLI)
    psql "$DATABASE_URL" -c "SELECT relname, n_dead_tup, last_vacuum, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;"
}

# 3. Queue Backlog
log_queue() {
    PENDING=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM shot_jobs WHERE status = 'PENDING';")
    PENDING=$(echo "$PENDING" | tr -d '[:space:]')
    echo "[CHECK] Pending Jobs: $PENDING (Limit: ${JOB_THRESHOLD})"
    if [ "$PENDING" -gt "$JOB_THRESHOLD" ]; then
        echo "❌ FAIL: Queue backlog too high. Flush required."
        exit 1
    fi
}

log_disk
log_db
log_queue

echo "=============================================="
echo "✅ PREFLIGHT PASSED: Environment is safe for 15M Scaling."
echo "=============================================="
