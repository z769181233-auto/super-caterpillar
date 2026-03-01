#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# gate-stage3-a_ce06_real_closure.sh# This ensures we use the exact same verified logic (HMAC/Nonce, DB, Worker)
# as confirmed in the Phase 1 Realization.

set -e
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Forwarding to Commercial CE06 Gate..."
exec "$GATE_DIR/gate-ce06-story-parse-real.sh"
        exit 1
    fi
    sleep 3
    ((MAX_RETRY--))
done

# 5. 核心验证
log "== Verification Start =="

# 5.1 验证结构化数据落库 (DBSpec V1.1)
log "Check: novel_volumes/chapters/scenes..."
VOL_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_volumes WHERE \"projectId\"=CHAP_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_chapters WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"=SCENE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_scenes WHERE \"chapter_id\" IN (SELECT id FROM \"novel_chapters\" WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"= # $gate$
log "Evidence: Vols=$VOL_COUNT, Chaps=$CHAP_COUNT, Scenes=$SCENE_COUNT"
if [ "$SCENE_COUNT" -lt 1 ]; then log "FAIL: No scenes found in novel_scenes."; exit 1; fi

# 5.2 验证审计日志 (AuditLog)
log "Check: Audit entries with Hashes..."
AUDIT_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM audit_logs WHERE action=log "Audit Evidence: Count=$AUDIT_CHECK" # $gate$
if [ "$AUDIT_CHECK" -lt 1 ]; then log "FAIL: No audit log found."; exit 1; fi

# 5.3 验证计费明细 (CostLedger) - 注意：当前 CE06 引擎尚未集成计费，此项为可选
log "Check: CostLedger (optional, using traceId)..."
TRACE_ID=$(echo "$TRIGGER_OUT" | grep "JOB_ID=" | cut -d= -f2 | xargs)
COST_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM cost_ledgers WHERE \"traceId\" LIKE log "Cost Evidence: Count=$COST_CHECK (Note: May be 0 if billing not yet integrated)" # $gate$
# 当前阶段允许计费数据为空，后续集成时再强制要求

# 6. 生成 6 行核心证据
log "== FINAL 6-LINE EVIDENCE =="
EVID_FILE="$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "STAG3_A_CE06_STATUS: PASSED"
  echo "ENGINE_MODE: REPLAY"
  echo "DB_NOVEL_SCENES: $SCENE_COUNT"
  echo "AUDIT_LOG_IDEMPOTENT: $AUDIT_CHECK"
  echo "COST_LEDGER_JOB_MATCH: $COST_CHECK"
  echo "GATE_VERSION: 1.1"
} | tee "$EVID_FILE"

# 清理
kill $API_PID || true
kill $WORKER_PID || true

log "✅ Stage 3-A Gate Passed."
exit 0

set -e
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Forwarding to Commercial CE06 Gate..."
exec "$GATE_DIR/gate-ce06-story-parse-real.sh"
        exit 1
    fi
    sleep 3
    ((MAX_RETRY--))
done

# 5. 核心验证
log "== Verification Start =="

# 5.1 验证结构化数据落库 (DBSpec V1.1)
log "Check: novel_volumes/chapters/scenes..."
VOL_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_volumes WHERE \"projectId\"=CHAP_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_chapters WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"=SCENE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_scenes WHERE \"chapter_id\" IN (SELECT id FROM \"novel_chapters\" WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"= # $gate$
log "Evidence: Vols=$VOL_COUNT, Chaps=$CHAP_COUNT, Scenes=$SCENE_COUNT"
if [ "$SCENE_COUNT" -lt 1 ]; then log "FAIL: No scenes found in novel_scenes."; exit 1; fi

# 5.2 验证审计日志 (AuditLog)
log "Check: Audit entries with Hashes..."
AUDIT_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM audit_logs WHERE action=log "Audit Evidence: Count=$AUDIT_CHECK" # $gate$
if [ "$AUDIT_CHECK" -lt 1 ]; then log "FAIL: No audit log found."; exit 1; fi

# 5.3 验证计费明细 (CostLedger) - 注意：当前 CE06 引擎尚未集成计费，此项为可选
log "Check: CostLedger (optional, using traceId)..."
TRACE_ID=$(echo "$TRIGGER_OUT" | grep "JOB_ID=" | cut -d= -f2 | xargs)
COST_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM cost_ledgers WHERE \"traceId\" LIKE log "Cost Evidence: Count=$COST_CHECK (Note: May be 0 if billing not yet integrated)" # $gate$
# 当前阶段允许计费数据为空，后续集成时再强制要求

# 6. 生成 6 行核心证据
log "== FINAL 6-LINE EVIDENCE =="
EVID_FILE="$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "STAG3_A_CE06_STATUS: PASSED"
  echo "ENGINE_MODE: REPLAY"
  echo "DB_NOVEL_SCENES: $SCENE_COUNT"
  echo "AUDIT_LOG_IDEMPOTENT: $AUDIT_CHECK"
  echo "COST_LEDGER_JOB_MATCH: $COST_CHECK"
  echo "GATE_VERSION: 1.1"
} | tee "$EVID_FILE"

# 清理
kill $API_PID || true
kill $WORKER_PID || true

log "✅ Stage 3-A Gate Passed."
exit 0

