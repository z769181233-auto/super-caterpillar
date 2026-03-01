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

# --- Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

# --- Load Driver Config ---
# Defaults to 3001 unless override
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_MODE="${AUTH_MODE:-jwt}"     # jwt|hmac (Default to jwt for User simulation)
JWT_TOKEN="${JWT_TOKEN:-${TEST_TOKEN:-}}"

HMAC_KEY_ID="${HMAC_KEY_ID:-}"
HMAC_SECRET="${HMAC_SECRET:-}"
HMAC_CLOCK_SKEW_SEC="${HMAC_CLOCK_SKEW_SEC:-0}"  # Local clock skew correction

SHOT_ID="${SHOT_ID:-shot_ed5aeca0768441dcbc193c699a28f69c}"

LOAD_N="${LOAD_N:-50}"
LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-5}"

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-1}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-600}"

MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-0.98}"
MAX_P95_SEC="${MAX_P95_SEC:-300}"
MAX_PENDING_END="${MAX_PENDING_END:-0}"

if [[ "$AUTH_MODE" == "jwt" ]]; then
  if [[ -z "$JWT_TOKEN" ]]; then
    echo "❌ JWT_TOKEN is empty (AUTH_MODE=jwt requires JWT_TOKEN)"
    exit 20
  fi
elif [[ "$AUTH_MODE" == "hmac" ]]; then
  if [[ -z "$HMAC_KEY_ID" || -z "$HMAC_SECRET" ]]; then
    echo "❌ HMAC_KEY_ID/HMAC_SECRET is empty (AUTH_MODE=hmac requires both)"
    exit 20
  fi
else
  echo "❌ AUTH_MODE must be jwt or hmac"
  exit 20
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_3_performance_${TS}"
mkdir -p "$EVID/sql_outputs" "$EVID/raw"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

# --- Python Bin (macOS usually only has python3) ---
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "❌ python/python3 not found. Install Python 3 or set PYTHON_BIN=/path/to/python3"
    exit 21
  fi
fi

# --- Node is required (used for robust JSON parsing in poll loop) ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. This gate requires Node.js (used for JSON parsing)."
  exit 22
fi

build_auth_headers_file () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  : > "$out_file"

  if [[ "$AUTH_MODE" == "jwt" ]]; then
    echo "header = \"Authorization: Bearer ${JWT_TOKEN}\"" >> "$out_file"
    return 0
  fi

  # HMAC mode
  "${PYTHON_BIN}" - <<import os, time, secrets, hashlib, hmac

method = os.environ["__HMAC_METHOD__"]
path   = os.environ["__HMAC_PATH__"]
body   = os.environ.get("__HMAC_BODY__", "")

key_id = os.environ["HMAC_KEY_ID"]
secret = os.environ["HMAC_SECRET"].encode("utf-8")

skew = int(os.environ.get("HMAC_CLOCK_SKEW_SEC","0"))
# Timestamp in milliseconds
timestamp = str(int((time.time() + skew) * 1000))
nonce = secrets.token_hex(16)

body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

canonical = "\n".join([method.upper(), path, timestamp, nonce, body_hash])

sig = hmac.new(secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()



print(fprint(fprint(fprint(fPY
  return 0
}

gen_headers () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  __HMAC_METHOD__="$method" __HMAC_PATH__="$path" __HMAC_BODY__="$body" \
    build_auth_headers_file "$method" "$path" "$body" "$out_file"
}


log "🚀 [P1-3] Performance & Stress Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"
log "BASE_URL=${BASE_URL}"
log "SHOT_ID=${SHOT_ID}"
log "LOAD_N=${LOAD_N}, LOAD_CONCURRENCY=${LOAD_CONCURRENCY}"
log "MAX_WAIT_SEC=${MAX_WAIT_SEC}, POLL_INTERVAL_SEC=${POLL_INTERVAL_SEC}"

# --------- Auto-detect job table + status column ----------
JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"
if [[ -z "$JOB_TABLE" ]]; then
  echo "❌ Cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
  exit 3
fi

STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"
if [[ -z "$STATUS_COL" ]]; then
  echo "❌ Cannot detect status/state column on ${JOB_TABLE}"
  exit 4
fi
log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

# --------- Metrics CSV header ----------
echo "ts,phase,jobs_total,terminal,succeeded,failed,pending,ledger_rows,ledger_dups" > "$EVID/metrics.csv"

snapshot_metrics () {
  local phase="$1"
  local jobs_total terminal succeeded failed pending ledger_rows ledger_dups

  jobs_total="$(psqlq -Atc "select count(*) from ${JOB_TABLE};" | tr -d  # $gate$
  terminal="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  succeeded="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  failed="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  pending="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text not in (
  ledger_rows="$(psqlq -Atc "select count(*) from cost_ledger;" | tr -d   # Ensure duplicates count is robust (handle empty) # $gate$
  ledger_dups="$(psqlq -Atc " # $gate$
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;" | tr -d   if [[ -z "$ledger_dups" ]]; then ledger_dups="0"; fi

  echo "$(date +%s),${phase},${jobs_total},${terminal},${succeeded},${failed},${pending},${ledger_rows},${ledger_dups}" >> "$EVID/metrics.csv"
}

# --------- Helpers ---------
is_terminal () {
  local s="$1"
  [[ "$s" == "SUCCEEDED" || "$s" == "COMPLETED" || "$s" == "FAILED" || "$s" == "CANCELED" || "$s" == "CANCELLED" ]]
}

log "== Phase A: Baseline Snapshot =="
snapshot_metrics "baseline"
psql_out "baseline_jobs_sample" -c "select id, \"${STATUS_COL}\"::text as status from ${JOB_TABLE} order by id desc limit 20;"
psql_out "baseline_cost_ledger_sample" -c "select \"jobId\",\"jobType\",\"costAmount\",currency,\"billingUnit\",quantity from cost_ledger order by id desc limit 20;"

log "== Auth Probe =="
probe_payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":0}}
JSON
)"
probe_hdr="$EVID/raw/_auth_probe_headers.txt"
probe_resp_hdr="$EVID/raw/auth_probe_headers_out.txt"
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$probe_payload" "$probe_hdr"

# Remove -sS to see errors, add -v
probe_resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  --config "$probe_hdr" \
  -D "$probe_resp_hdr" \
  -d "$probe_payload" || true)"
probe_code="$(echo "$probe_resp" | tail -1 | tr -d probe_body="$(echo "$probe_resp" | sed echo "$probe_body" > "$EVID/raw/auth_probe_body.json"
log "auth_probe_code=${probe_code}"
if [[ "$probe_code" != "200" && "$probe_code" != "201" ]]; then
  log "❌ Auth probe failed. See $EVID/raw/auth_probe_body.json"
  exit 25
fi
log "✅ Auth probe PASS"



log "== Phase B: Real Load Driver (API Create Jobs) =="
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
STATUS_URL_BASE="${BASE_URL}/api/jobs"

: > "$EVID/raw/create_responses.jsonl"
: > "$EVID/raw/create_httpcodes.log"
: > "$EVID/raw/status_httpcodes.log"
: > "$EVID/raw/job_ids.txt"
echo "job_id,created_at_ms,terminal_at_ms,latency_ms,final_status" > "$EVID/raw/latencies.csv"
: > "$EVID/raw/status_samples.jsonl"
# NEW: Granular creation time tracking
echo "job_id,created_at_ms" > "$EVID/raw/job_created_at.csv"

start_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"

log "Creating ${LOAD_N} jobs via ${CREATE_URL}"

# generate index list
# generate index list
"${PYTHON_BIN}" -c "for i in range(1, int($LOAD_N) + 1): print(i)" > "$EVID/raw/_load_idx.txt"

create_one () {
  local i="$1"
  local payload
  payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":${i}}}
JSON
)"
  # best-effort: capture response even if http fails
  local resp httpcode
  local hdr="$EVID/raw/_auth_headers_create_${i}.txt"
  gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$payload" "$hdr"

  resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
    -H "Content-Type: application/json" \
    --config "$hdr" \
    -d "$payload" || true)"
  httpcode="$(echo "$resp" | tail -1 | tr -d   body="$(echo "$resp" | sed 
  echo "$httpcode" >> "$EVID/raw/create_httpcodes.log"
  echo "$body" >> "$EVID/raw/create_responses.jsonl"

  if [[ "$httpcode" != "200" && "$httpcode" != "201" ]]; then
    echo "" # fail
    return 0
  fi

  # extract data.id and initial status
  local job_id
  job_id="$(echo "$body" | "${PYTHON_BIN}" - <<import sys, json
def pick(o, path):
  cur=o
  for k in path:
    if isinstance(cur, dict) and k in cur:
      cur=cur[k]
    else:
      return None
  return cur

try:
  obj=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit

candidates = [
  ["data","id"],
  ["data","job","id"],
  ["job","id"],
  ["id"],
]
for p in candidates:
  v=pick(obj,p)
  if isinstance(v,str) and v.strip():
    print(v.strip()); break
else:
  print("")
PY
)"
  
  # Fallback if python fails (e.g. env issues in xargs)
  if [[ -z "$job_id" ]]; then
     # tolerate whitespace: "data": { "id": "xxx" }
     job_id="$(echo "$body" | sed -n      if [[ -n "$job_id" ]]; then
       echo "Recovered job_id via sed: $job_id" >> "$EVID/raw/extraction_debug.log"
     else
       echo "Failed to extract job_id. Body: $body" >> "$EVID/raw/extraction_errors.log"
       echo "PYTHON_BIN=${PYTHON_BIN}" >> "$EVID/raw/extraction_errors.log"
     fi
  fi
  if [[ -n "$job_id" ]]; then
    local created_at_ms
    created_at_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
    echo "$job_id" >> "$EVID/raw/job_ids.txt"
    echo "${job_id},${created_at_ms}" >> "$EVID/raw/job_created_at.csv"
  fi
  echo ""
}

export -f create_one
export CREATE_URL AUTH_MODE JWT_TOKEN HMAC_KEY_ID HMAC_SECRET HMAC_CLOCK_SKEW_SEC EVID TS PYTHON_BIN BASE_URL SHOT_ID
export -f build_auth_headers_file gen_headers

# run creates in parallel
cat "$EVID/raw/_load_idx.txt" | xargs -P "$LOAD_CONCURRENCY" -n 1 -I{} bash -lc 
# de-dup + sanitize job ids
sort -u "$EVID/raw/job_ids.txt" | sed mv "$EVID/raw/job_ids.unique.txt" "$EVID/raw/job_ids.txt"
created_cnt="$(wc -l < "$EVID/raw/job_ids.txt" | tr -d log "Created jobs (parsed data.id): ${created_cnt}/${LOAD_N}"

if [[ "$created_cnt" -eq 0 ]]; then
  log "❌ Create phase produced 0 job ids. Dumping diagnostics..."
  log "Last 10 httpcodes:"
  tail -n 10 "$EVID/raw/create_httpcodes.log" 2>/dev/null | sed   log "Last 3 responses:"
  tail -n 3 "$EVID/raw/create_responses.jsonl" 2>/dev/null | sed   exit 30
fi

# compute create throughput
end_create_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
dur_ms="$((end_create_ms - start_ms))"
if [[ "$dur_ms" -le 0 ]]; then dur_ms=1; fi
jobs_per_min="$("${PYTHON_BIN}" - <<PY
dur_ms=$dur_ms
created=$created_cnt
print(round(created / (dur_ms/1000.0) * 60.0, 2))
PY
)"
log "Create throughput: ${jobs_per_min} jobs/min"

