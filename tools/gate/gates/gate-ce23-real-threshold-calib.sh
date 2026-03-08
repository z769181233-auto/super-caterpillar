#!/bin/bash
IFS=$'
	'
# gate-ce23-real-threshold-calib.sh
# P16-1: Calibration & Guardrail Verification (Real Assets)
# Usage: bash tools/gate/gates/gate-ce23-real-threshold-calib.sh

set -e

# --- CONFIG ---
GATE_ID="ce23_real_threshold_calib_$(date +%Y%m%d%H%M%S)"
EVIDENCE_DIR="docs/_evidence/$GATE_ID"
mkdir -p "$EVIDENCE_DIR"
exec > >(tee "$EVIDENCE_DIR/GATE_RUN.log") 2>&1

API_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu"

log() { echo "[CALIB] $(date +%H:%M:%S) $1"; }
log "Starting P16-1 Threshold Calibration Gate..."
log "Evidence Dir: $EVIDENCE_DIR"

# --- HELPER: CURL HMAC (Node.js Version) ---
# Robust header generation to avoid openssl version/format issues
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
  
  curl -sS -o "$out_file" -w "%{http_code}" \
    "${curl_h[@]}" -H "Content-Type: application/json" \
    -X "POST" "$API_URL$path" -d "$body"
}

curl_hmac_get() {
  local path="$1"
  local out_file="$2"
  local headers
  headers="$(generate_headers "GET" "$path" "")"
  local curl_h=()
  while IFS= read -r line; do [ -n "$line" ] && curl_h+=(-H "$line"); done <<< "$headers"
  
  curl -sS -o "$out_file" -w "%{http_code}" \
    "${curl_h[@]}" -H "Content-Type: application/json" \
    "$API_URL$path"
}


# Wait for quality score verdict & dump signals
wait_quality_score() {
    local shotId="$1"
    local expectVerdict="$2"
    local max_retries=20
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        local verdict=$(psql "$DATABASE_URL" -t -A -c "SELECT verdict FROM quality_scores WHERE \"shotId\"='$shotId' ORDER BY \"createdAt\" DESC LIMIT 1")
        if [ "$verdict" != "" ]; then
             echo "$verdict"
             return
        fi
        sleep 1
        retry=$((retry+1))
    done
    echo "TIMEOUT"
}

# --- SETUP ---

# 1. Start API (Background)
log "Starting API..."
export DATABASE_URL="$DATABASE_URL"
export GATE_MODE=1
export QUALITY_HOOK_SYNC_FOR_GATE=1
# Ensure clean state
pkill -f "nest start" || true
( cd apps/api && pnpm dev ) > "$EVIDENCE_DIR/api.log" 2>&1 &
API_PID=$!
trap "kill $API_PID || true" EXIT

log "Waiting for API..."
until curl -s "$API_URL/api/health" > /dev/null; do sleep 1; done
log "API Ready!"

# 1.5 Auth Setup (Source Seed Script)
# This exports VALID_API_KEY_ID and API_SECRET
source tools/gate/lib/gate_auth_seed.sh

# 2. Reuse Seeded Data (from gate_auth_seed.sh)
# We use the exported ORG_ID, PROJ_ID, SCENE_ID to ensure API Key permissions match.
log "Reusing Seeded Org: $ORG_ID, Proj: $PROJ_ID"

TS=$(date +%s)

# Storage Setup (Ensure API can read assets)
STORAGE_ROOT=".data/storage"
MOCK_DIR="gate_calib_$TS"
FULL_MOCK_DIR="$STORAGE_ROOT/$MOCK_DIR"
mkdir -p "$FULL_MOCK_DIR"

# Initial Settings
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\"='{\"ce23RealEnabled\": true, \"ce23RealGuardrailEnabled\": true, \"ce23RealThreshold\": 0.85}' WHERE id='$PROJ_ID'"

# Audio/Video Placeholders (for physical check pass) - Reuse scene
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_tts_$TS', 'AUDIO_TTS', '$MOCK_DIR/tts.wav', '$PROJ_ID', '$SCENE_ID', 'SCENE', now()) ON CONFLICT DO NOTHING"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_bgm_$TS', 'AUDIO_BGM', '$MOCK_DIR/bgm.wav', '$PROJ_ID', '$SCENE_ID', 'SCENE', now()) ON CONFLICT DO NOTHING"

