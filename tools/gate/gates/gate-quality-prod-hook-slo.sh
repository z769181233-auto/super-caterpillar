#!/bin/bash
IFS=$'
	'
set -e
# P14-1 Quality Rework SLO & Rate Limit Gate
# 验证：Org 维度并发护栏 (RATE_LIMIT_BLOCKED)、标准化 TraceId、Ops 指标扩展

function log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
function log_success() { echo -e "\033[0;32m[PASS]\033[0m $1"; }
function log_fail() { echo -e "\033[0;31m[FAIL]\033[0m $1"; }
function log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

function wait_quality_score() {
  local SHOT_ID="$1"
  local EXPECTED_STOP_REASON="${2:-}"
  local DEADLINE=$(( $(date +%s) + 60 ))

  while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    RESULT=$(psql "$DATABASE_URL" -t -A -c "
      SELECT verdict || ':' || COALESCE(signals->>'stopReason','')
      FROM quality_scores 
      WHERE \"shotId\" = '${SHOT_ID}' 
      ORDER BY \"createdAt\" DESC LIMIT 1;
    " | tr -d '[:space:]')

    if [ -n "$RESULT" ]; then
      local V_VERDICT=$(echo "$RESULT" | cut -d: -f1)
      local V_STOP=$(echo "$RESULT" | cut -d: -f2)
      
      if [ -n "$EXPECTED_STOP_REASON" ] && [ "$V_STOP" != "$EXPECTED_STOP_REASON" ]; then
        echo "[GATE] quality_scores found stopReason=$V_STOP (expect $EXPECTED_STOP_REASON), keep waiting..."
      else
        echo "[GATE] quality_scores OK verdict=$V_VERDICT stopReason=$V_STOP"
        return 0
      fi
    fi
    sleep 2
  done

  echo "[GATE] timeout waiting quality_scores for shot=$SHOT_ID"
  return 1
}

# Source local .env if exists
if [ -f .env ]; then
  log_info "Sourcing .env..."
  export $(grep -v '^#' .env | xargs)
fi

export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:password@127.0.0.1:5432/scu"}
export GATE_MODE=1
export QUALITY_HOOK_SYNC_FOR_GATE=1
export REWORK_MAX_CONCURRENCY_PER_ORG=2

export GATE_NAME="quality_prod_hook_slo"
export TS=$(date +%Y%m%d%H%M%S)
export TRACE_ID="slo_$TS"
export API_URL=${API_URL:-"http://localhost:3000"}
export EVIDENCE_ROOT="docs/_evidence/quality_prod_hook_slo_$TS"

mkdir -p "$EVIDENCE_ROOT"
export LOG_FILE="$EVIDENCE_ROOT/GATE_RUN.log"
exec > >(tee -i "$LOG_FILE") 2>&1

log_info "Starting P14-1 Rework SLO Gate (Concurrency Cap = $REWORK_MAX_CONCURRENCY_PER_ORG)..."

# --- Auth Seed ---
source tools/gate/lib/gate_auth_seed.sh

# --- HMAC Header Generator ---
generate_headers() {
  local method="$1"
  local req_path="$2"
  local body="${3:-}"
  env API_SECRET="$API_SECRET" VALID_API_KEY_ID="$VALID_API_KEY_ID" REQ_BODY="$body" \
    node - <<'NODESCRIPT'
const crypto = require("crypto");
const secret = process.env.API_SECRET || "";
const apiKey = process.env.VALID_API_KEY_ID || "";
const body = process.env.REQ_BODY || "";
const timestamp = Math.floor(Date.now() / 1000);
const nonce = "nonce_" + timestamp + "_" + Math.random().toString(36).slice(2);
const contentSha256 = body ? crypto.createHash("sha256").update(body, "utf8").digest("hex") : "UNSIGNED";
const payload = apiKey + nonce + timestamp + body;
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
process.stdout.write("X-Api-Key: " + apiKey + "\n");
process.stdout.write("X-Nonce: " + nonce + "\n");
process.stdout.write("X-Timestamp: " + timestamp + "\n");
process.stdout.write("X-Content-SHA256: " + contentSha256 + "\n");
process.stdout.write("X-Signature: " + signature + "\n");
NODESCRIPT
}

curl_hmac_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out_file="${4:-/tmp/gate_resp.json}"
  local headers="$(generate_headers "$method" "$path" "$body")"
  local curl_h=()
  while IFS= read -r line; do [ -n "$line" ] && curl_h+=(-H "$line"); done <<< "$headers"
  local http_code="$(curl -sS -o "$out_file" -w "%{http_code}" "${curl_h[@]}" -H "Content-Type: application/json" -X "$method" "$API_URL$path" -d "$body" || true)"
  echo "$http_code"
}

# 0. 准备环境
log_info "Step 0: Cleaning and Seeding environment..."
psql "$DATABASE_URL" -c "DELETE FROM billing_events WHERE \"org_id\" = 'slo-org'"
psql "$DATABASE_URL" -c "DELETE FROM cost_ledgers WHERE \"orgId\" = 'slo-org'"
psql "$DATABASE_URL" -c "DELETE FROM shot_jobs WHERE \"organizationId\" = 'slo-org'"
psql "$DATABASE_URL" -c "DELETE FROM projects WHERE \"organizationId\" = 'slo-org'"
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", credits) VALUES ('slo-org', 'SLO Org', 'gate-user', now(), now(), 1000000) ON CONFLICT(id) DO UPDATE SET credits = 1000000"

