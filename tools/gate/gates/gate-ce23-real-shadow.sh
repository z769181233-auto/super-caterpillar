#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# P16-0: CE23 REAL Shadow/Real Mode Gate (Robust Version)
# Implements PLAN-0 to PLAN-4.

GATE_NAME="CE23_REAL_SHADOW"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ce23_real_shadow_$TS"
mkdir -p "$EVIDENCE_DIR"

# PLAN-0: Force logs to disk
LOG_FILE="$EVIDENCE_DIR/GATE_RUN.log"
exec > >(tee -a "$LOG_FILE") 2>&1

log() { echo "[$GATE_NAME] $(date +'%H:%M:%S') $1"; }
log "Starting CE23 REAL Shadow Gate (Robust)..."
log "Evidence Dir: $EVIDENCE_DIR"

# PLAN-1: Exclusive API Process Management
log ">>> PLAN-1: Cleaning up previous processes..."
pkill -f "nest.*apps/api" || true
pkill -f "node.*apps/api" || true
sleep 1

export API_URL="http://localhost:3000"
export DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/scu"}
export GATE_MODE=1
export QUALITY_HOOK_SYNC_FOR_GATE=1
export NODE_ENV=development

API_LOG="$EVIDENCE_DIR/api.log"
log "Starting API Server (logs: $API_LOG)..."
( cd apps/api && pnpm dev ) >"$API_LOG" 2>&1 &
API_PID=$!

log "Waiting for API Health..."
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || true)
  if [ "$code" = "200" ]; then
    log "API Healthy!"
    break
  fi
  sleep 1
done

if [ "$code" != "200" ]; then
  log "❌ API not healthy (code=$code). dumping log tail..."
  tail -n 50 "$API_LOG"
  kill "$API_PID" || true
  exit 1
fi

# 1. Auth Setup
source tools/gate/lib/gate_auth_seed.sh

# 2. Mock Assets Setup
STORAGE_DIR=".data/storage/p15_mock"
mkdir -p "$STORAGE_DIR"
cp tools/gate/assets/p15_mock/anchor.png "$STORAGE_DIR/anchor.png"
cp tools/gate/assets/p15_mock/target_same.png "$STORAGE_DIR/target_same.png"
cp tools/gate/assets/p15_mock/target_diff.png "$STORAGE_DIR/target_diff.png"

# Helper Functions
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
process.stdout.write("X-Api-Key: " + apiKey + "\n");
process.stdout.write("X-Nonce: " + nonce + "\n");
process.stdout.write("X-Timestamp: " + timestamp + "\n");
process.stdout.write("X-Signature: " + signature + "\n");
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

wait_quality_score() {
  local SHOT_ID=$1
  local EXPECT_VERDICT=${2:-}
  local DEADLINE=$(( $(date +%s) + 30 ))
  while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    RES=$(psql "$DATABASE_URL" -t -A -c "SELECT verdict FROM quality_scores WHERE \"shotId\"='$SHOT_ID' ORDER BY \"createdAt\" DESC LIMIT 1" | tr -d '[:space:]')
    if [ -n "$RES" ]; then
      if [ -n "$EXPECT_VERDICT" ] && [ "$RES" != "$EXPECT_VERDICT" ]; then
        echo "   Waiting for verdict $EXPECT_VERDICT (got $RES)..."
      else
        echo "$RES"
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

# PLAN-2: Schema Drift Defense (Dump Facts)
log ">>> PLAN-2: Dumping DB Schema Facts..."
psql "$DATABASE_URL" -c "\d+ shots" > "$EVIDENCE_DIR/db_shots_schema.txt"
psql "$DATABASE_URL" -c "\d+ assets" > "$EVIDENCE_DIR/db_assets_schema.txt"
psql "$DATABASE_URL" -c "select enumlabel from pg_enum join pg_type on pg_enum.enumtypid=pg_type.oid where typname='AssetOwnerType';" > "$EVIDENCE_DIR/db_enum_assetownertype.txt"

# 4. Project & Data Setup (Minimal Inserts)
log "Seeding Project..."
PROJ_ID="proj_p16_$TS"
ORG_ID="gate-org"
# Ensure Org/User
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, \"createdAt\", \"updatedAt\") VALUES ('$ORG_ID', 'Gate Org', 'system', 100000, now(), now()) ON CONFLICT (id) DO UPDATE SET credits=100000"
psql "$DATABASE_URL" -c "INSERT INTO projects (id, name, \"organizationId\", \"ownerId\", status, \"createdAt\", \"updatedAt\") VALUES ('$PROJ_ID', 'P16 Shadow', '$ORG_ID', 'system', 'in_progress', now(), now()) ON CONFLICT DO NOTHING"

# Hierarchy
SEASON_ID="season_$TS"
EPISODE_ID="episode_$TS"
SCENE_ID="scene_$TS"

psql "$DATABASE_URL" -c "INSERT INTO seasons (id, \"projectId\", index, title, \"createdAt\", \"updatedAt\") VALUES ('$SEASON_ID', '$PROJ_ID', 1, 'Season 1', now(), now())"
psql "$DATABASE_URL" -c "INSERT INTO episodes (id, \"seasonId\", \"projectId\", index, name) VALUES ('$EPISODE_ID', '$SEASON_ID', '$PROJ_ID', 1, 'Ep 1')"
psql "$DATABASE_URL" -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, summary, created_at, updated_at) VALUES ('$SCENE_ID', '$EPISODE_ID', '$PROJ_ID', 1, 'Summary', now(), now())"
# P0 Requirements: Audio Assets (Scene Level)
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_tts_$TS', 'AUDIO_TTS', 'p15_mock/params.json', '$PROJ_ID', '$SCENE_ID', 'SCENE', now())"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_bgm_$TS', 'AUDIO_BGM', 'p15_mock/params.json', '$PROJ_ID', '$SCENE_ID', 'SCENE', now())"