snapshot_metrics "after_create"

log "== Phase C: Poll Job Status until terminal or timeout =="
deadline_s="$(( $(date +%s) + MAX_WAIT_SEC ))"

# poll loop
# poll loop
# preload created_at map (fs-based for Bash 3.2 compatibility)
mkdir -p "$EVID/raw/map_created_at"
while   [[ "$jid" == "job_id" ]] && continue
  [[ -z "$jid" ]] && continue
  echo "$cts" > "$EVID/raw/map_created_at/$jid"
done < "$EVID/raw/job_created_at.csv"

# track completion via fs (Bash 3.2 compat)
mkdir -p "$EVID/raw/map_done"
success=0
fail=0

while : ; do
  now_s="$(date +%s)"
  if [[ "$now_s" -ge "$deadline_s" ]]; then
    log "⏱️ Poll timeout reached"
    break
  fi

  # pending_this_round=0 # unused actually, just iterating

  while read -r jid; do
    [[ -z "$jid" ]] && continue
    # check done map
    if [[ -f "$EVID/raw/map_done/$jid" ]]; then
      continue
    fi

    # per-job headers file to avoid any future concurrency clobbering
    hdr="$EVID/raw/_auth_headers_get_${jid}.txt"
    gen_headers "GET" "/api/jobs/${jid}" "" "$hdr"

    resp_with_code="$(curl -sS -w "\n%{http_code}" -X GET "${STATUS_URL_BASE}/${jid}" \
      --config "$hdr" || true)"
    httpcode="$(echo "$resp_with_code" | tail -1 | tr -d     resp="$(echo "$resp_with_code" | sed     echo "$resp" >> "$EVID/raw/status_samples.jsonl"
    echo "$httpcode" >> "$EVID/raw/status_httpcodes.log"

    if [[ "$httpcode" != "200" ]]; then
      echo "$resp" > "$EVID/raw/status_last_error_body.json"
      log "❌ Poll GET failed (httpcode=${httpcode}) for job=${jid}. See $EVID/raw/status_last_error_body.json"
      exit 41
    fi

    status="$(echo "$resp" | node -e       const fs = require("fs");
      try {
        const input = fs.readFileSync(0, "utf-8");
        const obj = JSON.parse(input);
        const s = obj?.data?.status || obj?.status || "";
        console.log(s);
      } catch (e) {
        console.log("__JSON_PARSE_ERROR__");
      }
        if [[ "$status" == "__JSON_PARSE_ERROR__" ]]; then
      echo "$resp" > "$EVID/raw/status_last_nonjson_body.txt"
      log "❌ Poll GET returned non-JSON body. See $EVID/raw/status_last_nonjson_body.txt"
      exit 42
    fi
    if [[ -z "$status" ]]; then
      # status missing is a schema/API bug: fail fast with evidence
      echo "$resp" > "$EVID/raw/status_last_missing_status.json"
      log "❌ Poll GET JSON missing status field. See $EVID/raw/status_last_missing_status.json"
      exit 43
    fi

    if is_terminal "$status"; then
      term_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
      # LATENCY CALC: use granular created_at info (fs lookup)
      if [[ -f "$EVID/raw/map_created_at/$jid" ]]; then
        created_at_ms="$(cat "$EVID/raw/map_created_at/$jid")"
      else
        created_at_ms="$start_ms"
      fi
      
      latency_ms="$((term_ms - created_at_ms))"
      
      echo "${jid},${created_at_ms},${term_ms},${latency_ms},${status}" >> "$EVID/raw/latencies.csv"
      
      # mark done
      touch "$EVID/raw/map_done/$jid"
      if [[ "$status" == "SUCCEEDED" || "$status" == "COMPLETED" ]]; then
        success=$((success+1))
      else
        fail=$((fail+1))
      fi
    fi
  done < "$EVID/raw/job_ids.txt"

  snapshot_metrics "poll"
  
  # count done files in map_done directory
  done_cnt="$(find "$EVID/raw/map_done" -type f 2>/dev/null | wc -l | tr -d   if [[ "$done_cnt" -ge "$created_cnt" && "$created_cnt" -gt 0 ]]; then
    log "All parsed jobs reached terminal: ${done_cnt}/${created_cnt}"
    break
  fi

  sleep "$POLL_INTERVAL_SEC"
done

snapshot_metrics "final"

log "== Phase D: Hard Assertions =="
# A1: ledger duplicates = 0 (scoped to this run only, robust via psql \copy)
ledger_dups_last="$(
  psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A <<SQL # $gate$
\\set QUIET 1
CREATE TEMP TABLE run_job_ids(job_id text) ON COMMIT DROP;
\\copy run_job_ids(job_id) FROM SELECT count(*)
FROM (
  SELECT cl."jobId", cl."jobType"
  FROM cost_ledger cl
  JOIN run_job_ids rj ON rj.job_id = cl."jobId"::text
  GROUP BY cl."jobId", cl."jobType"
  HAVING count(*) > 1
) sub;
SQL
)"
ledger_dups_last="$(echo "$ledger_dups_last" | tr -d if [[ -z "$ledger_dups_last" ]]; then ledger_dups_last="0"; fi

if [[ "$ledger_dups_last" != "0" ]]; then
  echo "❌ P1-3 FAIL: cost_ledger duplicates detected (ledger_dups=${ledger_dups_last})"
  exit 10
fi

# A2: success rate
if [[ "$created_cnt" -gt 0 ]]; then
  success_rate="$("${PYTHON_BIN}" - <<PY
s=$success
c=$created_cnt
print(round(s/c, 4))
PY
)"
else
  success_rate="0"
fi
log "success=${success}, fail=${fail}, created_cnt=${created_cnt}, success_rate=${success_rate}"
"${PYTHON_BIN}" - <<PY
sr=float("$success_rate")
min_sr=float("$MIN_SUCCESS_RATE")
import sys
if sr + 1e-12 < min_sr:
  print(f"❌ P1-3 FAIL: success_rate {sr} < MIN_SUCCESS_RATE {min_sr}")
  sys.exit(11)
print("✅ success_rate PASS")
PY

# A3: pending_end threshold
pending_end="$(tail -1 "$EVID/metrics.csv" | awk -Fif [[ -z "$pending_end" ]]; then pending_end="0"; fi

log "pending_end=${pending_end}, MAX_PENDING_END=${MAX_PENDING_END}"
"${PYTHON_BIN}" - <<PY
pe=int("$pending_end")
mx=int("$MAX_PENDING_END")
import sys
if pe > mx:
  print(f"❌ P1-3 FAIL: pending_end {pe} > MAX_PENDING_END {mx}")
  sys.exit(12)
print("✅ pending_end PASS")
PY

# A4: latency p95
p95_ms="$("${PYTHON_BIN}" - <<import csv, statistics, sys
path=sys.argv[1]
vals=[]
try:
  with open(path,newline=    r=csv.DictReader(f)
    for row in r:
      try:
        vals.append(int(row["latency_ms"]))
      except Exception:
        pass
except Exception:
  pass
if not vals:
  print("0")
  sys.exit(0)
vals.sort()
k=int((len(vals)-1)*0.95)
print(vals[k])
PY
"$EVID/raw/latencies.csv")"

log "p95_ms=${p95_ms}, MAX_P95_SEC=${MAX_P95_SEC}"
"${PYTHON_BIN}" - <<PY
p95_ms=int("$p95_ms")
mx_s=int("$MAX_P95_SEC")
import sys
if p95_ms > mx_s*1000:
  print(f"❌ P1-3 FAIL: p95_ms {p95_ms} > MAX_P95_SEC {mx_s}s")
  sys.exit(13)
print("✅ p95 latency PASS")
PY

cat > "${EVID}/FINAL_REPORT.md" <<EOF2
# P1-3 Performance & Stress Gate - FINAL REPORT (Real Load Driver)

- Timestamp: ${TS}
- DB: ${DB}
- BASE_URL: ${BASE_URL}
- SHOT_ID: ${SHOT_ID}
- JOB_TABLE: ${JOB_TABLE}
- STATUS_COL: ${STATUS_COL}

## Load Config
- LOAD_N: ${LOAD_N}
- LOAD_CONCURRENCY: ${LOAD_CONCURRENCY}
- MAX_WAIT_SEC: ${MAX_WAIT_SEC}
- POLL_INTERVAL_SEC: ${POLL_INTERVAL_SEC}

## Results
- created_cnt: ${created_cnt}/${LOAD_N}
- success: ${success}
- fail: ${fail}
- success_rate: ${success_rate}
- p95_ms: ${p95_ms}

## Hard Assertions
- cost_ledger duplicates == 0 ✅
- success_rate >= ${MIN_SUCCESS_RATE} ✅
- pending_end <= ${MAX_PENDING_END} ✅
- p95 latency <= ${MAX_P95_SEC}s ✅