PROJECT_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), 'P14-1 SLO Project $TRACE_ID', 'gate-user', 'slo-org', 'in_progress', now(), now()) RETURNING id" | head -n 1)
psql "$DATABASE_URL" -t -A -c "UPDATE projects SET \"settingsJson\" = '{\"autoReworkEnabled\": true}' WHERE id = '$PROJECT_ID'"
SEASON_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$PROJECT_ID', 1, 'Season', now(), now()) RETURNING id" | head -n 1)
EPISODE_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES (gen_random_uuid(), '$SEASON_ID', '$PROJECT_ID', 1, 'Episode') RETURNING id" | head -n 1)
SCENE_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, created_at, updated_at, summary) VALUES (gen_random_uuid(), '$EPISODE_ID', '$PROJECT_ID', 1, now(), now(), 'SLO Gate Summary') RETURNING id" | head -n 1)
ANCHOR_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO identity_anchors (id, project_id, character_id, reference_asset_id, identity_hash, created_at, updated_at) VALUES (gen_random_uuid(), '$PROJECT_ID', 'char-1', 'asset-0', 'hash-1', now(), now()) RETURNING id" | head -n 1)

# --- Case F: Rate Limit Guard ---
log_info "CASE F: Triggering 3 sequential FAILs to test concurrency cap (Cap=2)"

for i in 1 2 3; do
  log_info "Triggering FAIL $i..."
  SHOT_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", index, type) VALUES (gen_random_uuid(), '$SCENE_ID', 'slo-org', $i, 'SHOT_RENDER') RETURNING id" | head -n 1)
  psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, created_at) VALUES (gen_random_uuid(), '$SHOT_ID', 'char-1', '$ANCHOR_ID', 'asset-$i', 0.5, 'FAIL', now())"
  psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"ownerId\", \"ownerType\", \"shotId\", \"projectId\", \"createdAt\") VALUES (gen_random_uuid(), 'VIDEO', 'slo-$i.mp4', '$SHOT_ID', 'SHOT', '$SHOT_ID', '$PROJECT_ID', now())"
  JOB_ID=$(psql "$DATABASE_URL" -t -A -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"traceId\", \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid(), '$SHOT_ID', '$PROJECT_ID', 'slo-org', 'SHOT_RENDER', 'RUNNING', 1, 'slo_trace_$i', now(), now()) RETURNING id" | head -n 1)
  
  BODY='{"status": "SUCCEEDED", "result": {}}'
  curl_hmac_json "POST" "/api/jobs/$JOB_ID/report" "$BODY" > /dev/null
  
  if [ "$i" -le 2 ]; then
    log_info "Asserting rework job $i created..."
    wait_quality_score "$SHOT_ID" ""
    REWORK_JOB_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"shotId\" = '$SHOT_ID' AND \"traceId\" LIKE '%:rework:%'")
    if [ "$REWORK_JOB_COUNT" -eq 1 ]; then
      log_success "FAIL $i: Rework job created with standardized traceId."
    else
      log_fail "FAIL $i: Rework job NOT created or traceId NOT standardized."; exit 1
    fi
  else
    log_info "Asserting FAIL 3 is RATE_LIMIT_BLOCKED..."
    if wait_quality_score "$SHOT_ID" "RATE_LIMIT_BLOCKED"; then
      log_success "FAIL 3: Successfully blocked by RATE_LIMIT_BLOCKED."
    else
      log_fail "FAIL 3: NOT blocked by RATE_LIMIT_BLOCKED."; exit 1
    fi
    REWORK_JOB_COUNT_3=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"shotId\" = '$SHOT_ID' AND \"traceId\" LIKE '%:rework:%'")
    if [ "$REWORK_JOB_COUNT_3" -eq 0 ]; then
      log_success "FAIL 3: No rework job created as expected."
    else
      log_fail "FAIL 3: Rework job created despite rate limit!"; exit 1
    fi
  fi
done

# --- Case G: Metrics ---
log_info "CASE G: Verifying Ops Metrics Extension"
METRICS_JSON="$EVIDENCE_ROOT/ops_metrics_snapshot.json"
curl_hmac_json "GET" "/api/ops/metrics" "" "$METRICS_JSON" > /dev/null
BLOCKED_RL=$(jq -r '.rework_stats_1h.blocked_by_rate_limit_1h' "$METRICS_JSON")

if [ "$BLOCKED_RL" -ge 1 ]; then
  log_success "Case G Passed: rework_stats_1h.blocked_by_rate_limit_1h = $BLOCKED_RL"
else
  log_fail "Case G Failed: blocked_by_rate_limit_1h not found or 0. Value: $BLOCKED_RL"; cat "$METRICS_JSON"; exit 1
fi

# 6. Archive Evidence
log_info "Step 6: Archiving evidence..."
psql "$DATABASE_URL" -c "COPY (SELECT id, \"shotId\", verdict, signals FROM quality_scores WHERE \"shotId\" IN (SELECT id FROM shots WHERE \"organizationId\"='slo-org')) TO STDOUT WITH CSV HEADER" > "$EVIDENCE_ROOT/quality_scores_dump.csv"
psql "$DATABASE_URL" -c "COPY (SELECT id, \"shotId\", \"organizationId\", \"traceId\", status FROM shot_jobs WHERE \"organizationId\"='slo-org') TO STDOUT WITH CSV HEADER" > "$EVIDENCE_ROOT/rework_jobs_dump.csv"

cd "$EVIDENCE_ROOT"
shasum -a 256 * > SHA256SUMS.txt
echo "Evidence stored in $EVIDENCE_ROOT"

log_success "P14-1 Rework SLO Gate DOUBLE PASS (0 Risk)!"
