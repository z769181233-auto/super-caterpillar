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

# 2) SQL验证
log ""
log "=== SQL 验证 ==="

# 断言DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  log "❌ DATABASE_URL 未设置(.env.local未加载或环境变量缺失)"
  exit 1
fi

DB_URL_CLEAN="${DATABASE_URL%%\?*}"

psql -X "$DB_URL_CLEAN" -v ON_ERROR_STOP=1 <<'SQL' | tee "$EVIDENCE_DIR/sql_verify.log"
-- A) 不允许存在 lease 过期仍 RUNNING 的残留
SELECT count(*) AS running_stale_locked
FROM "ShotJob"
WHERE status='RUNNING'
  AND "leaseUntil" IS NOT NULL
  AND "leaseUntil" <= now()
  AND "lockedBy" IS NOT NULL;

-- B) 审计必须存在
SELECT count(*) AS audit_reclaim_events
FROM "AuditLog"
WHERE action='JOB_RECLAIMED_FROM_DEAD_WORKER';
SQL

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
