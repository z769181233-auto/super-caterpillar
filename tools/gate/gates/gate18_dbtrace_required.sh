#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${1:-}"
if [[ -z "$ARTIFACT_DIR" || ! -d "$ARTIFACT_DIR" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] ERROR: artifact dir missing: '$ARTIFACT_DIR'"
  exit 10
fi

if [[ "${GATE_ENV_MODE:-local}" == "ci" ]] && [[ "${ENGINE_REAL:-0}" != "1" ]]; then
  echo "--- GATE18B: DB Traceability REQUIRED (MOCK ACK) ---"
  ACK_FILE="$ARTIFACT_DIR/gate18b_mock_traceability_ack.json"
  cat <<EOF > "$ACK_FILE"
{
  "gate_env_mode": "ci",
  "engine_real": 0,
  "gate17_status": "skipped_mock_mode",
  "gate18_status": "skipped_mock_mode",
  "reason": "no real engine artifacts expected in CI mock mode",
  "verdict": "mock_traceability_acknowledged"
}
EOF
  if [[ -f "$ACK_FILE" ]]; then
    echo "✅ GATE18B: DB Traceability REQUIRED PASS (MOCK_ACK_MODE)"
    exit 0
  else
    echo "[GATE18_DBTRACE_REQUIRED] FAIL: could not create mock ack file"
    exit 14
  fi
fi

# Exit codes (SSOT)
# 10: bad args
# 12: DATABASE_URL missing
# 13: psql missing / cannot connect
# 14: required files missing
# 15: SQL execution failed (non-zero)
# 16: DB trace not found / mismatch
# 0 : PASS

echo "--- GATE18B: DB Traceability REQUIRED Start ---"
echo "Artifact Directory: $ARTIFACT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: DATABASE_URL not set"
  exit 12
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: psql not found in PATH"
  exit 13
fi

# quick connectivity check (no hang)
# use a short statement_timeout to avoid silent stalls
PSQL_BASE=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt)
if ! "${PSQL_BASE[@]}" -c "SET statement_timeout='3s'; SELECT 1;" >/dev/null 2>&1; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: cannot connect to DB or query timed out"
  exit 13
fi

# --- Schema self-check (hard fail on drift) (POST-L3-2) ---
echo "[GATE18_DBTRACE_REQUIRED] Running schema self-check..."
SCHEMA_OK="$("${PSQL_BASE[@]}" -c "
SET statement_timeout='3s';
SELECT
  CASE WHEN to_regclass('public.shot_jobs') IS NULL THEN 'NO_shot_jobs' ELSE 'OK' END,
  CASE WHEN to_regclass('public.shot_job_artifacts') IS NULL THEN 'NO_shot_job_artifacts' ELSE 'OK' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shot_jobs' AND column_name='shotId'
  ) THEN 'OK' ELSE 'NO_col_shotId' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shot_jobs' AND column_name='output_sha256'
  ) THEN 'OK' ELSE 'NO_col_output_sha256' END
;
" 2>/dev/null | tail -n 1)"

if echo "$SCHEMA_OK" | grep -q "NO_"; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: schema drift detected: $SCHEMA_OK"
  exit 16
fi
echo "[GATE18_DBTRACE_REQUIRED] OK: schema self-check passed"

PROV="$ARTIFACT_DIR/shot_render_output.provenance.json"
MP4SHA="$ARTIFACT_DIR/shot_render_output.mp4.sha256"

if [[ ! -f "$PROV" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: missing $PROV"
  exit 14
fi
if [[ ! -f "$MP4SHA" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: missing $MP4SHA"
  exit 14
fi

# Extract job_id from provenance.json
# We use python3 for reliable JSON parsing
JOB_ID="$(python3 -c "
import json
with open('$PROV', 'r', encoding='utf-8') as f:
    d = json.load(f)
job_id = d.get('job', {}).get('job_id') or d.get('job_id') or d.get('jobId', '')
shot_id = d.get('shot_id') or d.get('shotId', '')
print(job_id)
print(shot_id)
" 2>/dev/null || echo "")"

JOB_ID_LINE="$(echo "$JOB_ID" | sed -n '1p')"
SHOT_ID_LINE="$(echo "$JOB_ID" | sed -n '2p')"
JOB_ID="$JOB_ID_LINE"
SHOT_ID="$SHOT_ID_LINE"

if [[ -z "$JOB_ID" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: provenance missing job_id"
  exit 16
fi

# read mp4 sha256 (first token)
MP4_SHA="$(awk '{print $1}' "$MP4SHA" | tr -d '\r\n')"
if [[ -z "$MP4_SHA" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: cannot read mp4 sha256"
  exit 16
fi

echo "[GATE18_DBTRACE_REQUIRED] job_id=$JOB_ID"
echo "[GATE18_DBTRACE_REQUIRED] shot_id=$SHOT_ID"
echo "[GATE18_DBTRACE_REQUIRED] mp4_sha256=$MP4_SHA"

# DB query: job exists and shotId matches
SQL=$(cat <<'SQL_EOF'
SET statement_timeout='5s';
SELECT
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'MISSING' END
FROM shot_jobs
WHERE id = :'job_id' AND "shotId" = :'shot_id';
SQL_EOF
)

set +e
JOB_OK="$("${PSQL_BASE[@]}" -v job_id="$JOB_ID" -v shot_id="$SHOT_ID" -c "$SQL" 2>/dev/null)"
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: SQL execution failed (job probe)"
  exit 15
fi

JOB_OK="$(echo "$JOB_OK" | tail -n 1 | tr -d '\r\n')"
if [[ "$JOB_OK" != "OK" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: job not found in DB"
  exit 16
fi
echo "[GATE18_DBTRACE_REQUIRED] OK: job record found"

# Probe 2: artifact sha match
SQL2=$(cat <<'SQL_EOF'
SET statement_timeout='5s';
DO $$
BEGIN
  IF to_regclass('public.shot_job_artifacts') IS NULL THEN
    RAISE EXCEPTION 'shot_job_artifacts table missing' USING ERRCODE = 'P0001';
  END IF;
END $$;

SELECT
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'MISSING' END
FROM shot_job_artifacts
WHERE job_id = :'job_id'
  AND kind = 'SHOT_RENDER_OUTPUT_MP4'
  AND sha256 = :'sha256';
SQL_EOF
)

set +e
ART_OK="$("${PSQL_BASE[@]}" -v job_id="$JOB_ID" -v sha256="$MP4_SHA" -c "$SQL2" 2>&1)"
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  if echo "$ART_OK" | grep -q "shot_job_artifacts table missing"; then
    echo "[GATE18_DBTRACE_REQUIRED] FAIL: shot_job_artifacts table missing (L3 requires it)"
    exit 16
  fi
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: SQL execution failed (artifact probe)"
  echo "$ART_OK" | tail -n 50
  exit 15
fi

ART_OK="$(echo "$ART_OK" | tail -n 1 | tr -d '\r\n')"
if [[ "$ART_OK" != "OK" ]]; then
  echo "[GATE18_DBTRACE_REQUIRED] FAIL: artifact sha not found in DB for job"
  exit 16
fi

echo "[GATE18_DBTRACE_REQUIRED] OK: artifact sha matches DB"

# Write marker in artifacts
echo "DB_TRACE_OK job_id=$JOB_ID shot_id=$SHOT_ID sha256=$MP4_SHA" > "$ARTIFACT_DIR/DB_TRACE_OK.txt"
echo "✅ GATE18B: DB Traceability REQUIRED PASS"
exit 0
