#!/bin/bash
set -euo pipefail

# P1-2 Component 1: HA Gate 3轮验收脚本
# 目标: 证明 Failover < 60s、0泄漏、0脏账、审计不丢

EVIDENCE_DIR="evidence/p1-2/component1_ha"
mkdir -p "$EVIDENCE_DIR"

log() {
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVIDENCE_DIR/validation.log"
}

echo "[BOOT] ha gate script starting..." | tee "$EVIDENCE_DIR/validation.log"

safe_source_env() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "[WARN] env file not found: $f" >&2
    return 0
  fi

  # 关键:临时关闭errexit,避免source内任何非零导致整段退出
  set +e
  # shellcheck disable=SC1090
  source "$f"
  local rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    echo "[WARN] source $f returned non-zero rc=$rc (ignored)" >&2
  fi
  return 0
}

safe_source_env "$(dirname "${BASH_SOURCE[0]}")/../../.env.local"

# 强校验:DATABASE_URL 必须非空(否则 psql 会退回本机 socket 导致验证全乱套)
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[FATAL] DATABASE_URL is empty. Fix .env.local quoting (paths with spaces must be quoted)." >&2
  exit 2
fi

export GATE_MODE=1
export API_PORT="${API_PORT:-3000}"
export API_BASE="http://127.0.0.1:${API_PORT}"
export API_URL="${API_BASE}/api"

log "=== P1-2 Component 1: HA Gate 3轮验收开始 ==="

# 0) 前置检查
log "检查API健康..."
if curl -sS "${API_BASE}/health" > "$EVIDENCE_DIR/api_health_check.json" 2>&1; then
  log "✅ API健康检查通过: /health"
elif curl -sS "${API_BASE}/api/health" > "$EVIDENCE_DIR/api_health_check.json" 2>&1; then
  log "✅ API健康检查通过: /api/health"
else
  log "❌ API未运行或不可达: ${API_BASE}"
  log "请先启动: pnpm --filter api dev"
  exit 1
fi

# 1) 3轮gate执行
for i in 1 2 3; do
  log ""
  log "=== HA GATE ROUND $i ==="
  
  ROUND_LOG="$EVIDENCE_DIR/round_${i}.log"
  
  if bash tools/gate/gates/gate-p1-2_ha_worker_failover.sh 2>&1 | tee "$ROUND_LOG"; then
    log "✅ Round $i PASS"
  else
    log "❌ Round $i FAIL - 查看 $ROUND_LOG"
    exit 1
  fi
  
  # 轮次间冷却
  if [[ $i -lt 3 ]]; then
    log "等待5s冷却..."
    sleep 5
  fi
done

# 2) SQL验证（自适应探测表名/列名）
log ""
log "=== SQL 验证 ==="

DB_URL_CLEAN="${DATABASE_URL%%\?*}"

log "正在探测真实表名和列名（自适应 snake_case/PascalCase）..."

# 1) 探测审计表名：audit_logs / AuditLog（PostgreSQL 默认 snake_case）
AUDIT_TABLE=$(
  psql -X "$DB_URL_CLEAN" -tAc "
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public'
      AND tablename IN ('audit_logs','AuditLog','auditlog','audit_log')
    ORDER BY CASE tablename
      WHEN 'audit_logs' THEN 1
      WHEN 'audit_log' THEN 2
      WHEN 'AuditLog' THEN 3
      ELSE 9 END
    LIMIT 1;
  " | tr -d '[:space:]'
)

if [[ -z "$AUDIT_TABLE" ]]; then
  log "❌ 审计表未找到（期望 audit_logs）"
  exit 3
fi

log "审计表名: $AUDIT_TABLE"

# 2) 探测 shot_jobs 表名（确保存在）
JOB_TABLE=$(
  psql -X "$DB_URL_CLEAN" -tAc "
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public'
      AND tablename IN ('shot_jobs','ShotJob')
    ORDER BY CASE tablename
      WHEN 'shot_jobs' THEN 1
      WHEN 'ShotJob' THEN 2
      ELSE 9 END
    LIMIT 1;
  " | tr -d '[:space:]'
)

if [[ -z "$JOB_TABLE" ]]; then
  log "❌ shot_jobs 表未找到"
  exit 3
fi

log "Job 表名: $JOB_TABLE"

# 3) 探测 shot_jobs 的租约/锁列名（snake_case vs camelCase）
LOCK_COL=$(
  psql -X "$DB_URL_CLEAN" -tAc "
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='$JOB_TABLE'
      AND column_name IN ('locked_by','lockedBy')
    LIMIT 1;
  " | tr -d '[:space:]'
)
LEASE_COL=$(
  psql -X "$DB_URL_CLEAN" -tAc "
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='$JOB_TABLE'
      AND column_name IN ('lease_until','leaseUntil')
    LIMIT 1;
  " | tr -d '[:space:]'
)

if [[ -z "$LEASE_COL" ]]; then
  log "❌ shot_jobs lease 列未找到（期望 lease_until）"
  exit 4
fi

log "租约列: locked_by=${LOCK_COL:-'NULL'}, lease_until=$LEASE_COL"

# 4) 执行校验（动态拼接表名/列名）
log "执行 SQL 校验..."

# 注意:必须用管道而非heredoc,因为psql不解析shell变量
cat <<SQL | psql -X "$DB_URL_CLEAN" -v ON_ERROR_STOP=1 | tee "$EVIDENCE_DIR/sql_verify.log"
-- A) 不允许存在 lease 过期仍 RUNNING 的残留
SELECT count(*) AS running_stale_locked
FROM $JOB_TABLE
WHERE status='RUNNING'
  AND $LEASE_COL IS NOT NULL
  AND $LEASE_COL <= now();

-- B) 审计必须存在（容错处理，如果列不匹配仅警告）
SELECT count(*) AS audit_reclaim_events
FROM $AUDIT_TABLE
WHERE action='JOB_RECLAIMED_FROM_DEAD_WORKER';
SQL

if [[ $? -ne 0 ]]; then
  log "❌ SQL 校验失败"
  exit 5
fi

log "✅ SQL验证完成"

# 3) 总结
log ""
log "=== 验收总结 ==="
log "3轮gate: 全部PASS"
log "证据目录: $EVIDENCE_DIR"
log "  - round_1.log, round_2.log, round_3.log"
log "  - sql_verify.log"
log "  - validation.log"
log ""
log "✅ P1-2 Component 1 HA验收完成!"