# Anchor Setup
ANCHOR_ID="anchor_calib_$TS"
REF_ASSET_ID="asset_ref_$TS"
# Use sharp to generate random noise 64x64 PNG (to ensure non-zero variance for PPV-64)
# Execute inside apps/api to find sharp
( cd apps/api && node -e "const fs=require('fs'); const sharp=require('sharp'); (async()=>{ 
  // Anchor: Seeded noise
  const w=64, h=64; const buf=Buffer.alloc(w*h*3);
  for(let i=0;i<buf.length;i++) buf[i]=Math.floor(Math.random()*255);
  await sharp(buf,{raw:{width:w,height:h,channels:3}}).png().toFile('../../$FULL_MOCK_DIR/anchor.png'); 
})();" )
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$REF_ASSET_ID', 'IMAGE', '$MOCK_DIR/anchor.png', '$PROJ_ID', '$SCENE_ID', 'SCENE', now())"
psql "$DATABASE_URL" -c "INSERT INTO identity_anchors (id, project_id, character_id, reference_asset_id, identity_hash, \"created_at\", \"updated_at\") VALUES ('$ANCHOR_ID', '$PROJ_ID', 'char_calib', '$REF_ASSET_ID', 'dummy', now(), now())"


# --- CASE T1: Identical (Expect PASS) ---
log ">>> CASE T1: Identical <<<"
SHOT_T1="shot_t1_$TS"
JOB_T1="job_t1_$TS"
ASSET_T1="asset_t1_$TS"
# Same as anchor (blue)
cp "$FULL_MOCK_DIR/anchor.png" "$FULL_MOCK_DIR/t1.png"

psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_T1', '$ORG_ID', '$SCENE_ID', 1, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$ASSET_T1', 'IMAGE', '$MOCK_DIR/t1.png', '$SHOT_T1', '$PROJ_ID', '$SHOT_T1', 'SHOT', now())"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('vid_t1_$TS', 'VIDEO', '$MOCK_DIR/vid.mp4', '$SHOT_T1', '$PROJ_ID', '$SHOT_T1', 'SHOT', now())"

# Stub Identity Score (Legacy=0.9 PASS)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_T1', 'char_calib', '$ANCHOR_ID', '$ASSET_T1', 0.9, 'PASS', now())"

psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_T1', '$SHOT_T1', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"
curl_hmac_post "/api/jobs/$JOB_T1/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp_t1.json"

VERDICT_T1=$(wait_quality_score "$SHOT_T1" "PASS")
log "T1 Verdict: $VERDICT_T1"
if [ "$VERDICT_T1" != "PASS" ]; then 
    log "❌ T1 Failed"; 
    SIGNALS_T1=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_T1'")
    log "T1 Signals: $SIGNALS_T1"
    tail -n 20 "$EVIDENCE_DIR/api.log"
    exit 1; 
fi


# --- CASE T2: Perturb (Expect FAIL but BLOCK REWORK) ---
log ">>> CASE T2: Perturb (Guardrail) <<<"
SHOT_T2="shot_t2_$TS"
JOB_T2="job_t2_$TS"
ASSET_T2="asset_t2_$TS"
# Perturb: Slightly different blue.
# Set Threshold = 0.99 (Aggressive) to catch high-score perturbation
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\"='{\"ce23RealEnabled\": true, \"ce23RealGuardrailEnabled\": true, \"ce23RealThreshold\": 0.99}' WHERE id='$PROJ_ID'"

