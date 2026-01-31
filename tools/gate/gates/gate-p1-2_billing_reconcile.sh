#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi

DB="${DB_URL%%\?*}"

# --- Commercial Grade Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_2_billing_reconcile_${TS}"
mkdir -p "$EVID/sql_outputs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

log "🚀 [P1-2] Billing Reconcile Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"

# ---------- Helpers: quote mixedCase identifiers ----------
# cost_ledger reality (confirmed):
# mixedCase: "jobId","jobType","costAmount","userId","projectId","billingUnit"
# lowercase: currency, quantity, id, metadata (and possibly others)
#
# We still verify existence to avoid false positives if schema drifts.
log "== Schema Check: columns existence =="
psqlq -Atc "
select column_name
from information_schema.columns
where table_schema=order by column_name;" > "$EVID/sql_outputs/schema_columns_cost_ledger.log"

for col in jobId jobType costAmount userId projectId billingUnit currency quantity; do
  if ! grep -q "^$col$" "$EVID/sql_outputs/schema_columns_cost_ledger.log"; then
    echo "❌ Missing expected column in cost_ledger: $col"
    echo "See: $EVID/sql_outputs/schema_columns_cost_ledger.log"
    exit 3
  fi
done
log "✅ cost_ledger schema columns present"

log "== Phase A: Snapshot (pre) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/pre_snapshot_cost_ledger.csv"

log "== Phase B: Assertions =="