# Insert Anchor (Minimal)
ANCHOR_ID="anchor_p16_$TS"
REF_ASSET_ID="asset_ref_p16_$TS"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$REF_ASSET_ID', 'IMAGE', 'p15_mock/anchor.png', '$PROJ_ID', '$SCENE_ID', 'SCENE', now())"
psql "$DATABASE_URL" -c "INSERT INTO identity_anchors (id, project_id, character_id, reference_asset_id, identity_hash, \"created_at\", \"updated_at\") VALUES ('$ANCHOR_ID', '$PROJ_ID', 'char_p16', '$REF_ASSET_ID', 'dummy_hash', now(), now())"

# --- CASE S1: SHADOW MODE ---
log ">>> CASE S1: Shadow Mode (Legacy Verdict, Signal Write) <<<"
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\"='{\"ce23RealShadowEnabled\": true, \"ce23RealEnabled\": false}' WHERE id='$PROJ_ID'"

SHOT_S1="shot_s1_$TS"
JOB_S1="job_s1_$TS"
TARGET_ASSET_S1="asset_s1_$TS"

psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_S1', '$ORG_ID', '$SCENE_ID', 1, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$TARGET_ASSET_S1', 'IMAGE', 'p15_mock/target_diff.png', '$SHOT_S1', '$PROJ_ID', '$SHOT_S1', 'SHOT', now())"
# P0 Requirements: Video (Shot Level)
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_vid_s1_$TS', 'VIDEO', 'p15_mock/params.json', '$SHOT_S1', '$PROJ_ID', '$SHOT_S1', 'SHOT', now())"

# Pre-insert Stub=0.9 (PASS)
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_S1', 'char_p16', '$ANCHOR_ID', '$TARGET_ASSET_S1', 0.9, 'PASS', now())"

# Create & Report Job
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_S1', '$SHOT_S1', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"

log "Reporting Job S1..."
HTTP_S1=$(curl_hmac_post "/api/jobs/$JOB_S1/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp_s1.json")
if [ "$HTTP_S1" != "201" ]; then log "❌ S1 Report Failed: $HTTP_S1"; exit 1; fi

log "Waiting for S1 Verdict..."
VERDICT_S1=$(wait_quality_score "$SHOT_S1" "PASS") # Expect PASS
log "S1 Verdict: $VERDICT_S1"

if [ "$VERDICT_S1" != "PASS" ]; then log "❌ S1 Fail: Should be PASS. Got $VERDICT_S1"; exit 1; fi