set -e
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Forwarding to Commercial CE06 Gate..."
exec "$GATE_DIR/gate-ce06-story-parse-real.sh"
        exit 1
    fi
    sleep 3
    ((MAX_RETRY--))
done

# 5. 核心验证
log "== Verification Start =="

# 5.1 验证结构化数据落库 (DBSpec V1.1)
log "Check: novel_volumes/chapters/scenes..."
VOL_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_volumes WHERE \"projectId\"=CHAP_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_chapters WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"=SCENE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_scenes WHERE \"chapter_id\" IN (SELECT id FROM \"novel_chapters\" WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"= # $gate$
log "Evidence: Vols=$VOL_COUNT, Chaps=$CHAP_COUNT, Scenes=$SCENE_COUNT"
if [ "$SCENE_COUNT" -lt 1 ]; then log "FAIL: No scenes found in novel_scenes."; exit 1; fi

# 5.2 验证审计日志 (AuditLog)
log "Check: Audit entries with Hashes..."
AUDIT_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM audit_logs WHERE action=log "Audit Evidence: Count=$AUDIT_CHECK" # $gate$
if [ "$AUDIT_CHECK" -lt 1 ]; then log "FAIL: No audit log found."; exit 1; fi

# 5.3 验证计费明细 (CostLedger) - 注意：当前 CE06 引擎尚未集成计费，此项为可选
log "Check: CostLedger (optional, using traceId)..."
TRACE_ID=$(echo "$TRIGGER_OUT" | grep "JOB_ID=" | cut -d= -f2 | xargs)
COST_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM cost_ledgers WHERE \"traceId\" LIKE log "Cost Evidence: Count=$COST_CHECK (Note: May be 0 if billing not yet integrated)" # $gate$
# 当前阶段允许计费数据为空，后续集成时再强制要求

# 6. 生成 6 行核心证据
log "== FINAL 6-LINE EVIDENCE =="
EVID_FILE="$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "STAG3_A_CE06_STATUS: PASSED"
  echo "ENGINE_MODE: REPLAY"
  echo "DB_NOVEL_SCENES: $SCENE_COUNT"
  echo "AUDIT_LOG_IDEMPOTENT: $AUDIT_CHECK"
  echo "COST_LEDGER_JOB_MATCH: $COST_CHECK"
  echo "GATE_VERSION: 1.1"
} | tee "$EVID_FILE"

# 清理
kill $API_PID || true
kill $WORKER_PID || true

log "✅ Stage 3-A Gate Passed."
exit 0

set -e
GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Forwarding to Commercial CE06 Gate..."
exec "$GATE_DIR/gate-ce06-story-parse-real.sh"
        exit 1
    fi
    sleep 3
    ((MAX_RETRY--))
done

# 5. 核心验证
log "== Verification Start =="

# 5.1 验证结构化数据落库 (DBSpec V1.1)
log "Check: novel_volumes/chapters/scenes..."
VOL_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_volumes WHERE \"projectId\"=CHAP_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_chapters WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"=SCENE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM novel_scenes WHERE \"chapter_id\" IN (SELECT id FROM \"novel_chapters\" WHERE \"novelSourceId\" IN (SELECT id FROM \"novel_sources\" WHERE \"projectId\"= # $gate$
log "Evidence: Vols=$VOL_COUNT, Chaps=$CHAP_COUNT, Scenes=$SCENE_COUNT"
if [ "$SCENE_COUNT" -lt 1 ]; then log "FAIL: No scenes found in novel_scenes."; exit 1; fi

# 5.2 验证审计日志 (AuditLog)
log "Check: Audit entries with Hashes..."
AUDIT_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM audit_logs WHERE action=log "Audit Evidence: Count=$AUDIT_CHECK" # $gate$
if [ "$AUDIT_CHECK" -lt 1 ]; then log "FAIL: No audit log found."; exit 1; fi

# 5.3 验证计费明细 (CostLedger) - 注意：当前 CE06 引擎尚未集成计费，此项为可选
log "Check: CostLedger (optional, using traceId)..."
TRACE_ID=$(echo "$TRIGGER_OUT" | grep "JOB_ID=" | cut -d= -f2 | xargs)
COST_CHECK=$(PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scu}" -t -c "SELECT count(*) FROM cost_ledgers WHERE \"traceId\" LIKE log "Cost Evidence: Count=$COST_CHECK (Note: May be 0 if billing not yet integrated)" # $gate$
# 当前阶段允许计费数据为空，后续集成时再强制要求

# 6. 生成 6 行核心证据
log "== FINAL 6-LINE EVIDENCE =="
EVID_FILE="$EVID_DIR/FINAL_6LINE_EVIDENCE.txt"
{
  echo "STAG3_A_CE06_STATUS: PASSED"
  echo "ENGINE_MODE: REPLAY"
  echo "DB_NOVEL_SCENES: $SCENE_COUNT"
  echo "AUDIT_LOG_IDEMPOTENT: $AUDIT_CHECK"
  echo "COST_LEDGER_JOB_MATCH: $COST_CHECK"
  echo "GATE_VERSION: 1.1"
} | tee "$EVID_FILE"

# 清理
kill $API_PID || true
kill $WORKER_PID || true

log "✅ Stage 3-A Gate Passed."
exit 0