# Use Slightly modified image (Anchor + small noise)
# We need to load anchor and modify it. Hard to do in one-liner.
# Simplified: Create Anchor deterministically, then modify.
# Re-run Anchor generation (deterministic with seed) or Read Anchor file.
# Easier: Just generate a new 'Perturbed' image that is 'close' to Random.
# Actually, for T2 (Guardrail), we want: Real < 0.99 AND Real >= 0.96.
# PPV-64 is sensitive.
# Strategy: Copy Anchor, modify a few pixels.
( cd apps/api && node -e "const fs=require('fs'); const sharp=require('sharp'); (async()=>{ 
  // Read anchor
  const img = await sharp('../../$FULL_MOCK_DIR/anchor.png').raw().toBuffer({resolveWithObject:true});
  const {data, info} = img;
  // Modify ~8.3% of pixels (every 12th) to land in [0.96, 0.99)
  for(let i=0;i<data.length;i+=12) data[i] = (data[i]+100)%255; 
  await sharp(data, {raw:{width:info.width,height:info.height,channels:info.channels}}).png().toFile('../../$FULL_MOCK_DIR/t2.png');
})();" )

psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_T2', '$ORG_ID', '$SCENE_ID', 2, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$ASSET_T2', 'IMAGE', '$MOCK_DIR/t2.png', '$SHOT_T2', '$PROJ_ID', '$SHOT_T2', 'SHOT', now())"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('vid_t2_$TS', 'VIDEO', '$MOCK_DIR/vid.mp4', '$SHOT_T2', '$PROJ_ID', '$SHOT_T2', 'SHOT', now())"

# Stub Identity Score (Legacy=0.9 PASS - Important for Guardrail pre-condition)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_T2', 'char_calib', '$ANCHOR_ID', '$ASSET_T2', 0.9, 'PASS', now())"

psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_T2', '$SHOT_T2', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"
curl_hmac_post "/api/jobs/$JOB_T2/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp_t2.json"

VERDICT_T2=$(wait_quality_score "$SHOT_T2" "FAIL")
log "T2 Verdict: $VERDICT_T2" # Should be FAIL
if [ "$VERDICT_T2" != "FAIL" ]; then 
    log "❌ T2 Failed: Verdict should be FAIL (but blocked rework)"; 
    SIGNALS_T2=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_T2'")
    log "T2 Signals: $SIGNALS_T2"
    log "--- API LOG TAIL ---"
    tail -n 50 "$EVIDENCE_DIR/api.log"
    exit 1; 
fi

# CHECK GUARDRAIL
STOP_REASON=$(psql "$DATABASE_URL" -t -A -c "SELECT signals->>'stopReason' FROM quality_scores WHERE \"shotId\"='$SHOT_T2'")
VERDICT_EFF=$(psql "$DATABASE_URL" -t -A -c "SELECT signals->>'verdict_effective' FROM quality_scores WHERE \"shotId\"='$SHOT_T2'")

log "T2 StopReason: $STOP_REASON"
log "T2 VerdictEff: $VERDICT_EFF"

if [ "$STOP_REASON" != "GUARDRAIL_BLOCKED_REWORK" ]; then 
    log "❌ T2 Fail: StopReason mismatch"; 
    SIGNALS_T2=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_T2'")
    log "T2 Signals: $SIGNALS_T2"
    exit 1; 
fi
if [ "$VERDICT_EFF" != "PASS_FOR_PROD" ]; then log "❌ T2 Fail: VerdictEff mismatch"; exit 1; fi

# CHECK NO REWORK JOB
REWORK_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM shot_jobs WHERE \"shotId\"='$SHOT_T2'")
if [ "$REWORK_COUNT" -ne "1" ]; then log "❌ T2 Fail: Rework job found ($REWORK_COUNT)"; exit 1; fi


# --- CASE T3: Different (Expect Rework) ---
log ">>> CASE T3: Different <<<"
SHOT_T3="shot_t3_$TS"
JOB_T3="job_t3_$TS"
ASSET_T3="asset_t3_$TS"
# Different: Completely new random noise
( cd apps/api && node -e "const fs=require('fs'); const sharp=require('sharp'); (async()=>{ 
  const w=64, h=64; const buf=Buffer.alloc(w*h*3);
  for(let i=0;i<buf.length;i++) buf[i]=Math.floor(Math.random()*255);
  await sharp(buf,{raw:{width:w,height:h,channels:3}}).png().toFile('../../$FULL_MOCK_DIR/t3.png');
})();" )

psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_T3', '$ORG_ID', '$SCENE_ID', 3, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$ASSET_T3', 'IMAGE', '$MOCK_DIR/t3.png', '$SHOT_T3', '$PROJ_ID', '$SHOT_T3', 'SHOT', now())"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('vid_t3_$TS', 'VIDEO', '$MOCK_DIR/vid.mp4', '$SHOT_T3', '$PROJ_ID', '$SHOT_T3', 'SHOT', now())"

# Stub Identity Score (Legacy=0.9 PASS)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_T3', 'char_calib', '$ANCHOR_ID', '$ASSET_T3', 0.9, 'PASS', now())"

psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_T3', '$SHOT_T3', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"
curl_hmac_post "/api/jobs/$JOB_T3/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp_t3.json"

VERDICT_T3=$(wait_quality_score "$SHOT_T3" "FAIL")
log "T3 Verdict: $VERDICT_T3" # FAIL

# CHECK REWORK TRIGGERED (Assuming no Credits block, Organization has 1000)
# Wait a bit for async rework
sleep 2
REWORK_COUNT_T3=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM shot_jobs WHERE \"shotId\"='$SHOT_T3'")
log "T3 Job Count: $REWORK_COUNT_T3"
if [ "$REWORK_COUNT_T3" -lt "2" ]; then 
    # Might be budget blocked? Check logs or signals
    SIGNALS_T3=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_T3'")
    log "T3 Signals: $SIGNALS_T3"
    # Actually, we might have budget guard blocked if billing service check fails.
    # But Organization credits=1000. It should pass.
    # Note: Gate mode sets ReferenceSheet=gate-mock-ref-id, billing should be bypassed/mocked?
    # Actually P13-3 says "Real Credits Check" is HARD.
    # Organization credits inserted above. Should be fine.
    log "❌ T3 Fail: Rework not triggered"; exit 1; 
fi


# --- OPS METRICS CHECK ---
log "DEBUG: Checking DB directly via SQL..."
psql "$DATABASE_URL" -c "SELECT \"createdAt\", NOW() FROM quality_scores WHERE \"shotId\"='$SHOT_T2'"
psql "$DATABASE_URL" -c "SELECT count(*) FROM quality_scores WHERE \"createdAt\" >= (NOW() AT TIME ZONE 'UTC') - interval '1 hour' AND (signals->>'stopReason') = 'GUARDRAIL_BLOCKED_REWORK'"
HTTP_CODE=$(curl_hmac_get "/api/ops/metrics" "$EVIDENCE_DIR/ops_metrics_snapshot.json")

if [ "$HTTP_CODE" != "200" ]; then 
    log "❌ Ops Metric Fail: HTTP $HTTP_CODE"
    cat "$EVIDENCE_DIR/ops_metrics_snapshot.json"
    exit 1
fi

GUARDRAIL_COUNT=$(jq -r '.rework_stats_1h.ce23_guardrail_blocked_1h // 0' "$EVIDENCE_DIR/ops_metrics_snapshot.json")
MARGINAL_COUNT=$(jq -r '.rework_stats_1h.ce23_real_marginal_fail_1h // 0' "$EVIDENCE_DIR/ops_metrics_snapshot.json")

log "Ops Guardrail Count: $GUARDRAIL_COUNT"
log "Ops Marginal Count: $MARGINAL_COUNT"

if [ "$GUARDRAIL_COUNT" -lt 1 ]; then log "❌ Ops Fail: Guardrail count < 1"; exit 1; fi
if [ "$MARGINAL_COUNT" -lt 1 ]; then log "❌ Ops Fail: Marginal count < 1"; exit 1; fi


# --- FINAL DUMP ---
psql "$DATABASE_URL" -c "\copy (SELECT * FROM quality_scores ORDER BY \"createdAt\" DESC) TO '$EVIDENCE_DIR/quality_scores_dump.csv' WITH CSV HEADER"
find "$EVIDENCE_DIR" -type f -print0 | xargs -0 sha256sum > "$EVIDENCE_DIR/SHA256SUMS.txt"

log "✅ P16-1 Calibration Passed!"
exit 0
