#!/bin/bash
# tools/gate/scripts/inject_all_verify_db_credits.sh
# 强制注入 5433 端口上所有验证数据库的额度，并初始化预算中心

set -euo pipefail

PGHOST="127.0.0.1"
PGPORT="5433"
PGUSER="postgres"
export PGPASSWORD="${PGPASSWORD:-postgres}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [DB_PATCH] $1"
}

log "Scanning for verify databases on $PGHOST:$PGPORT..."

DB_LIST=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -l -t | cut -d'|' -f1 | xargs)

PATCH_COUNT=0
for db in $DB_LIST; do
  # 仅处理 scu, super_caterpillar_dev 和 verify 数据库
  if [[ "$db" == "scu" ]] || [[ "$db" == "super_caterpillar_dev" ]] || [[ "$db" == super_caterpillar_verify_* ]]; then
    log "Patching database: $db"
    
    # 1. 注入 Organization Credits
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -c "UPDATE \"organizations\" SET credits = 1000000 WHERE credits < 1000000;" > /dev/null 2>&1 || true
    
    # 2. 初始化 CostCenter (如果表存在)
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -c "
      INSERT INTO \"cost_centers\" (id, \"organizationId\", name, budget, \"currentCost\", \"updatedAt\")
      SELECT 'cc-' || id, id, 'Default Cost Center', 1000000, 0, NOW()
      FROM \"organizations\"
      ON CONFLICT (id) DO UPDATE SET budget = 1000000, \"currentCost\" = 0;
    " > /dev/null 2>&1 || true
    
    PATCH_COUNT=$((PATCH_COUNT + 1))
  fi
done

log "Patch complete. $PATCH_COUNT databases were scanned/patched."