# A1: Unique (jobId, jobType) no duplicates
psql_out "A1_duplicates_jobId_jobType" -c "
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;"
if [[ "$(tr -d   echo "❌ A1 FAIL: duplicates detected on (jobId, jobType)"
  cat "$EVID/sql_outputs/A1_duplicates_jobId_jobType.log"
  exit 10
fi
log "✅ A1 PASS: no duplicates"

# A2: Non-negative (costAmount, quantity)
psql_out "A2_negative_amount_or_qty" -c "
select *
from cost_ledger
where (\"costAmount\" is not null and \"costAmount\" < 0)
   or (quantity is not null and quantity < 0)
limit 50;"
if grep -Eq   echo "❌ A2 FAIL: negative costAmount/quantity found"
  cat "$EVID/sql_outputs/A2_negative_amount_or_qty.log"
  exit 11
fi
log "✅ A2 PASS: non-negative"

# A3: Required fields (non-null)
psql_out "A3_required_fields_null" -c "
select *
from cost_ledger
where \"jobId\" is null
   or \"jobType\" is null
   or \"userId\" is null
   or \"projectId\" is null
   or \"billingUnit\" is null
   or currency is null
   or \"costAmount\" is null
   or quantity is null
limit 50;"
if sed   echo "❌ A3 FAIL: required fields contain NULL"
  cat "$EVID/sql_outputs/A3_required_fields_null.log"
  exit 12
fi
log "✅ A3 PASS: required fields are non-null"

# A4: Whitelist enums (adjust as SSOT)
# currency: USD/CNY; billingUnit: TOKEN/SHOT/IMAGE/SECOND/CHAR/JOB... and CREDITS (found in DB)
psql_out "A4_currency_unit_whitelist" -c "
select \"jobId\", \"jobType\", currency, \"billingUnit\"
from cost_ledger
where currency not in (   or \"billingUnit\" not in (limit 50;"
if sed   echo "❌ A4 FAIL: currency/billingUnit out of whitelist (adjust whitelist to your SSOT)"
  cat "$EVID/sql_outputs/A4_currency_unit_whitelist.log"
  exit 13
fi
log "✅ A4 PASS: currency & billingUnit in whitelist"

# A5: Orphan check (user/project)
# Users/Projects tables are assumed lowercase plural (users/projects). If yours differ, change here only.
psql_out "A5_orphan_user" -c "
select count(*) as orphan_user
from cost_ledger cl
left join users u on u.id = cl.\"userId\"
where u.id is null;"
psql_out "A5_orphan_project" -c "
select count(*) as orphan_project
from cost_ledger cl
left join projects p on p.id = cl.\"projectId\"
where p.id is null;"

if grep -Eq   echo "❌ A5 FAIL: orphan user detected"
  cat "$EVID/sql_outputs/A5_orphan_user.log"
  exit 14
fi
if grep -Eq   echo "❌ A5 FAIL: orphan project detected"
  cat "$EVID/sql_outputs/A5_orphan_project.log"
  exit 15
fi
log "✅ A5 PASS: no orphan user/project"

# A6: Business Link (Job status) - auto detect job table and status column, otherwise SKIP (no false positive)
log "== A6: Job linkage/status (auto-detect) =="

JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"

if [[ -z "$JOB_TABLE" ]]; then
  log "⚠️ A6 SKIP: cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
else
  # detect status/state column, support mixedCase too (rare)
  STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"

  if [[ -z "$STATUS_COL" ]]; then
    log "⚠️ A6 SKIP: cannot detect status/state column on ${JOB_TABLE}"
  else
    log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

    # job row must exist
    psql_out "A6_missing_job_row" -c "
select cl.\"jobId\", cl.\"jobType\"
from cost_ledger cl
left join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.id is null
limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: cost_ledger references missing job row"
      cat "$EVID/sql_outputs/A6_missing_job_row.log"
      exit 16
    fi

    # status policy: billed jobs cannot be FAILED/CANCELED (adjust if your SSOT bills failed jobs)
    # quote STATUS_COL only if it is mixedCase; we use format with double quotes always (safe).
    psql_out "A6_job_status_invalid_for_billing" -c "
select cl.\"jobId\", cl.\"jobType\", j.\"${STATUS_COL}\" as job_status
from cost_ledger cl
join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.\"${STATUS_COL}\"::text in (limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: billed jobs in FAILED/CANCELED status (adjust policy if needed)"
      cat "$EVID/sql_outputs/A6_job_status_invalid_for_billing.log"
      exit 17
    fi

    log "✅ A6 PASS: job linkage & status policy ok"
  fi
fi

log "== Phase C: Snapshot (post) & Gate Idempotency (read-only) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/post_snapshot_cost_ledger.csv"

if ! diff "$EVID/pre_snapshot_cost_ledger.csv" "$EVID/post_snapshot_cost_ledger.csv" > "$EVID/snapshot_diff.log"; then
  echo "❌ Gate caused ledger snapshot drift (should be read-only)."
  cat "$EVID/snapshot_diff.log"
  exit 18
fi
log "✅ Gate is read-only & repeatable (snapshot diff empty)"

cat > "${EVID}/FINAL_REPORT.md" <<EOF
# P1-2 Billing Reconcile Gate - FINAL REPORT (Commercial Grade / Financial Grade)

- Timestamp: ${TS}
- Result: PASS

## Audits (A1-A6)
- A1 Unique: no duplicates on ("jobId","jobType")
- A2 Non-negative: "costAmount" >= 0, quantity >= 0
- A3 Required: non-null required fields
- A4 Whitelist: currency & "billingUnit" in whitelist (including CREDITS)
- A5 Orphans: no orphan user/project
- A6 Business Link: job table/status validated when detectable
- Gate Idempotency: pre/post snapshot identical (read-only)

## Evidence
- pre_snapshot_cost_ledger.csv / post_snapshot_cost_ledger.csv
- snapshot_diff.log (Empty)
- sql_outputs/*.log
- gate.log
EOF

log "✅ Billing Reconcile Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi

DB="${DB_URL%%\?*}"

# --- Commercial Grade Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_2_billing_reconcile_${TS}"
mkdir -p "$EVID/sql_outputs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

log "🚀 [P1-2] Billing Reconcile Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"

# ---------- Helpers: quote mixedCase identifiers ----------
# cost_ledger reality (confirmed):
# mixedCase: "jobId","jobType","costAmount","userId","projectId","billingUnit"
# lowercase: currency, quantity, id, metadata (and possibly others)
#
# We still verify existence to avoid false positives if schema drifts.
log "== Schema Check: columns existence =="
psqlq -Atc "
select column_name
from information_schema.columns
where table_schema=order by column_name;" > "$EVID/sql_outputs/schema_columns_cost_ledger.log"

for col in jobId jobType costAmount userId projectId billingUnit currency quantity; do
  if ! grep -q "^$col$" "$EVID/sql_outputs/schema_columns_cost_ledger.log"; then
    echo "❌ Missing expected column in cost_ledger: $col"
    echo "See: $EVID/sql_outputs/schema_columns_cost_ledger.log"
    exit 3
  fi
done
log "✅ cost_ledger schema columns present"

log "== Phase A: Snapshot (pre) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/pre_snapshot_cost_ledger.csv"

log "== Phase B: Assertions =="

# A1: Unique (jobId, jobType) no duplicates
psql_out "A1_duplicates_jobId_jobType" -c "
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;"
if [[ "$(tr -d   echo "❌ A1 FAIL: duplicates detected on (jobId, jobType)"
  cat "$EVID/sql_outputs/A1_duplicates_jobId_jobType.log"
  exit 10
fi
log "✅ A1 PASS: no duplicates"

# A2: Non-negative (costAmount, quantity)
psql_out "A2_negative_amount_or_qty" -c "
select *
from cost_ledger
where (\"costAmount\" is not null and \"costAmount\" < 0)
   or (quantity is not null and quantity < 0)
limit 50;"
if grep -Eq   echo "❌ A2 FAIL: negative costAmount/quantity found"
  cat "$EVID/sql_outputs/A2_negative_amount_or_qty.log"
  exit 11
fi
log "✅ A2 PASS: non-negative"

# A3: Required fields (non-null)
psql_out "A3_required_fields_null" -c "
select *
from cost_ledger
where \"jobId\" is null
   or \"jobType\" is null
   or \"userId\" is null
   or \"projectId\" is null
   or \"billingUnit\" is null
   or currency is null
   or \"costAmount\" is null
   or quantity is null
limit 50;"
if sed   echo "❌ A3 FAIL: required fields contain NULL"
  cat "$EVID/sql_outputs/A3_required_fields_null.log"
  exit 12
fi
log "✅ A3 PASS: required fields are non-null"

# A4: Whitelist enums (adjust as SSOT)
# currency: USD/CNY; billingUnit: TOKEN/SHOT/IMAGE/SECOND/CHAR/JOB... and CREDITS (found in DB)
psql_out "A4_currency_unit_whitelist" -c "
select \"jobId\", \"jobType\", currency, \"billingUnit\"
from cost_ledger
where currency not in (   or \"billingUnit\" not in (limit 50;"
if sed   echo "❌ A4 FAIL: currency/billingUnit out of whitelist (adjust whitelist to your SSOT)"
  cat "$EVID/sql_outputs/A4_currency_unit_whitelist.log"
  exit 13
fi
log "✅ A4 PASS: currency & billingUnit in whitelist"

# A5: Orphan check (user/project)
# Users/Projects tables are assumed lowercase plural (users/projects). If yours differ, change here only.
psql_out "A5_orphan_user" -c "
select count(*) as orphan_user
from cost_ledger cl
left join users u on u.id = cl.\"userId\"
where u.id is null;"
psql_out "A5_orphan_project" -c "
select count(*) as orphan_project
from cost_ledger cl
left join projects p on p.id = cl.\"projectId\"
where p.id is null;"

if grep -Eq   echo "❌ A5 FAIL: orphan user detected"
  cat "$EVID/sql_outputs/A5_orphan_user.log"
  exit 14
fi
if grep -Eq   echo "❌ A5 FAIL: orphan project detected"
  cat "$EVID/sql_outputs/A5_orphan_project.log"
  exit 15
fi
log "✅ A5 PASS: no orphan user/project"

# A6: Business Link (Job status) - auto detect job table and status column, otherwise SKIP (no false positive)
log "== A6: Job linkage/status (auto-detect) =="

JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"

if [[ -z "$JOB_TABLE" ]]; then
  log "⚠️ A6 SKIP: cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
else
  # detect status/state column, support mixedCase too (rare)
  STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"

  if [[ -z "$STATUS_COL" ]]; then
    log "⚠️ A6 SKIP: cannot detect status/state column on ${JOB_TABLE}"
  else
    log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

    # job row must exist
    psql_out "A6_missing_job_row" -c "
select cl.\"jobId\", cl.\"jobType\"
from cost_ledger cl
left join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.id is null
limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: cost_ledger references missing job row"
      cat "$EVID/sql_outputs/A6_missing_job_row.log"
      exit 16
    fi

    # status policy: billed jobs cannot be FAILED/CANCELED (adjust if your SSOT bills failed jobs)
    # quote STATUS_COL only if it is mixedCase; we use format with double quotes always (safe).
    psql_out "A6_job_status_invalid_for_billing" -c "
select cl.\"jobId\", cl.\"jobType\", j.\"${STATUS_COL}\" as job_status
from cost_ledger cl
join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.\"${STATUS_COL}\"::text in (limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: billed jobs in FAILED/CANCELED status (adjust policy if needed)"
      cat "$EVID/sql_outputs/A6_job_status_invalid_for_billing.log"
      exit 17
    fi

    log "✅ A6 PASS: job linkage & status policy ok"
  fi
fi

log "== Phase C: Snapshot (post) & Gate Idempotency (read-only) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/post_snapshot_cost_ledger.csv"

if ! diff "$EVID/pre_snapshot_cost_ledger.csv" "$EVID/post_snapshot_cost_ledger.csv" > "$EVID/snapshot_diff.log"; then
  echo "❌ Gate caused ledger snapshot drift (should be read-only)."
  cat "$EVID/snapshot_diff.log"
  exit 18
fi
log "✅ Gate is read-only & repeatable (snapshot diff empty)"

cat > "${EVID}/FINAL_REPORT.md" <<EOF
# P1-2 Billing Reconcile Gate - FINAL REPORT (Commercial Grade / Financial Grade)

- Timestamp: ${TS}
- Result: PASS

## Audits (A1-A6)
- A1 Unique: no duplicates on ("jobId","jobType")
- A2 Non-negative: "costAmount" >= 0, quantity >= 0
- A3 Required: non-null required fields
- A4 Whitelist: currency & "billingUnit" in whitelist (including CREDITS)
- A5 Orphans: no orphan user/project
- A6 Business Link: job table/status validated when detectable
- Gate Idempotency: pre/post snapshot identical (read-only)

## Evidence
- pre_snapshot_cost_ledger.csv / post_snapshot_cost_ledger.csv
- snapshot_diff.log (Empty)
- sql_outputs/*.log
- gate.log
EOF

log "✅ Billing Reconcile Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi

DB="${DB_URL%%\?*}"

# --- Commercial Grade Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_2_billing_reconcile_${TS}"
mkdir -p "$EVID/sql_outputs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

log "🚀 [P1-2] Billing Reconcile Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"

# ---------- Helpers: quote mixedCase identifiers ----------
# cost_ledger reality (confirmed):
# mixedCase: "jobId","jobType","costAmount","userId","projectId","billingUnit"
# lowercase: currency, quantity, id, metadata (and possibly others)
#
# We still verify existence to avoid false positives if schema drifts.
log "== Schema Check: columns existence =="
psqlq -Atc "
select column_name
from information_schema.columns
where table_schema=order by column_name;" > "$EVID/sql_outputs/schema_columns_cost_ledger.log"

for col in jobId jobType costAmount userId projectId billingUnit currency quantity; do
  if ! grep -q "^$col$" "$EVID/sql_outputs/schema_columns_cost_ledger.log"; then
    echo "❌ Missing expected column in cost_ledger: $col"
    echo "See: $EVID/sql_outputs/schema_columns_cost_ledger.log"
    exit 3
  fi
done
log "✅ cost_ledger schema columns present"

log "== Phase A: Snapshot (pre) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/pre_snapshot_cost_ledger.csv"

log "== Phase B: Assertions =="

# A1: Unique (jobId, jobType) no duplicates
psql_out "A1_duplicates_jobId_jobType" -c "
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;"
if [[ "$(tr -d   echo "❌ A1 FAIL: duplicates detected on (jobId, jobType)"
  cat "$EVID/sql_outputs/A1_duplicates_jobId_jobType.log"
  exit 10
fi
log "✅ A1 PASS: no duplicates"

# A2: Non-negative (costAmount, quantity)
psql_out "A2_negative_amount_or_qty" -c "
select *
from cost_ledger
where (\"costAmount\" is not null and \"costAmount\" < 0)
   or (quantity is not null and quantity < 0)
limit 50;"
if grep -Eq   echo "❌ A2 FAIL: negative costAmount/quantity found"
  cat "$EVID/sql_outputs/A2_negative_amount_or_qty.log"
  exit 11
fi
log "✅ A2 PASS: non-negative"

# A3: Required fields (non-null)
psql_out "A3_required_fields_null" -c "
select *
from cost_ledger
where \"jobId\" is null
   or \"jobType\" is null
   or \"userId\" is null
   or \"projectId\" is null
   or \"billingUnit\" is null
   or currency is null
   or \"costAmount\" is null
   or quantity is null
limit 50;"
if sed   echo "❌ A3 FAIL: required fields contain NULL"
  cat "$EVID/sql_outputs/A3_required_fields_null.log"
  exit 12
fi
log "✅ A3 PASS: required fields are non-null"

# A4: Whitelist enums (adjust as SSOT)
# currency: USD/CNY; billingUnit: TOKEN/SHOT/IMAGE/SECOND/CHAR/JOB... and CREDITS (found in DB)
psql_out "A4_currency_unit_whitelist" -c "
select \"jobId\", \"jobType\", currency, \"billingUnit\"
from cost_ledger
where currency not in (   or \"billingUnit\" not in (limit 50;"
if sed   echo "❌ A4 FAIL: currency/billingUnit out of whitelist (adjust whitelist to your SSOT)"
  cat "$EVID/sql_outputs/A4_currency_unit_whitelist.log"
  exit 13
fi
log "✅ A4 PASS: currency & billingUnit in whitelist"

# A5: Orphan check (user/project)
# Users/Projects tables are assumed lowercase plural (users/projects). If yours differ, change here only.
psql_out "A5_orphan_user" -c "
select count(*) as orphan_user
from cost_ledger cl
left join users u on u.id = cl.\"userId\"
where u.id is null;"
psql_out "A5_orphan_project" -c "
select count(*) as orphan_project
from cost_ledger cl
left join projects p on p.id = cl.\"projectId\"
where p.id is null;"

if grep -Eq   echo "❌ A5 FAIL: orphan user detected"
  cat "$EVID/sql_outputs/A5_orphan_user.log"
  exit 14
fi
if grep -Eq   echo "❌ A5 FAIL: orphan project detected"
  cat "$EVID/sql_outputs/A5_orphan_project.log"
  exit 15
fi
log "✅ A5 PASS: no orphan user/project"

# A6: Business Link (Job status) - auto detect job table and status column, otherwise SKIP (no false positive)
log "== A6: Job linkage/status (auto-detect) =="

JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"

if [[ -z "$JOB_TABLE" ]]; then
  log "⚠️ A6 SKIP: cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
else
  # detect status/state column, support mixedCase too (rare)
  STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"

  if [[ -z "$STATUS_COL" ]]; then
    log "⚠️ A6 SKIP: cannot detect status/state column on ${JOB_TABLE}"
  else
    log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

    # job row must exist
    psql_out "A6_missing_job_row" -c "
select cl.\"jobId\", cl.\"jobType\"
from cost_ledger cl
left join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.id is null
limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: cost_ledger references missing job row"
      cat "$EVID/sql_outputs/A6_missing_job_row.log"
      exit 16
    fi

    # status policy: billed jobs cannot be FAILED/CANCELED (adjust if your SSOT bills failed jobs)
    # quote STATUS_COL only if it is mixedCase; we use format with double quotes always (safe).
    psql_out "A6_job_status_invalid_for_billing" -c "
select cl.\"jobId\", cl.\"jobType\", j.\"${STATUS_COL}\" as job_status
from cost_ledger cl
join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.\"${STATUS_COL}\"::text in (limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: billed jobs in FAILED/CANCELED status (adjust policy if needed)"
      cat "$EVID/sql_outputs/A6_job_status_invalid_for_billing.log"
      exit 17
    fi

    log "✅ A6 PASS: job linkage & status policy ok"
  fi
fi

log "== Phase C: Snapshot (post) & Gate Idempotency (read-only) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/post_snapshot_cost_ledger.csv"

if ! diff "$EVID/pre_snapshot_cost_ledger.csv" "$EVID/post_snapshot_cost_ledger.csv" > "$EVID/snapshot_diff.log"; then
  echo "❌ Gate caused ledger snapshot drift (should be read-only)."
  cat "$EVID/snapshot_diff.log"
  exit 18
fi
log "✅ Gate is read-only & repeatable (snapshot diff empty)"

cat > "${EVID}/FINAL_REPORT.md" <<EOF
# P1-2 Billing Reconcile Gate - FINAL REPORT (Commercial Grade / Financial Grade)

- Timestamp: ${TS}
- Result: PASS

## Audits (A1-A6)
- A1 Unique: no duplicates on ("jobId","jobType")
- A2 Non-negative: "costAmount" >= 0, quantity >= 0
- A3 Required: non-null required fields
- A4 Whitelist: currency & "billingUnit" in whitelist (including CREDITS)
- A5 Orphans: no orphan user/project
- A6 Business Link: job table/status validated when detectable
- Gate Idempotency: pre/post snapshot identical (read-only)

## Evidence
- pre_snapshot_cost_ledger.csv / post_snapshot_cost_ledger.csv
- snapshot_diff.log (Empty)
- sql_outputs/*.log
- gate.log
EOF

log "✅ Billing Reconcile Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi

DB="${DB_URL%%\?*}"

# --- Commercial Grade Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_2_billing_reconcile_${TS}"
mkdir -p "$EVID/sql_outputs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

log "🚀 [P1-2] Billing Reconcile Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"

# ---------- Helpers: quote mixedCase identifiers ----------
# cost_ledger reality (confirmed):
# mixedCase: "jobId","jobType","costAmount","userId","projectId","billingUnit"
# lowercase: currency, quantity, id, metadata (and possibly others)
#
# We still verify existence to avoid false positives if schema drifts.
log "== Schema Check: columns existence =="
psqlq -Atc "
select column_name
from information_schema.columns
where table_schema=order by column_name;" > "$EVID/sql_outputs/schema_columns_cost_ledger.log"

for col in jobId jobType costAmount userId projectId billingUnit currency quantity; do
  if ! grep -q "^$col$" "$EVID/sql_outputs/schema_columns_cost_ledger.log"; then
    echo "❌ Missing expected column in cost_ledger: $col"
    echo "See: $EVID/sql_outputs/schema_columns_cost_ledger.log"
    exit 3
  fi
done
log "✅ cost_ledger schema columns present"

log "== Phase A: Snapshot (pre) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/pre_snapshot_cost_ledger.csv"

log "== Phase B: Assertions =="

# A1: Unique (jobId, jobType) no duplicates
psql_out "A1_duplicates_jobId_jobType" -c "
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;"
if [[ "$(tr -d   echo "❌ A1 FAIL: duplicates detected on (jobId, jobType)"
  cat "$EVID/sql_outputs/A1_duplicates_jobId_jobType.log"
  exit 10
fi
log "✅ A1 PASS: no duplicates"

# A2: Non-negative (costAmount, quantity)
psql_out "A2_negative_amount_or_qty" -c "
select *
from cost_ledger
where (\"costAmount\" is not null and \"costAmount\" < 0)
   or (quantity is not null and quantity < 0)
limit 50;"
if grep -Eq   echo "❌ A2 FAIL: negative costAmount/quantity found"
  cat "$EVID/sql_outputs/A2_negative_amount_or_qty.log"
  exit 11
fi
log "✅ A2 PASS: non-negative"

# A3: Required fields (non-null)
psql_out "A3_required_fields_null" -c "
select *
from cost_ledger
where \"jobId\" is null
   or \"jobType\" is null
   or \"userId\" is null
   or \"projectId\" is null
   or \"billingUnit\" is null
   or currency is null
   or \"costAmount\" is null
   or quantity is null
limit 50;"
if sed   echo "❌ A3 FAIL: required fields contain NULL"
  cat "$EVID/sql_outputs/A3_required_fields_null.log"
  exit 12
fi
log "✅ A3 PASS: required fields are non-null"

# A4: Whitelist enums (adjust as SSOT)
# currency: USD/CNY; billingUnit: TOKEN/SHOT/IMAGE/SECOND/CHAR/JOB... and CREDITS (found in DB)
psql_out "A4_currency_unit_whitelist" -c "
select \"jobId\", \"jobType\", currency, \"billingUnit\"
from cost_ledger
where currency not in (   or \"billingUnit\" not in (limit 50;"
if sed   echo "❌ A4 FAIL: currency/billingUnit out of whitelist (adjust whitelist to your SSOT)"
  cat "$EVID/sql_outputs/A4_currency_unit_whitelist.log"
  exit 13
fi
log "✅ A4 PASS: currency & billingUnit in whitelist"

# A5: Orphan check (user/project)
# Users/Projects tables are assumed lowercase plural (users/projects). If yours differ, change here only.
psql_out "A5_orphan_user" -c "
select count(*) as orphan_user
from cost_ledger cl
left join users u on u.id = cl.\"userId\"
where u.id is null;"
psql_out "A5_orphan_project" -c "
select count(*) as orphan_project
from cost_ledger cl
left join projects p on p.id = cl.\"projectId\"
where p.id is null;"

if grep -Eq   echo "❌ A5 FAIL: orphan user detected"
  cat "$EVID/sql_outputs/A5_orphan_user.log"
  exit 14
fi
if grep -Eq   echo "❌ A5 FAIL: orphan project detected"
  cat "$EVID/sql_outputs/A5_orphan_project.log"
  exit 15
fi
log "✅ A5 PASS: no orphan user/project"

# A6: Business Link (Job status) - auto detect job table and status column, otherwise SKIP (no false positive)
log "== A6: Job linkage/status (auto-detect) =="

JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"

if [[ -z "$JOB_TABLE" ]]; then
  log "⚠️ A6 SKIP: cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
else
  # detect status/state column, support mixedCase too (rare)
  STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"

  if [[ -z "$STATUS_COL" ]]; then
    log "⚠️ A6 SKIP: cannot detect status/state column on ${JOB_TABLE}"
  else
    log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

    # job row must exist
    psql_out "A6_missing_job_row" -c "
select cl.\"jobId\", cl.\"jobType\"
from cost_ledger cl
left join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.id is null
limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: cost_ledger references missing job row"
      cat "$EVID/sql_outputs/A6_missing_job_row.log"
      exit 16
    fi

    # status policy: billed jobs cannot be FAILED/CANCELED (adjust if your SSOT bills failed jobs)
    # quote STATUS_COL only if it is mixedCase; we use format with double quotes always (safe).
    psql_out "A6_job_status_invalid_for_billing" -c "
select cl.\"jobId\", cl.\"jobType\", j.\"${STATUS_COL}\" as job_status
from cost_ledger cl
join ${JOB_TABLE} j on j.id = cl.\"jobId\"
where j.\"${STATUS_COL}\"::text in (limit 50;"
    if grep -Eq       echo "❌ A6 FAIL: billed jobs in FAILED/CANCELED status (adjust policy if needed)"
      cat "$EVID/sql_outputs/A6_job_status_invalid_for_billing.log"
      exit 17
    fi

    log "✅ A6 PASS: job linkage & status policy ok"
  fi
fi

log "== Phase C: Snapshot (post) & Gate Idempotency (read-only) =="
psqlq -Atc "
select
  \"jobId\"::text||  coalesce(\"costAmount\"::text,  coalesce(currency,  coalesce(\"billingUnit\"::text,  coalesce(quantity::text,  coalesce(\"userId\"::text,  coalesce(\"projectId\"::text,from cost_ledger
order by \"jobType\", \"jobId\";" > "$EVID/post_snapshot_cost_ledger.csv"

if ! diff "$EVID/pre_snapshot_cost_ledger.csv" "$EVID/post_snapshot_cost_ledger.csv" > "$EVID/snapshot_diff.log"; then
  echo "❌ Gate caused ledger snapshot drift (should be read-only)."
  cat "$EVID/snapshot_diff.log"
  exit 18
fi
log "✅ Gate is read-only & repeatable (snapshot diff empty)"

cat > "${EVID}/FINAL_REPORT.md" <<EOF
# P1-2 Billing Reconcile Gate - FINAL REPORT (Commercial Grade / Financial Grade)

- Timestamp: ${TS}
- Result: PASS

## Audits (A1-A6)
- A1 Unique: no duplicates on ("jobId","jobType")
- A2 Non-negative: "costAmount" >= 0, quantity >= 0
- A3 Required: non-null required fields
- A4 Whitelist: currency & "billingUnit" in whitelist (including CREDITS)
- A5 Orphans: no orphan user/project
- A6 Business Link: job table/status validated when detectable
- Gate Idempotency: pre/post snapshot identical (read-only)

## Evidence
- pre_snapshot_cost_ledger.csv / post_snapshot_cost_ledger.csv
- snapshot_diff.log (Empty)
- sql_outputs/*.log
- gate.log
EOF

log "✅ Billing Reconcile Gate PASS. Evidence: ${EVID}"
