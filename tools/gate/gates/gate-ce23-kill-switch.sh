#!/bin/bash
# gate-ce23-kill-switch.sh
# P16-2.0: Verify CE23 Kill Switch (ENV Priority)
set -e

GATE_ID="ce23_kill_switch_$(date +%Y%m%d%H%M%S)"
EVIDENCE_DIR="docs/_evidence/$GATE_ID"
mkdir -p "$EVIDENCE_DIR"
exec > >(tee "$EVIDENCE_DIR/GATE_RUN.log") 2>&1

API_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"

log() { echo "[KILL-SWITCH] $(date +%H:%M:%S) $1"; }

# 1. Start API with Kill Switch ENV
log "Starting API with CE23_REAL_FORCE_DISABLE=1..."
export DATABASE_URL="$DATABASE_URL"
export GATE_MODE=1
export CE23_REAL_FORCE_DISABLE=1
# Ensure clean state
pkill -f "nest start" || true
( cd apps/api && pnpm dev ) > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
trap "kill $API_PID || true" EXIT

log "Waiting for API..."
until curl -s "$API_URL/api/health" > /dev/null; do sleep 1; done
log "API Ready!"

# 1.5 Auth
source tools/gate/lib/gate_auth_seed.sh

# 2. Setup Project with Real Enabled
log "Setting Project ce23RealEnabled=true..."
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\"='{\"ce23RealEnabled\": true, \"ce23RealShadowEnabled\": true}' WHERE id='$PROJ_ID'"

# 3. Create Job/Shot
TS=$(date +%s)
SHOT_ID="shot_ks_$TS"
JOB_ID="job_ks_$TS"
ASSET_ID="asset_ks_$TS"
MOCK_DIR="gate_ks_$TS"
mkdir -p ".data/storage/$MOCK_DIR"

# Reuse anchor logic (dummy)
psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_ID', '$ORG_ID', '$SCENE_ID', 1, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$ASSET_ID', 'IMAGE', '$MOCK_DIR/img.png', '$SHOT_ID', '$PROJ_ID', '$SHOT_ID', 'SHOT', now())"

# Stub Identity Score
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_ID', 'char_calib', 'anchor_id', '$ASSET_ID', 0.9, 'PASS', now())"

# Report Job
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_ID', '$SHOT_ID', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"

# Helper
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
const payload = apiKey + nonce + timestamp + body;
const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
process.stdout.write("x-api-key: " + apiKey + "\n");
process.stdout.write("x-nonce: " + nonce + "\n");
process.stdout.write("x-timestamp: " + timestamp + "\n");
process.stdout.write("x-signature: " + signature + "\n");
NODESCRIPT
}

curl_hmac_post() {
  local path="$1"
  local body="$2"
  local out_file="$3"
  local headers
  headers="$(generate_headers "POST" "$path" "$body")"
  local curl_h=()
  while IFS= read -r line; do [ -n "$line" ] && curl_h+=(-H "$line"); done <<< "$headers"
  curl -sS -o "$out_file" -w "%{http_code}" "${curl_h[@]}" -H "Content-Type: application/json" -X "POST" "$API_URL$path" -d "$body"
}

curl_hmac_post "/api/jobs/$JOB_ID/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp.json"

# 4. Verify Signals
sleep 2
SIGNALS=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_ID'")
log "Signals: $SIGNALS"

# Assertions
if [[ "$SIGNALS" != *"ce23_kill_switch\":true"* ]]; then
  log "❌ Failed: ce23_kill_switch not true"
  exit 1
fi
if [[ "$SIGNALS" == *"identity_score_real_ppv64"* ]]; then
  log "❌ Failed: identity_score_real_ppv64 should NOT exist"
  exit 1
fi

log "✅ Kill Switch Verified!"