## Evidence
- metrics.csv (DB-side time series)
- raw/create_responses.jsonl
- raw/job_ids.txt
- raw/status_samples.jsonl
- raw/latencies.csv
- FINAL_REPORT.md
- sql_outputs/*
EOF2

log "✅ P1-3 Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi
DB="${DB_URL%%\?*}"

# --- Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

# --- Load Driver Config ---
# Defaults to 3001 unless override
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_MODE="${AUTH_MODE:-jwt}"     # jwt|hmac (Default to jwt for User simulation)
JWT_TOKEN="${JWT_TOKEN:-${TEST_TOKEN:-}}"

HMAC_KEY_ID="${HMAC_KEY_ID:-}"
HMAC_SECRET="${HMAC_SECRET:-}"
HMAC_CLOCK_SKEW_SEC="${HMAC_CLOCK_SKEW_SEC:-0}"  # Local clock skew correction

SHOT_ID="${SHOT_ID:-shot_ed5aeca0768441dcbc193c699a28f69c}"

LOAD_N="${LOAD_N:-50}"
LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-5}"

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-1}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-600}"

MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-0.98}"
MAX_P95_SEC="${MAX_P95_SEC:-300}"
MAX_PENDING_END="${MAX_PENDING_END:-0}"

if [[ "$AUTH_MODE" == "jwt" ]]; then
  if [[ -z "$JWT_TOKEN" ]]; then
    echo "❌ JWT_TOKEN is empty (AUTH_MODE=jwt requires JWT_TOKEN)"
    exit 20
  fi
elif [[ "$AUTH_MODE" == "hmac" ]]; then
  if [[ -z "$HMAC_KEY_ID" || -z "$HMAC_SECRET" ]]; then
    echo "❌ HMAC_KEY_ID/HMAC_SECRET is empty (AUTH_MODE=hmac requires both)"
    exit 20
  fi
else
  echo "❌ AUTH_MODE must be jwt or hmac"
  exit 20
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_3_performance_${TS}"
mkdir -p "$EVID/sql_outputs" "$EVID/raw"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

# --- Python Bin (macOS usually only has python3) ---
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "❌ python/python3 not found. Install Python 3 or set PYTHON_BIN=/path/to/python3"
    exit 21
  fi
fi

# --- Node is required (used for robust JSON parsing in poll loop) ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. This gate requires Node.js (used for JSON parsing)."
  exit 22
fi

build_auth_headers_file () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  : > "$out_file"

  if [[ "$AUTH_MODE" == "jwt" ]]; then
    echo "header = \"Authorization: Bearer ${JWT_TOKEN}\"" >> "$out_file"
    return 0
  fi

  # HMAC mode
  "${PYTHON_BIN}" - <<import os, time, secrets, hashlib, hmac

method = os.environ["__HMAC_METHOD__"]
path   = os.environ["__HMAC_PATH__"]
body   = os.environ.get("__HMAC_BODY__", "")

key_id = os.environ["HMAC_KEY_ID"]
secret = os.environ["HMAC_SECRET"].encode("utf-8")

skew = int(os.environ.get("HMAC_CLOCK_SKEW_SEC","0"))
# Timestamp in milliseconds
timestamp = str(int((time.time() + skew) * 1000))
nonce = secrets.token_hex(16)

body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

canonical = "\n".join([method.upper(), path, timestamp, nonce, body_hash])

sig = hmac.new(secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()



print(fprint(fprint(fprint(fPY
  return 0
}

gen_headers () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  __HMAC_METHOD__="$method" __HMAC_PATH__="$path" __HMAC_BODY__="$body" \
    build_auth_headers_file "$method" "$path" "$body" "$out_file"
}


log "🚀 [P1-3] Performance & Stress Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"
log "BASE_URL=${BASE_URL}"
log "SHOT_ID=${SHOT_ID}"
log "LOAD_N=${LOAD_N}, LOAD_CONCURRENCY=${LOAD_CONCURRENCY}"
log "MAX_WAIT_SEC=${MAX_WAIT_SEC}, POLL_INTERVAL_SEC=${POLL_INTERVAL_SEC}"

# --------- Auto-detect job table + status column ----------
JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"
if [[ -z "$JOB_TABLE" ]]; then
  echo "❌ Cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
  exit 3
fi

STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"
if [[ -z "$STATUS_COL" ]]; then
  echo "❌ Cannot detect status/state column on ${JOB_TABLE}"
  exit 4
fi
log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

# --------- Metrics CSV header ----------
echo "ts,phase,jobs_total,terminal,succeeded,failed,pending,ledger_rows,ledger_dups" > "$EVID/metrics.csv"

snapshot_metrics () {
  local phase="$1"
  local jobs_total terminal succeeded failed pending ledger_rows ledger_dups

  jobs_total="$(psqlq -Atc "select count(*) from ${JOB_TABLE};" | tr -d  # $gate$
  terminal="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  succeeded="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  failed="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  pending="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text not in (
  ledger_rows="$(psqlq -Atc "select count(*) from cost_ledger;" | tr -d   # Ensure duplicates count is robust (handle empty) # $gate$
  ledger_dups="$(psqlq -Atc " # $gate$
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;" | tr -d   if [[ -z "$ledger_dups" ]]; then ledger_dups="0"; fi

  echo "$(date +%s),${phase},${jobs_total},${terminal},${succeeded},${failed},${pending},${ledger_rows},${ledger_dups}" >> "$EVID/metrics.csv"
}

# --------- Helpers ---------
is_terminal () {
  local s="$1"
  [[ "$s" == "SUCCEEDED" || "$s" == "COMPLETED" || "$s" == "FAILED" || "$s" == "CANCELED" || "$s" == "CANCELLED" ]]
}

log "== Phase A: Baseline Snapshot =="
snapshot_metrics "baseline"
psql_out "baseline_jobs_sample" -c "select id, \"${STATUS_COL}\"::text as status from ${JOB_TABLE} order by id desc limit 20;"
psql_out "baseline_cost_ledger_sample" -c "select \"jobId\",\"jobType\",\"costAmount\",currency,\"billingUnit\",quantity from cost_ledger order by id desc limit 20;"

log "== Auth Probe =="
probe_payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":0}}
JSON
)"
probe_hdr="$EVID/raw/_auth_probe_headers.txt"
probe_resp_hdr="$EVID/raw/auth_probe_headers_out.txt"
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$probe_payload" "$probe_hdr"

# Remove -sS to see errors, add -v
probe_resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  --config "$probe_hdr" \
  -D "$probe_resp_hdr" \
  -d "$probe_payload" || true)"
probe_code="$(echo "$probe_resp" | tail -1 | tr -d probe_body="$(echo "$probe_resp" | sed echo "$probe_body" > "$EVID/raw/auth_probe_body.json"
log "auth_probe_code=${probe_code}"
if [[ "$probe_code" != "200" && "$probe_code" != "201" ]]; then
  log "❌ Auth probe failed. See $EVID/raw/auth_probe_body.json"
  exit 25
fi
log "✅ Auth probe PASS"



log "== Phase B: Real Load Driver (API Create Jobs) =="
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
STATUS_URL_BASE="${BASE_URL}/api/jobs"

: > "$EVID/raw/create_responses.jsonl"
: > "$EVID/raw/create_httpcodes.log"
: > "$EVID/raw/status_httpcodes.log"
: > "$EVID/raw/job_ids.txt"
echo "job_id,created_at_ms,terminal_at_ms,latency_ms,final_status" > "$EVID/raw/latencies.csv"
: > "$EVID/raw/status_samples.jsonl"
# NEW: Granular creation time tracking
echo "job_id,created_at_ms" > "$EVID/raw/job_created_at.csv"

start_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"

log "Creating ${LOAD_N} jobs via ${CREATE_URL}"

# generate index list
# generate index list
"${PYTHON_BIN}" -c "for i in range(1, int($LOAD_N) + 1): print(i)" > "$EVID/raw/_load_idx.txt"

create_one () {
  local i="$1"
  local payload
  payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":${i}}}
JSON
)"
  # best-effort: capture response even if http fails
  local resp httpcode
  local hdr="$EVID/raw/_auth_headers_create_${i}.txt"
  gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$payload" "$hdr"

  resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
    -H "Content-Type: application/json" \
    --config "$hdr" \
    -d "$payload" || true)"
  httpcode="$(echo "$resp" | tail -1 | tr -d   body="$(echo "$resp" | sed 
  echo "$httpcode" >> "$EVID/raw/create_httpcodes.log"
  echo "$body" >> "$EVID/raw/create_responses.jsonl"

  if [[ "$httpcode" != "200" && "$httpcode" != "201" ]]; then
    echo "" # fail
    return 0
  fi

  # extract data.id and initial status
  local job_id
  job_id="$(echo "$body" | "${PYTHON_BIN}" - <<import sys, json
def pick(o, path):
  cur=o
  for k in path:
    if isinstance(cur, dict) and k in cur:
      cur=cur[k]
    else:
      return None
  return cur

try:
  obj=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit

candidates = [
  ["data","id"],
  ["data","job","id"],
  ["job","id"],
  ["id"],
]
for p in candidates:
  v=pick(obj,p)
  if isinstance(v,str) and v.strip():
    print(v.strip()); break
else:
  print("")
PY
)"
  
  # Fallback if python fails (e.g. env issues in xargs)
  if [[ -z "$job_id" ]]; then
     # tolerate whitespace: "data": { "id": "xxx" }
     job_id="$(echo "$body" | sed -n      if [[ -n "$job_id" ]]; then
       echo "Recovered job_id via sed: $job_id" >> "$EVID/raw/extraction_debug.log"
     else
       echo "Failed to extract job_id. Body: $body" >> "$EVID/raw/extraction_errors.log"
       echo "PYTHON_BIN=${PYTHON_BIN}" >> "$EVID/raw/extraction_errors.log"
     fi
  fi
  if [[ -n "$job_id" ]]; then
    local created_at_ms
    created_at_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
    echo "$job_id" >> "$EVID/raw/job_ids.txt"
    echo "${job_id},${created_at_ms}" >> "$EVID/raw/job_created_at.csv"
  fi
  echo ""
}

export -f create_one
export CREATE_URL AUTH_MODE JWT_TOKEN HMAC_KEY_ID HMAC_SECRET HMAC_CLOCK_SKEW_SEC EVID TS PYTHON_BIN BASE_URL SHOT_ID
export -f build_auth_headers_file gen_headers

# run creates in parallel
cat "$EVID/raw/_load_idx.txt" | xargs -P "$LOAD_CONCURRENCY" -n 1 -I{} bash -lc 
# de-dup + sanitize job ids
sort -u "$EVID/raw/job_ids.txt" | sed mv "$EVID/raw/job_ids.unique.txt" "$EVID/raw/job_ids.txt"
created_cnt="$(wc -l < "$EVID/raw/job_ids.txt" | tr -d log "Created jobs (parsed data.id): ${created_cnt}/${LOAD_N}"

if [[ "$created_cnt" -eq 0 ]]; then
  log "❌ Create phase produced 0 job ids. Dumping diagnostics..."
  log "Last 10 httpcodes:"
  tail -n 10 "$EVID/raw/create_httpcodes.log" 2>/dev/null | sed   log "Last 3 responses:"
  tail -n 3 "$EVID/raw/create_responses.jsonl" 2>/dev/null | sed   exit 30
fi

# compute create throughput
end_create_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
dur_ms="$((end_create_ms - start_ms))"
if [[ "$dur_ms" -le 0 ]]; then dur_ms=1; fi
jobs_per_min="$("${PYTHON_BIN}" - <<PY
dur_ms=$dur_ms
created=$created_cnt
print(round(created / (dur_ms/1000.0) * 60.0, 2))
PY
)"
log "Create throughput: ${jobs_per_min} jobs/min"

snapshot_metrics "after_create"

log "== Phase C: Poll Job Status until terminal or timeout =="
deadline_s="$(( $(date +%s) + MAX_WAIT_SEC ))"

# poll loop
# poll loop
# preload created_at map (fs-based for Bash 3.2 compatibility)
mkdir -p "$EVID/raw/map_created_at"
while   [[ "$jid" == "job_id" ]] && continue
  [[ -z "$jid" ]] && continue
  echo "$cts" > "$EVID/raw/map_created_at/$jid"
done < "$EVID/raw/job_created_at.csv"

# track completion via fs (Bash 3.2 compat)
mkdir -p "$EVID/raw/map_done"
success=0
fail=0

while : ; do
  now_s="$(date +%s)"
  if [[ "$now_s" -ge "$deadline_s" ]]; then
    log "⏱️ Poll timeout reached"
    break
  fi

  # pending_this_round=0 # unused actually, just iterating

  while read -r jid; do
    [[ -z "$jid" ]] && continue
    # check done map
    if [[ -f "$EVID/raw/map_done/$jid" ]]; then
      continue
    fi

    # per-job headers file to avoid any future concurrency clobbering
    hdr="$EVID/raw/_auth_headers_get_${jid}.txt"
    gen_headers "GET" "/api/jobs/${jid}" "" "$hdr"

    resp_with_code="$(curl -sS -w "\n%{http_code}" -X GET "${STATUS_URL_BASE}/${jid}" \
      --config "$hdr" || true)"
    httpcode="$(echo "$resp_with_code" | tail -1 | tr -d     resp="$(echo "$resp_with_code" | sed     echo "$resp" >> "$EVID/raw/status_samples.jsonl"
    echo "$httpcode" >> "$EVID/raw/status_httpcodes.log"

    if [[ "$httpcode" != "200" ]]; then
      echo "$resp" > "$EVID/raw/status_last_error_body.json"
      log "❌ Poll GET failed (httpcode=${httpcode}) for job=${jid}. See $EVID/raw/status_last_error_body.json"
      exit 41
    fi

    status="$(echo "$resp" | node -e       const fs = require("fs");
      try {
        const input = fs.readFileSync(0, "utf-8");
        const obj = JSON.parse(input);
        const s = obj?.data?.status || obj?.status || "";
        console.log(s);
      } catch (e) {
        console.log("__JSON_PARSE_ERROR__");
      }
        if [[ "$status" == "__JSON_PARSE_ERROR__" ]]; then
      echo "$resp" > "$EVID/raw/status_last_nonjson_body.txt"
      log "❌ Poll GET returned non-JSON body. See $EVID/raw/status_last_nonjson_body.txt"
      exit 42
    fi
    if [[ -z "$status" ]]; then
      # status missing is a schema/API bug: fail fast with evidence
      echo "$resp" > "$EVID/raw/status_last_missing_status.json"
      log "❌ Poll GET JSON missing status field. See $EVID/raw/status_last_missing_status.json"
      exit 43
    fi

    if is_terminal "$status"; then
      term_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
      # LATENCY CALC: use granular created_at info (fs lookup)
      if [[ -f "$EVID/raw/map_created_at/$jid" ]]; then
        created_at_ms="$(cat "$EVID/raw/map_created_at/$jid")"
      else
        created_at_ms="$start_ms"
      fi
      
      latency_ms="$((term_ms - created_at_ms))"
      
      echo "${jid},${created_at_ms},${term_ms},${latency_ms},${status}" >> "$EVID/raw/latencies.csv"
      
      # mark done
      touch "$EVID/raw/map_done/$jid"
      if [[ "$status" == "SUCCEEDED" || "$status" == "COMPLETED" ]]; then
        success=$((success+1))
      else
        fail=$((fail+1))
      fi
    fi
  done < "$EVID/raw/job_ids.txt"

  snapshot_metrics "poll"
  
  # count done files in map_done directory
  done_cnt="$(find "$EVID/raw/map_done" -type f 2>/dev/null | wc -l | tr -d   if [[ "$done_cnt" -ge "$created_cnt" && "$created_cnt" -gt 0 ]]; then
    log "All parsed jobs reached terminal: ${done_cnt}/${created_cnt}"
    break
  fi

  sleep "$POLL_INTERVAL_SEC"
done

snapshot_metrics "final"

log "== Phase D: Hard Assertions =="
# A1: ledger duplicates = 0 (scoped to this run only, robust via psql \copy)
ledger_dups_last="$(
  psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A <<SQL # $gate$
\\set QUIET 1
CREATE TEMP TABLE run_job_ids(job_id text) ON COMMIT DROP;
\\copy run_job_ids(job_id) FROM SELECT count(*)
FROM (
  SELECT cl."jobId", cl."jobType"
  FROM cost_ledger cl
  JOIN run_job_ids rj ON rj.job_id = cl."jobId"::text
  GROUP BY cl."jobId", cl."jobType"
  HAVING count(*) > 1
) sub;
SQL
)"
ledger_dups_last="$(echo "$ledger_dups_last" | tr -d if [[ -z "$ledger_dups_last" ]]; then ledger_dups_last="0"; fi

if [[ "$ledger_dups_last" != "0" ]]; then
  echo "❌ P1-3 FAIL: cost_ledger duplicates detected (ledger_dups=${ledger_dups_last})"
  exit 10
fi

# A2: success rate
if [[ "$created_cnt" -gt 0 ]]; then
  success_rate="$("${PYTHON_BIN}" - <<PY
s=$success
c=$created_cnt
print(round(s/c, 4))
PY
)"
else
  success_rate="0"
fi
log "success=${success}, fail=${fail}, created_cnt=${created_cnt}, success_rate=${success_rate}"
"${PYTHON_BIN}" - <<PY
sr=float("$success_rate")
min_sr=float("$MIN_SUCCESS_RATE")
import sys
if sr + 1e-12 < min_sr:
  print(f"❌ P1-3 FAIL: success_rate {sr} < MIN_SUCCESS_RATE {min_sr}")
  sys.exit(11)
print("✅ success_rate PASS")
PY

# A3: pending_end threshold
pending_end="$(tail -1 "$EVID/metrics.csv" | awk -Fif [[ -z "$pending_end" ]]; then pending_end="0"; fi

log "pending_end=${pending_end}, MAX_PENDING_END=${MAX_PENDING_END}"
"${PYTHON_BIN}" - <<PY
pe=int("$pending_end")
mx=int("$MAX_PENDING_END")
import sys
if pe > mx:
  print(f"❌ P1-3 FAIL: pending_end {pe} > MAX_PENDING_END {mx}")
  sys.exit(12)
print("✅ pending_end PASS")
PY

# A4: latency p95
p95_ms="$("${PYTHON_BIN}" - <<import csv, statistics, sys
path=sys.argv[1]
vals=[]
try:
  with open(path,newline=    r=csv.DictReader(f)
    for row in r:
      try:
        vals.append(int(row["latency_ms"]))
      except Exception:
        pass
except Exception:
  pass
if not vals:
  print("0")
  sys.exit(0)
vals.sort()
k=int((len(vals)-1)*0.95)
print(vals[k])
PY
"$EVID/raw/latencies.csv")"

log "p95_ms=${p95_ms}, MAX_P95_SEC=${MAX_P95_SEC}"
"${PYTHON_BIN}" - <<PY
p95_ms=int("$p95_ms")
mx_s=int("$MAX_P95_SEC")
import sys
if p95_ms > mx_s*1000:
  print(f"❌ P1-3 FAIL: p95_ms {p95_ms} > MAX_P95_SEC {mx_s}s")
  sys.exit(13)
print("✅ p95 latency PASS")
PY

cat > "${EVID}/FINAL_REPORT.md" <<EOF2
# P1-3 Performance & Stress Gate - FINAL REPORT (Real Load Driver)

- Timestamp: ${TS}
- DB: ${DB}
- BASE_URL: ${BASE_URL}
- SHOT_ID: ${SHOT_ID}
- JOB_TABLE: ${JOB_TABLE}
- STATUS_COL: ${STATUS_COL}

## Load Config
- LOAD_N: ${LOAD_N}
- LOAD_CONCURRENCY: ${LOAD_CONCURRENCY}
- MAX_WAIT_SEC: ${MAX_WAIT_SEC}
- POLL_INTERVAL_SEC: ${POLL_INTERVAL_SEC}

## Results
- created_cnt: ${created_cnt}/${LOAD_N}
- success: ${success}
- fail: ${fail}
- success_rate: ${success_rate}
- p95_ms: ${p95_ms}

## Hard Assertions
- cost_ledger duplicates == 0 ✅
- success_rate >= ${MIN_SUCCESS_RATE} ✅
- pending_end <= ${MAX_PENDING_END} ✅
- p95 latency <= ${MAX_P95_SEC}s ✅

## Evidence
- metrics.csv (DB-side time series)
- raw/create_responses.jsonl
- raw/job_ids.txt
- raw/status_samples.jsonl
- raw/latencies.csv
- FINAL_REPORT.md
- sql_outputs/*
EOF2

log "✅ P1-3 Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi
DB="${DB_URL%%\?*}"

# --- Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

# --- Load Driver Config ---
# Defaults to 3001 unless override
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_MODE="${AUTH_MODE:-jwt}"     # jwt|hmac (Default to jwt for User simulation)
JWT_TOKEN="${JWT_TOKEN:-${TEST_TOKEN:-}}"

HMAC_KEY_ID="${HMAC_KEY_ID:-}"
HMAC_SECRET="${HMAC_SECRET:-}"
HMAC_CLOCK_SKEW_SEC="${HMAC_CLOCK_SKEW_SEC:-0}"  # Local clock skew correction

SHOT_ID="${SHOT_ID:-shot_ed5aeca0768441dcbc193c699a28f69c}"

LOAD_N="${LOAD_N:-50}"
LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-5}"

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-1}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-600}"

MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-0.98}"
MAX_P95_SEC="${MAX_P95_SEC:-300}"
MAX_PENDING_END="${MAX_PENDING_END:-0}"

if [[ "$AUTH_MODE" == "jwt" ]]; then
  if [[ -z "$JWT_TOKEN" ]]; then
    echo "❌ JWT_TOKEN is empty (AUTH_MODE=jwt requires JWT_TOKEN)"
    exit 20
  fi
elif [[ "$AUTH_MODE" == "hmac" ]]; then
  if [[ -z "$HMAC_KEY_ID" || -z "$HMAC_SECRET" ]]; then
    echo "❌ HMAC_KEY_ID/HMAC_SECRET is empty (AUTH_MODE=hmac requires both)"
    exit 20
  fi
else
  echo "❌ AUTH_MODE must be jwt or hmac"
  exit 20
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_3_performance_${TS}"
mkdir -p "$EVID/sql_outputs" "$EVID/raw"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

# --- Python Bin (macOS usually only has python3) ---
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "❌ python/python3 not found. Install Python 3 or set PYTHON_BIN=/path/to/python3"
    exit 21
  fi
fi

# --- Node is required (used for robust JSON parsing in poll loop) ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. This gate requires Node.js (used for JSON parsing)."
  exit 22
fi

build_auth_headers_file () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  : > "$out_file"

  if [[ "$AUTH_MODE" == "jwt" ]]; then
    echo "header = \"Authorization: Bearer ${JWT_TOKEN}\"" >> "$out_file"
    return 0
  fi

  # HMAC mode
  "${PYTHON_BIN}" - <<import os, time, secrets, hashlib, hmac

method = os.environ["__HMAC_METHOD__"]
path   = os.environ["__HMAC_PATH__"]
body   = os.environ.get("__HMAC_BODY__", "")

key_id = os.environ["HMAC_KEY_ID"]
secret = os.environ["HMAC_SECRET"].encode("utf-8")

skew = int(os.environ.get("HMAC_CLOCK_SKEW_SEC","0"))
# Timestamp in milliseconds
timestamp = str(int((time.time() + skew) * 1000))
nonce = secrets.token_hex(16)

body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

canonical = "\n".join([method.upper(), path, timestamp, nonce, body_hash])

sig = hmac.new(secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()



print(fprint(fprint(fprint(fPY
  return 0
}

gen_headers () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  __HMAC_METHOD__="$method" __HMAC_PATH__="$path" __HMAC_BODY__="$body" \
    build_auth_headers_file "$method" "$path" "$body" "$out_file"
}


log "🚀 [P1-3] Performance & Stress Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"
log "BASE_URL=${BASE_URL}"
log "SHOT_ID=${SHOT_ID}"
log "LOAD_N=${LOAD_N}, LOAD_CONCURRENCY=${LOAD_CONCURRENCY}"
log "MAX_WAIT_SEC=${MAX_WAIT_SEC}, POLL_INTERVAL_SEC=${POLL_INTERVAL_SEC}"

# --------- Auto-detect job table + status column ----------
JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"
if [[ -z "$JOB_TABLE" ]]; then
  echo "❌ Cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
  exit 3
fi

STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"
if [[ -z "$STATUS_COL" ]]; then
  echo "❌ Cannot detect status/state column on ${JOB_TABLE}"
  exit 4
fi
log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

# --------- Metrics CSV header ----------
echo "ts,phase,jobs_total,terminal,succeeded,failed,pending,ledger_rows,ledger_dups" > "$EVID/metrics.csv"

snapshot_metrics () {
  local phase="$1"
  local jobs_total terminal succeeded failed pending ledger_rows ledger_dups

  jobs_total="$(psqlq -Atc "select count(*) from ${JOB_TABLE};" | tr -d  # $gate$
  terminal="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  succeeded="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  failed="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  pending="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text not in (
  ledger_rows="$(psqlq -Atc "select count(*) from cost_ledger;" | tr -d   # Ensure duplicates count is robust (handle empty) # $gate$
  ledger_dups="$(psqlq -Atc " # $gate$
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;" | tr -d   if [[ -z "$ledger_dups" ]]; then ledger_dups="0"; fi

  echo "$(date +%s),${phase},${jobs_total},${terminal},${succeeded},${failed},${pending},${ledger_rows},${ledger_dups}" >> "$EVID/metrics.csv"
}

# --------- Helpers ---------
is_terminal () {
  local s="$1"
  [[ "$s" == "SUCCEEDED" || "$s" == "COMPLETED" || "$s" == "FAILED" || "$s" == "CANCELED" || "$s" == "CANCELLED" ]]
}

log "== Phase A: Baseline Snapshot =="
snapshot_metrics "baseline"
psql_out "baseline_jobs_sample" -c "select id, \"${STATUS_COL}\"::text as status from ${JOB_TABLE} order by id desc limit 20;"
psql_out "baseline_cost_ledger_sample" -c "select \"jobId\",\"jobType\",\"costAmount\",currency,\"billingUnit\",quantity from cost_ledger order by id desc limit 20;"

log "== Auth Probe =="
probe_payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":0}}
JSON
)"
probe_hdr="$EVID/raw/_auth_probe_headers.txt"
probe_resp_hdr="$EVID/raw/auth_probe_headers_out.txt"
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$probe_payload" "$probe_hdr"

# Remove -sS to see errors, add -v
probe_resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  --config "$probe_hdr" \
  -D "$probe_resp_hdr" \
  -d "$probe_payload" || true)"
probe_code="$(echo "$probe_resp" | tail -1 | tr -d probe_body="$(echo "$probe_resp" | sed echo "$probe_body" > "$EVID/raw/auth_probe_body.json"
log "auth_probe_code=${probe_code}"
if [[ "$probe_code" != "200" && "$probe_code" != "201" ]]; then
  log "❌ Auth probe failed. See $EVID/raw/auth_probe_body.json"
  exit 25
fi
log "✅ Auth probe PASS"



log "== Phase B: Real Load Driver (API Create Jobs) =="
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
STATUS_URL_BASE="${BASE_URL}/api/jobs"

: > "$EVID/raw/create_responses.jsonl"
: > "$EVID/raw/create_httpcodes.log"
: > "$EVID/raw/status_httpcodes.log"
: > "$EVID/raw/job_ids.txt"
echo "job_id,created_at_ms,terminal_at_ms,latency_ms,final_status" > "$EVID/raw/latencies.csv"
: > "$EVID/raw/status_samples.jsonl"
# NEW: Granular creation time tracking
echo "job_id,created_at_ms" > "$EVID/raw/job_created_at.csv"

start_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"

log "Creating ${LOAD_N} jobs via ${CREATE_URL}"

# generate index list
# generate index list
"${PYTHON_BIN}" -c "for i in range(1, int($LOAD_N) + 1): print(i)" > "$EVID/raw/_load_idx.txt"

create_one () {
  local i="$1"
  local payload
  payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":${i}}}
JSON
)"
  # best-effort: capture response even if http fails
  local resp httpcode
  local hdr="$EVID/raw/_auth_headers_create_${i}.txt"
  gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$payload" "$hdr"

  resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
    -H "Content-Type: application/json" \
    --config "$hdr" \
    -d "$payload" || true)"
  httpcode="$(echo "$resp" | tail -1 | tr -d   body="$(echo "$resp" | sed 
  echo "$httpcode" >> "$EVID/raw/create_httpcodes.log"
  echo "$body" >> "$EVID/raw/create_responses.jsonl"

  if [[ "$httpcode" != "200" && "$httpcode" != "201" ]]; then
    echo "" # fail
    return 0
  fi

  # extract data.id and initial status
  local job_id
  job_id="$(echo "$body" | "${PYTHON_BIN}" - <<import sys, json
def pick(o, path):
  cur=o
  for k in path:
    if isinstance(cur, dict) and k in cur:
      cur=cur[k]
    else:
      return None
  return cur

try:
  obj=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit

candidates = [
  ["data","id"],
  ["data","job","id"],
  ["job","id"],
  ["id"],
]
for p in candidates:
  v=pick(obj,p)
  if isinstance(v,str) and v.strip():
    print(v.strip()); break
else:
  print("")
PY
)"
  
  # Fallback if python fails (e.g. env issues in xargs)
  if [[ -z "$job_id" ]]; then
     # tolerate whitespace: "data": { "id": "xxx" }
     job_id="$(echo "$body" | sed -n      if [[ -n "$job_id" ]]; then
       echo "Recovered job_id via sed: $job_id" >> "$EVID/raw/extraction_debug.log"
     else
       echo "Failed to extract job_id. Body: $body" >> "$EVID/raw/extraction_errors.log"
       echo "PYTHON_BIN=${PYTHON_BIN}" >> "$EVID/raw/extraction_errors.log"
     fi
  fi
  if [[ -n "$job_id" ]]; then
    local created_at_ms
    created_at_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
    echo "$job_id" >> "$EVID/raw/job_ids.txt"
    echo "${job_id},${created_at_ms}" >> "$EVID/raw/job_created_at.csv"
  fi
  echo ""
}

export -f create_one
export CREATE_URL AUTH_MODE JWT_TOKEN HMAC_KEY_ID HMAC_SECRET HMAC_CLOCK_SKEW_SEC EVID TS PYTHON_BIN BASE_URL SHOT_ID
export -f build_auth_headers_file gen_headers

# run creates in parallel
cat "$EVID/raw/_load_idx.txt" | xargs -P "$LOAD_CONCURRENCY" -n 1 -I{} bash -lc 
# de-dup + sanitize job ids
sort -u "$EVID/raw/job_ids.txt" | sed mv "$EVID/raw/job_ids.unique.txt" "$EVID/raw/job_ids.txt"
created_cnt="$(wc -l < "$EVID/raw/job_ids.txt" | tr -d log "Created jobs (parsed data.id): ${created_cnt}/${LOAD_N}"

if [[ "$created_cnt" -eq 0 ]]; then
  log "❌ Create phase produced 0 job ids. Dumping diagnostics..."
  log "Last 10 httpcodes:"
  tail -n 10 "$EVID/raw/create_httpcodes.log" 2>/dev/null | sed   log "Last 3 responses:"
  tail -n 3 "$EVID/raw/create_responses.jsonl" 2>/dev/null | sed   exit 30
fi

# compute create throughput
end_create_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
dur_ms="$((end_create_ms - start_ms))"
if [[ "$dur_ms" -le 0 ]]; then dur_ms=1; fi
jobs_per_min="$("${PYTHON_BIN}" - <<PY
dur_ms=$dur_ms
created=$created_cnt
print(round(created / (dur_ms/1000.0) * 60.0, 2))
PY
)"
log "Create throughput: ${jobs_per_min} jobs/min"

snapshot_metrics "after_create"

log "== Phase C: Poll Job Status until terminal or timeout =="
deadline_s="$(( $(date +%s) + MAX_WAIT_SEC ))"

# poll loop
# poll loop
# preload created_at map (fs-based for Bash 3.2 compatibility)
mkdir -p "$EVID/raw/map_created_at"
while   [[ "$jid" == "job_id" ]] && continue
  [[ -z "$jid" ]] && continue
  echo "$cts" > "$EVID/raw/map_created_at/$jid"
done < "$EVID/raw/job_created_at.csv"

# track completion via fs (Bash 3.2 compat)
mkdir -p "$EVID/raw/map_done"
success=0
fail=0

while : ; do
  now_s="$(date +%s)"
  if [[ "$now_s" -ge "$deadline_s" ]]; then
    log "⏱️ Poll timeout reached"
    break
  fi

  # pending_this_round=0 # unused actually, just iterating

  while read -r jid; do
    [[ -z "$jid" ]] && continue
    # check done map
    if [[ -f "$EVID/raw/map_done/$jid" ]]; then
      continue
    fi

    # per-job headers file to avoid any future concurrency clobbering
    hdr="$EVID/raw/_auth_headers_get_${jid}.txt"
    gen_headers "GET" "/api/jobs/${jid}" "" "$hdr"

    resp_with_code="$(curl -sS -w "\n%{http_code}" -X GET "${STATUS_URL_BASE}/${jid}" \
      --config "$hdr" || true)"
    httpcode="$(echo "$resp_with_code" | tail -1 | tr -d     resp="$(echo "$resp_with_code" | sed     echo "$resp" >> "$EVID/raw/status_samples.jsonl"
    echo "$httpcode" >> "$EVID/raw/status_httpcodes.log"

    if [[ "$httpcode" != "200" ]]; then
      echo "$resp" > "$EVID/raw/status_last_error_body.json"
      log "❌ Poll GET failed (httpcode=${httpcode}) for job=${jid}. See $EVID/raw/status_last_error_body.json"
      exit 41
    fi

    status="$(echo "$resp" | node -e       const fs = require("fs");
      try {
        const input = fs.readFileSync(0, "utf-8");
        const obj = JSON.parse(input);
        const s = obj?.data?.status || obj?.status || "";
        console.log(s);
      } catch (e) {
        console.log("__JSON_PARSE_ERROR__");
      }
        if [[ "$status" == "__JSON_PARSE_ERROR__" ]]; then
      echo "$resp" > "$EVID/raw/status_last_nonjson_body.txt"
      log "❌ Poll GET returned non-JSON body. See $EVID/raw/status_last_nonjson_body.txt"
      exit 42
    fi
    if [[ -z "$status" ]]; then
      # status missing is a schema/API bug: fail fast with evidence
      echo "$resp" > "$EVID/raw/status_last_missing_status.json"
      log "❌ Poll GET JSON missing status field. See $EVID/raw/status_last_missing_status.json"
      exit 43
    fi

    if is_terminal "$status"; then
      term_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
      # LATENCY CALC: use granular created_at info (fs lookup)
      if [[ -f "$EVID/raw/map_created_at/$jid" ]]; then
        created_at_ms="$(cat "$EVID/raw/map_created_at/$jid")"
      else
        created_at_ms="$start_ms"
      fi
      
      latency_ms="$((term_ms - created_at_ms))"
      
      echo "${jid},${created_at_ms},${term_ms},${latency_ms},${status}" >> "$EVID/raw/latencies.csv"
      
      # mark done
      touch "$EVID/raw/map_done/$jid"
      if [[ "$status" == "SUCCEEDED" || "$status" == "COMPLETED" ]]; then
        success=$((success+1))
      else
        fail=$((fail+1))
      fi
    fi
  done < "$EVID/raw/job_ids.txt"

  snapshot_metrics "poll"
  
  # count done files in map_done directory
  done_cnt="$(find "$EVID/raw/map_done" -type f 2>/dev/null | wc -l | tr -d   if [[ "$done_cnt" -ge "$created_cnt" && "$created_cnt" -gt 0 ]]; then
    log "All parsed jobs reached terminal: ${done_cnt}/${created_cnt}"
    break
  fi

  sleep "$POLL_INTERVAL_SEC"
done

snapshot_metrics "final"

log "== Phase D: Hard Assertions =="
# A1: ledger duplicates = 0 (scoped to this run only, robust via psql \copy)
ledger_dups_last="$(
  psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A <<SQL # $gate$
\\set QUIET 1
CREATE TEMP TABLE run_job_ids(job_id text) ON COMMIT DROP;
\\copy run_job_ids(job_id) FROM SELECT count(*)
FROM (
  SELECT cl."jobId", cl."jobType"
  FROM cost_ledger cl
  JOIN run_job_ids rj ON rj.job_id = cl."jobId"::text
  GROUP BY cl."jobId", cl."jobType"
  HAVING count(*) > 1
) sub;
SQL
)"
ledger_dups_last="$(echo "$ledger_dups_last" | tr -d if [[ -z "$ledger_dups_last" ]]; then ledger_dups_last="0"; fi

if [[ "$ledger_dups_last" != "0" ]]; then
  echo "❌ P1-3 FAIL: cost_ledger duplicates detected (ledger_dups=${ledger_dups_last})"
  exit 10
fi

# A2: success rate
if [[ "$created_cnt" -gt 0 ]]; then
  success_rate="$("${PYTHON_BIN}" - <<PY
s=$success
c=$created_cnt
print(round(s/c, 4))
PY
)"
else
  success_rate="0"
fi
log "success=${success}, fail=${fail}, created_cnt=${created_cnt}, success_rate=${success_rate}"
"${PYTHON_BIN}" - <<PY
sr=float("$success_rate")
min_sr=float("$MIN_SUCCESS_RATE")
import sys
if sr + 1e-12 < min_sr:
  print(f"❌ P1-3 FAIL: success_rate {sr} < MIN_SUCCESS_RATE {min_sr}")
  sys.exit(11)
print("✅ success_rate PASS")
PY

# A3: pending_end threshold
pending_end="$(tail -1 "$EVID/metrics.csv" | awk -Fif [[ -z "$pending_end" ]]; then pending_end="0"; fi

log "pending_end=${pending_end}, MAX_PENDING_END=${MAX_PENDING_END}"
"${PYTHON_BIN}" - <<PY
pe=int("$pending_end")
mx=int("$MAX_PENDING_END")
import sys
if pe > mx:
  print(f"❌ P1-3 FAIL: pending_end {pe} > MAX_PENDING_END {mx}")
  sys.exit(12)
print("✅ pending_end PASS")
PY

# A4: latency p95
p95_ms="$("${PYTHON_BIN}" - <<import csv, statistics, sys
path=sys.argv[1]
vals=[]
try:
  with open(path,newline=    r=csv.DictReader(f)
    for row in r:
      try:
        vals.append(int(row["latency_ms"]))
      except Exception:
        pass
except Exception:
  pass
if not vals:
  print("0")
  sys.exit(0)
vals.sort()
k=int((len(vals)-1)*0.95)
print(vals[k])
PY
"$EVID/raw/latencies.csv")"

log "p95_ms=${p95_ms}, MAX_P95_SEC=${MAX_P95_SEC}"
"${PYTHON_BIN}" - <<PY
p95_ms=int("$p95_ms")
mx_s=int("$MAX_P95_SEC")
import sys
if p95_ms > mx_s*1000:
  print(f"❌ P1-3 FAIL: p95_ms {p95_ms} > MAX_P95_SEC {mx_s}s")
  sys.exit(13)
print("✅ p95 latency PASS")
PY

cat > "${EVID}/FINAL_REPORT.md" <<EOF2
# P1-3 Performance & Stress Gate - FINAL REPORT (Real Load Driver)

- Timestamp: ${TS}
- DB: ${DB}
- BASE_URL: ${BASE_URL}
- SHOT_ID: ${SHOT_ID}
- JOB_TABLE: ${JOB_TABLE}
- STATUS_COL: ${STATUS_COL}

## Load Config
- LOAD_N: ${LOAD_N}
- LOAD_CONCURRENCY: ${LOAD_CONCURRENCY}
- MAX_WAIT_SEC: ${MAX_WAIT_SEC}
- POLL_INTERVAL_SEC: ${POLL_INTERVAL_SEC}

## Results
- created_cnt: ${created_cnt}/${LOAD_N}
- success: ${success}
- fail: ${fail}
- success_rate: ${success_rate}
- p95_ms: ${p95_ms}

## Hard Assertions
- cost_ledger duplicates == 0 ✅
- success_rate >= ${MIN_SUCCESS_RATE} ✅
- pending_end <= ${MAX_PENDING_END} ✅
- p95 latency <= ${MAX_P95_SEC}s ✅

## Evidence
- metrics.csv (DB-side time series)
- raw/create_responses.jsonl
- raw/job_ids.txt
- raw/status_samples.jsonl
- raw/latencies.csv
- FINAL_REPORT.md
- sql_outputs/*
EOF2

log "✅ P1-3 Gate PASS. Evidence: ${EVID}"

source "$(dirname "$0")/../common/load_env.sh"

DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL is empty"
  exit 2
fi
DB="${DB_URL%%\?*}"

# --- Safety Guard ---
if ! echo "$DB" | grep -Eq   echo "❌ SAFETY_GUARD: DATABASE_URL must contain localhost/127.0.0.1"
  echo "DB=$DB"
  exit 99
fi

# --- Load Driver Config ---
# Defaults to 3001 unless override
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_MODE="${AUTH_MODE:-jwt}"     # jwt|hmac (Default to jwt for User simulation)
JWT_TOKEN="${JWT_TOKEN:-${TEST_TOKEN:-}}"

HMAC_KEY_ID="${HMAC_KEY_ID:-}"
HMAC_SECRET="${HMAC_SECRET:-}"
HMAC_CLOCK_SKEW_SEC="${HMAC_CLOCK_SKEW_SEC:-0}"  # Local clock skew correction

SHOT_ID="${SHOT_ID:-shot_ed5aeca0768441dcbc193c699a28f69c}"

LOAD_N="${LOAD_N:-50}"
LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-5}"

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-1}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-600}"

MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-0.98}"
MAX_P95_SEC="${MAX_P95_SEC:-300}"
MAX_PENDING_END="${MAX_PENDING_END:-0}"

if [[ "$AUTH_MODE" == "jwt" ]]; then
  if [[ -z "$JWT_TOKEN" ]]; then
    echo "❌ JWT_TOKEN is empty (AUTH_MODE=jwt requires JWT_TOKEN)"
    exit 20
  fi
elif [[ "$AUTH_MODE" == "hmac" ]]; then
  if [[ -z "$HMAC_KEY_ID" || -z "$HMAC_SECRET" ]]; then
    echo "❌ HMAC_KEY_ID/HMAC_SECRET is empty (AUTH_MODE=hmac requires both)"
    exit 20
  fi
else
  echo "❌ AUTH_MODE must be jwt or hmac"
  exit 20
fi

TS=$(date +%Y%m%d_%H%M%S)
EVID="docs/_evidence/p1_3_performance_${TS}"
mkdir -p "$EVID/sql_outputs" "$EVID/raw"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$EVID/gate.log"; }
psqlq(){ psql "$DB" -v ON_ERROR_STOP=1 -X -q -t "$@"; } # $gate$
psql_out(){ local name="$1"; shift; psqlq "$@" > "$EVID/sql_outputs/${name}.log"; } # $gate$

# --- Python Bin (macOS usually only has python3) ---
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "❌ python/python3 not found. Install Python 3 or set PYTHON_BIN=/path/to/python3"
    exit 21
  fi
fi

# --- Node is required (used for robust JSON parsing in poll loop) ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. This gate requires Node.js (used for JSON parsing)."
  exit 22
fi

build_auth_headers_file () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  : > "$out_file"

  if [[ "$AUTH_MODE" == "jwt" ]]; then
    echo "header = \"Authorization: Bearer ${JWT_TOKEN}\"" >> "$out_file"
    return 0
  fi

  # HMAC mode
  "${PYTHON_BIN}" - <<import os, time, secrets, hashlib, hmac

method = os.environ["__HMAC_METHOD__"]
path   = os.environ["__HMAC_PATH__"]
body   = os.environ.get("__HMAC_BODY__", "")

key_id = os.environ["HMAC_KEY_ID"]
secret = os.environ["HMAC_SECRET"].encode("utf-8")

skew = int(os.environ.get("HMAC_CLOCK_SKEW_SEC","0"))
# Timestamp in milliseconds
timestamp = str(int((time.time() + skew) * 1000))
nonce = secrets.token_hex(16)

body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

canonical = "\n".join([method.upper(), path, timestamp, nonce, body_hash])

sig = hmac.new(secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()



print(fprint(fprint(fprint(fPY
  return 0
}

gen_headers () {
  local method="$1"
  local path="$2"
  local body="$3"
  local out_file="$4"

  __HMAC_METHOD__="$method" __HMAC_PATH__="$path" __HMAC_BODY__="$body" \
    build_auth_headers_file "$method" "$path" "$body" "$out_file"
}


log "🚀 [P1-3] Performance & Stress Gate Starting..."
log "Target DB: ${DB}"
log "Evidence: ${EVID}"
log "BASE_URL=${BASE_URL}"
log "SHOT_ID=${SHOT_ID}"
log "LOAD_N=${LOAD_N}, LOAD_CONCURRENCY=${LOAD_CONCURRENCY}"
log "MAX_WAIT_SEC=${MAX_WAIT_SEC}, POLL_INTERVAL_SEC=${POLL_INTERVAL_SEC}"

# --------- Auto-detect job table + status column ----------
JOB_TABLE="$(psqlq -Atc " # $gate$
select table_name
from information_schema.tables
where table_schema=  and table_name in (order by case table_name
  when   when   when   else 9 end
limit 1;")"
if [[ -z "$JOB_TABLE" ]]; then
  echo "❌ Cannot detect job table (shot_jobs/jobs/ce_jobs/job)"
  exit 3
fi

STATUS_COL="$(psqlq -Atc " # $gate$
select column_name
from information_schema.columns
where table_schema=  and table_name=  and column_name in (order by case column_name when limit 1;")"
if [[ -z "$STATUS_COL" ]]; then
  echo "❌ Cannot detect status/state column on ${JOB_TABLE}"
  exit 4
fi
log "Detected JOB_TABLE=${JOB_TABLE}, STATUS_COL=${STATUS_COL}"

# --------- Metrics CSV header ----------
echo "ts,phase,jobs_total,terminal,succeeded,failed,pending,ledger_rows,ledger_dups" > "$EVID/metrics.csv"

snapshot_metrics () {
  local phase="$1"
  local jobs_total terminal succeeded failed pending ledger_rows ledger_dups

  jobs_total="$(psqlq -Atc "select count(*) from ${JOB_TABLE};" | tr -d  # $gate$
  terminal="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  succeeded="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  failed="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text in (
  pending="$(psqlq -Atc " # $gate$
select count(*)
from ${JOB_TABLE}
where \"${STATUS_COL}\"::text not in (
  ledger_rows="$(psqlq -Atc "select count(*) from cost_ledger;" | tr -d   # Ensure duplicates count is robust (handle empty) # $gate$
  ledger_dups="$(psqlq -Atc " # $gate$
select count(*)
from (
  select \"jobId\", \"jobType\"
  from cost_ledger
  group by \"jobId\", \"jobType\"
  having count(*) > 1
) sub;" | tr -d   if [[ -z "$ledger_dups" ]]; then ledger_dups="0"; fi

  echo "$(date +%s),${phase},${jobs_total},${terminal},${succeeded},${failed},${pending},${ledger_rows},${ledger_dups}" >> "$EVID/metrics.csv"
}

# --------- Helpers ---------
is_terminal () {
  local s="$1"
  [[ "$s" == "SUCCEEDED" || "$s" == "COMPLETED" || "$s" == "FAILED" || "$s" == "CANCELED" || "$s" == "CANCELLED" ]]
}

log "== Phase A: Baseline Snapshot =="
snapshot_metrics "baseline"
psql_out "baseline_jobs_sample" -c "select id, \"${STATUS_COL}\"::text as status from ${JOB_TABLE} order by id desc limit 20;"
psql_out "baseline_cost_ledger_sample" -c "select \"jobId\",\"jobType\",\"costAmount\",currency,\"billingUnit\",quantity from cost_ledger order by id desc limit 20;"

log "== Auth Probe =="
probe_payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":0}}
JSON
)"
probe_hdr="$EVID/raw/_auth_probe_headers.txt"
probe_resp_hdr="$EVID/raw/auth_probe_headers_out.txt"
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$probe_payload" "$probe_hdr"

# Remove -sS to see errors, add -v
probe_resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  --config "$probe_hdr" \
  -D "$probe_resp_hdr" \
  -d "$probe_payload" || true)"
probe_code="$(echo "$probe_resp" | tail -1 | tr -d probe_body="$(echo "$probe_resp" | sed echo "$probe_body" > "$EVID/raw/auth_probe_body.json"
log "auth_probe_code=${probe_code}"
if [[ "$probe_code" != "200" && "$probe_code" != "201" ]]; then
  log "❌ Auth probe failed. See $EVID/raw/auth_probe_body.json"
  exit 25
fi
log "✅ Auth probe PASS"



log "== Phase B: Real Load Driver (API Create Jobs) =="
CREATE_URL="${BASE_URL}/api/shots/${SHOT_ID}/jobs"
STATUS_URL_BASE="${BASE_URL}/api/jobs"

: > "$EVID/raw/create_responses.jsonl"
: > "$EVID/raw/create_httpcodes.log"
: > "$EVID/raw/status_httpcodes.log"
: > "$EVID/raw/job_ids.txt"
echo "job_id,created_at_ms,terminal_at_ms,latency_ms,final_status" > "$EVID/raw/latencies.csv"
: > "$EVID/raw/status_samples.jsonl"
# NEW: Granular creation time tracking
echo "job_id,created_at_ms" > "$EVID/raw/job_created_at.csv"

start_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"

log "Creating ${LOAD_N} jobs via ${CREATE_URL}"

# generate index list
# generate index list
"${PYTHON_BIN}" -c "for i in range(1, int($LOAD_N) + 1): print(i)" > "$EVID/raw/_load_idx.txt"

create_one () {
  local i="$1"
  local payload
  payload="$(cat <<JSON
{"type":"SHOT_RENDER","payload":{"test_run":true,"complexity":1,"p1_3_run":"${TS}","seq":${i}}}
JSON
)"
  # best-effort: capture response even if http fails
  local resp httpcode
  local hdr="$EVID/raw/_auth_headers_create_${i}.txt"
  gen_headers "POST" "/api/shots/${SHOT_ID}/jobs" "$payload" "$hdr"

  resp="$(curl -sS -w "\n%{http_code}" -X POST "$CREATE_URL" \
    -H "Content-Type: application/json" \
    --config "$hdr" \
    -d "$payload" || true)"
  httpcode="$(echo "$resp" | tail -1 | tr -d   body="$(echo "$resp" | sed 
  echo "$httpcode" >> "$EVID/raw/create_httpcodes.log"
  echo "$body" >> "$EVID/raw/create_responses.jsonl"

  if [[ "$httpcode" != "200" && "$httpcode" != "201" ]]; then
    echo "" # fail
    return 0
  fi

  # extract data.id and initial status
  local job_id
  job_id="$(echo "$body" | "${PYTHON_BIN}" - <<import sys, json
def pick(o, path):
  cur=o
  for k in path:
    if isinstance(cur, dict) and k in cur:
      cur=cur[k]
    else:
      return None
  return cur

try:
  obj=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit

candidates = [
  ["data","id"],
  ["data","job","id"],
  ["job","id"],
  ["id"],
]
for p in candidates:
  v=pick(obj,p)
  if isinstance(v,str) and v.strip():
    print(v.strip()); break
else:
  print("")
PY
)"
  
  # Fallback if python fails (e.g. env issues in xargs)
  if [[ -z "$job_id" ]]; then
     # tolerate whitespace: "data": { "id": "xxx" }
     job_id="$(echo "$body" | sed -n      if [[ -n "$job_id" ]]; then
       echo "Recovered job_id via sed: $job_id" >> "$EVID/raw/extraction_debug.log"
     else
       echo "Failed to extract job_id. Body: $body" >> "$EVID/raw/extraction_errors.log"
       echo "PYTHON_BIN=${PYTHON_BIN}" >> "$EVID/raw/extraction_errors.log"
     fi
  fi
  if [[ -n "$job_id" ]]; then
    local created_at_ms
    created_at_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
    echo "$job_id" >> "$EVID/raw/job_ids.txt"
    echo "${job_id},${created_at_ms}" >> "$EVID/raw/job_created_at.csv"
  fi
  echo ""
}

export -f create_one
export CREATE_URL AUTH_MODE JWT_TOKEN HMAC_KEY_ID HMAC_SECRET HMAC_CLOCK_SKEW_SEC EVID TS PYTHON_BIN BASE_URL SHOT_ID
export -f build_auth_headers_file gen_headers

# run creates in parallel
cat "$EVID/raw/_load_idx.txt" | xargs -P "$LOAD_CONCURRENCY" -n 1 -I{} bash -lc 
# de-dup + sanitize job ids
sort -u "$EVID/raw/job_ids.txt" | sed mv "$EVID/raw/job_ids.unique.txt" "$EVID/raw/job_ids.txt"
created_cnt="$(wc -l < "$EVID/raw/job_ids.txt" | tr -d log "Created jobs (parsed data.id): ${created_cnt}/${LOAD_N}"

if [[ "$created_cnt" -eq 0 ]]; then
  log "❌ Create phase produced 0 job ids. Dumping diagnostics..."
  log "Last 10 httpcodes:"
  tail -n 10 "$EVID/raw/create_httpcodes.log" 2>/dev/null | sed   log "Last 3 responses:"
  tail -n 3 "$EVID/raw/create_responses.jsonl" 2>/dev/null | sed   exit 30
fi

# compute create throughput
end_create_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
dur_ms="$((end_create_ms - start_ms))"
if [[ "$dur_ms" -le 0 ]]; then dur_ms=1; fi
jobs_per_min="$("${PYTHON_BIN}" - <<PY
dur_ms=$dur_ms
created=$created_cnt
print(round(created / (dur_ms/1000.0) * 60.0, 2))
PY
)"
log "Create throughput: ${jobs_per_min} jobs/min"

snapshot_metrics "after_create"

log "== Phase C: Poll Job Status until terminal or timeout =="
deadline_s="$(( $(date +%s) + MAX_WAIT_SEC ))"

# poll loop
# poll loop
# preload created_at map (fs-based for Bash 3.2 compatibility)
mkdir -p "$EVID/raw/map_created_at"
while   [[ "$jid" == "job_id" ]] && continue
  [[ -z "$jid" ]] && continue
  echo "$cts" > "$EVID/raw/map_created_at/$jid"
done < "$EVID/raw/job_created_at.csv"

# track completion via fs (Bash 3.2 compat)
mkdir -p "$EVID/raw/map_done"
success=0
fail=0

while : ; do
  now_s="$(date +%s)"
  if [[ "$now_s" -ge "$deadline_s" ]]; then
    log "⏱️ Poll timeout reached"
    break
  fi

  # pending_this_round=0 # unused actually, just iterating

  while read -r jid; do
    [[ -z "$jid" ]] && continue
    # check done map
    if [[ -f "$EVID/raw/map_done/$jid" ]]; then
      continue
    fi

    # per-job headers file to avoid any future concurrency clobbering
    hdr="$EVID/raw/_auth_headers_get_${jid}.txt"
    gen_headers "GET" "/api/jobs/${jid}" "" "$hdr"

    resp_with_code="$(curl -sS -w "\n%{http_code}" -X GET "${STATUS_URL_BASE}/${jid}" \
      --config "$hdr" || true)"
    httpcode="$(echo "$resp_with_code" | tail -1 | tr -d     resp="$(echo "$resp_with_code" | sed     echo "$resp" >> "$EVID/raw/status_samples.jsonl"
    echo "$httpcode" >> "$EVID/raw/status_httpcodes.log"

    if [[ "$httpcode" != "200" ]]; then
      echo "$resp" > "$EVID/raw/status_last_error_body.json"
      log "❌ Poll GET failed (httpcode=${httpcode}) for job=${jid}. See $EVID/raw/status_last_error_body.json"
      exit 41
    fi

    status="$(echo "$resp" | node -e       const fs = require("fs");
      try {
        const input = fs.readFileSync(0, "utf-8");
        const obj = JSON.parse(input);
        const s = obj?.data?.status || obj?.status || "";
        console.log(s);
      } catch (e) {
        console.log("__JSON_PARSE_ERROR__");
      }
        if [[ "$status" == "__JSON_PARSE_ERROR__" ]]; then
      echo "$resp" > "$EVID/raw/status_last_nonjson_body.txt"
      log "❌ Poll GET returned non-JSON body. See $EVID/raw/status_last_nonjson_body.txt"
      exit 42
    fi
    if [[ -z "$status" ]]; then
      # status missing is a schema/API bug: fail fast with evidence
      echo "$resp" > "$EVID/raw/status_last_missing_status.json"
      log "❌ Poll GET JSON missing status field. See $EVID/raw/status_last_missing_status.json"
      exit 43
    fi

    if is_terminal "$status"; then
      term_ms="$("${PYTHON_BIN}" - <<import time; print(int(time.time()*1000))
PY
)"
      # LATENCY CALC: use granular created_at info (fs lookup)
      if [[ -f "$EVID/raw/map_created_at/$jid" ]]; then
        created_at_ms="$(cat "$EVID/raw/map_created_at/$jid")"
      else
        created_at_ms="$start_ms"
      fi
      
      latency_ms="$((term_ms - created_at_ms))"
      
      echo "${jid},${created_at_ms},${term_ms},${latency_ms},${status}" >> "$EVID/raw/latencies.csv"
      
      # mark done
      touch "$EVID/raw/map_done/$jid"
      if [[ "$status" == "SUCCEEDED" || "$status" == "COMPLETED" ]]; then
        success=$((success+1))
      else
        fail=$((fail+1))
      fi
    fi
  done < "$EVID/raw/job_ids.txt"

  snapshot_metrics "poll"
  
  # count done files in map_done directory
  done_cnt="$(find "$EVID/raw/map_done" -type f 2>/dev/null | wc -l | tr -d   if [[ "$done_cnt" -ge "$created_cnt" && "$created_cnt" -gt 0 ]]; then
    log "All parsed jobs reached terminal: ${done_cnt}/${created_cnt}"
    break
  fi

  sleep "$POLL_INTERVAL_SEC"
done

snapshot_metrics "final"

log "== Phase D: Hard Assertions =="
# A1: ledger duplicates = 0 (scoped to this run only, robust via psql \copy)
ledger_dups_last="$(
  psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A <<SQL # $gate$
\\set QUIET 1
CREATE TEMP TABLE run_job_ids(job_id text) ON COMMIT DROP;
\\copy run_job_ids(job_id) FROM SELECT count(*)
FROM (
  SELECT cl."jobId", cl."jobType"
  FROM cost_ledger cl
  JOIN run_job_ids rj ON rj.job_id = cl."jobId"::text
  GROUP BY cl."jobId", cl."jobType"
  HAVING count(*) > 1
) sub;
SQL
)"
ledger_dups_last="$(echo "$ledger_dups_last" | tr -d if [[ -z "$ledger_dups_last" ]]; then ledger_dups_last="0"; fi

if [[ "$ledger_dups_last" != "0" ]]; then
  echo "❌ P1-3 FAIL: cost_ledger duplicates detected (ledger_dups=${ledger_dups_last})"
  exit 10
fi

# A2: success rate
if [[ "$created_cnt" -gt 0 ]]; then
  success_rate="$("${PYTHON_BIN}" - <<PY
s=$success
c=$created_cnt
print(round(s/c, 4))
PY
)"
else
  success_rate="0"
fi
log "success=${success}, fail=${fail}, created_cnt=${created_cnt}, success_rate=${success_rate}"
"${PYTHON_BIN}" - <<PY
sr=float("$success_rate")
min_sr=float("$MIN_SUCCESS_RATE")
import sys
if sr + 1e-12 < min_sr:
  print(f"❌ P1-3 FAIL: success_rate {sr} < MIN_SUCCESS_RATE {min_sr}")
  sys.exit(11)
print("✅ success_rate PASS")
PY

# A3: pending_end threshold
pending_end="$(tail -1 "$EVID/metrics.csv" | awk -Fif [[ -z "$pending_end" ]]; then pending_end="0"; fi

log "pending_end=${pending_end}, MAX_PENDING_END=${MAX_PENDING_END}"
"${PYTHON_BIN}" - <<PY
pe=int("$pending_end")
mx=int("$MAX_PENDING_END")
import sys
if pe > mx:
  print(f"❌ P1-3 FAIL: pending_end {pe} > MAX_PENDING_END {mx}")
  sys.exit(12)
print("✅ pending_end PASS")
PY

# A4: latency p95
p95_ms="$("${PYTHON_BIN}" - <<import csv, statistics, sys
path=sys.argv[1]
vals=[]
try:
  with open(path,newline=    r=csv.DictReader(f)
    for row in r:
      try:
        vals.append(int(row["latency_ms"]))
      except Exception:
        pass
except Exception:
  pass
if not vals:
  print("0")
  sys.exit(0)
vals.sort()
k=int((len(vals)-1)*0.95)
print(vals[k])
PY
"$EVID/raw/latencies.csv")"

log "p95_ms=${p95_ms}, MAX_P95_SEC=${MAX_P95_SEC}"
"${PYTHON_BIN}" - <<PY
p95_ms=int("$p95_ms")
mx_s=int("$MAX_P95_SEC")
import sys
if p95_ms > mx_s*1000:
  print(f"❌ P1-3 FAIL: p95_ms {p95_ms} > MAX_P95_SEC {mx_s}s")
  sys.exit(13)
print("✅ p95 latency PASS")
PY

cat > "${EVID}/FINAL_REPORT.md" <<EOF2
# P1-3 Performance & Stress Gate - FINAL REPORT (Real Load Driver)

- Timestamp: ${TS}
- DB: ${DB}
- BASE_URL: ${BASE_URL}
- SHOT_ID: ${SHOT_ID}
- JOB_TABLE: ${JOB_TABLE}
- STATUS_COL: ${STATUS_COL}

## Load Config
- LOAD_N: ${LOAD_N}
- LOAD_CONCURRENCY: ${LOAD_CONCURRENCY}
- MAX_WAIT_SEC: ${MAX_WAIT_SEC}
- POLL_INTERVAL_SEC: ${POLL_INTERVAL_SEC}

## Results
- created_cnt: ${created_cnt}/${LOAD_N}
- success: ${success}
- fail: ${fail}
- success_rate: ${success_rate}
- p95_ms: ${p95_ms}

## Hard Assertions
- cost_ledger duplicates == 0 ✅
- success_rate >= ${MIN_SUCCESS_RATE} ✅
- pending_end <= ${MAX_PENDING_END} ✅
- p95 latency <= ${MAX_P95_SEC}s ✅

## Evidence
- metrics.csv (DB-side time series)
- raw/create_responses.jsonl
- raw/job_ids.txt
- raw/status_samples.jsonl
- raw/latencies.csv
- FINAL_REPORT.md
- sql_outputs/*
EOF2

log "✅ P1-3 Gate PASS. Evidence: ${EVID}"