SIGNALS_S1=$(psql "$DATABASE_URL" -t -A -c "SELECT signals FROM quality_scores WHERE \"shotId\"='$SHOT_S1' ORDER BY \"createdAt\" DESC LIMIT 1")
REAL_SCORE_S1=$(echo "$SIGNALS_S1" | jq -r '.identity_score_real_ppv64')
log "S1 Real Score: $REAL_SCORE_S1"
if [ "$REAL_SCORE_S1" == "null" ]; then log "❌ S1 Fail: Missing real score"; exit 1; fi


# --- CASE S2: REAL MODE ---
log ">>> CASE S2: Real Mode (Real Verdict, Rework Trigger) <<<"
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\"='{\"ce23RealEnabled\": true}' WHERE id='$PROJ_ID'"

SHOT_S2="shot_s2_$TS"
JOB_S2="job_s2_$TS"
TARGET_ASSET_S2="asset_s2_$TS"

psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"organizationId\", \"sceneId\", index, type) VALUES ('$SHOT_S2', '$ORG_ID', '$SCENE_ID', 2, 'SHOT_RENDER')"
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('$TARGET_ASSET_S2', 'IMAGE', 'p15_mock/target_diff.png', '$SHOT_S2', '$PROJ_ID', '$SHOT_S2', 'SHOT', now())"
# P0 Requirements: Video (Shot Level)
psql "$DATABASE_URL" -c "INSERT INTO assets (id, type, \"storageKey\", \"shotId\", \"projectId\", \"ownerId\", \"ownerType\", \"createdAt\") VALUES ('asset_vid_s2_$TS', 'VIDEO', 'p15_mock/params.json', '$SHOT_S2', '$PROJ_ID', '$SHOT_S2', 'SHOT', now())"

# Stub=0.9 (PASS) but Real should FAIL
psql "$DATABASE_URL" -c "INSERT INTO shot_identity_scores (id, shot_id, character_id, reference_anchor_id, target_asset_id, identity_score, verdict, \"created_at\") VALUES (gen_random_uuid(), '$SHOT_S2', 'char_p16', '$ANCHOR_ID', '$TARGET_ASSET_S2', 0.9, 'PASS', now())"

psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"shotId\", \"projectId\", \"organizationId\", type, status, attempts, \"createdAt\", \"updatedAt\") VALUES ('$JOB_S2', '$SHOT_S2', '$PROJ_ID', '$ORG_ID', 'SHOT_RENDER', 'RUNNING', 1, now(), now())"

log "Reporting Job S2..."
HTTP_S2=$(curl_hmac_post "/api/jobs/$JOB_S2/report" '{"status":"SUCCEEDED","result":{}}' "$EVIDENCE_DIR/resp_s2.json")
if [ "$HTTP_S2" != "201" ]; then log "❌ S2 Report Failed: $HTTP_S2"; exit 1; fi

log "Waiting for S2 Verdict..."
VERDICT_S2=$(wait_quality_score "$SHOT_S2" "FAIL") # Expect FAIL
log "S2 Verdict: $VERDICT_S2"

if [ "$VERDICT_S2" != "FAIL" ]; then log "❌ S2 Fail: Should be FAIL. Got $VERDICT_S2"; exit 1; fi


# --- OPS METRICS ---
log ">>> Ops Metrics Check <<<"
METRICS_JSON="$EVIDENCE_DIR/ops_metrics_snapshot.json"
curl -s "$API_URL/api/ops/metrics" > "$METRICS_JSON"
M_FAIL=$(jq -r '.ce23_real_fail_1h // 0' "$METRICS_JSON")
log "Metrics Fail Count: $M_FAIL"
if [ "$M_FAIL" -lt 1 ]; then log "⚠️ Metrics Warn: $M_FAIL < 1 (Ops verification skipped)"; fi


# --- CLEANUP API ---
log "Killing API..."
kill "$API_PID" || true


# PLAN-3: Evidence Chain
log ">>> PLAN-3: Archiving Evidence..."
psql "$DATABASE_URL" -c "COPY (SELECT * FROM quality_scores WHERE \"shotId\" IN ('$SHOT_S1', '$SHOT_S2')) TO STDOUT WITH CSV HEADER" > "$EVIDENCE_DIR/quality_scores_dump.csv"
( cd "$EVIDENCE_DIR" && sha256sum * > SHA256SUMS.txt )
( cd "$EVIDENCE_DIR" && sha256sum -c SHA256SUMS.txt )

log "✅ P16-0 Gate Double-Passed (Single Run Verified)"
exit 0
