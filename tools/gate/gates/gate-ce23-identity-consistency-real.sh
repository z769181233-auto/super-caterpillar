#!/bin/bash
set -euo pipefail

API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="CE23_IDENTITY_REAL"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/ce23_identity_real_$TS"
mkdir -p "$EVIDENCE_DIR"

log(){ echo "[$GATE_NAME] $(date +'%H:%M:%S') $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"; }

log "Starting CE23 REAL (PPV-64) gate..."
source tools/gate/lib/gate_auth_seed.sh

# 1. Enable Feature Flag
log "Enabling ce23RealEnabled for project $PROJ_ID..."
psql "$DATABASE_URL" -c "UPDATE projects SET \"settingsJson\" = '{\"ce23RealEnabled\": true}' WHERE id = '$PROJ_ID';"

# 2. Prepare Assets in Storage
STORAGE_DIR=".data/storage"
mkdir -p "$STORAGE_DIR/p15_mock"

cp tools/gate/assets/p15_mock/anchor.png "$STORAGE_DIR/p15_mock/anchor.png"
cp tools/gate/assets/p15_mock/target_same.png "$STORAGE_DIR/p15_mock/target_same.png"
cp tools/gate/assets/p15_mock/target_diff.png "$STORAGE_DIR/p15_mock/target_diff.png"

# 3. Register Assets and Anchor in DB
log "Registering mock assets and anchors..."
REF_ASSET_ID="asset_anchor_$TS_SEED"
psql "$DATABASE_URL" <<EOF
INSERT INTO "assets" ("id", "projectId", "storageKey", "type", "ownerId", "ownerType", "status")
VALUES ('$REF_ASSET_ID', '$PROJ_ID', 'p15_mock/anchor.png', 'IMAGE', '$SHOT_ID_1', 'SHOT', 'GENERATED');

INSERT INTO "identity_anchors" ("id", "project_id", "character_id", "reference_asset_id", "identity_hash", "updated_at")
VALUES ('anchor_$TS_SEED', '$PROJ_ID', 'char_p15', '$REF_ASSET_ID', 'dummy_hash', NOW());
EOF

# 4. Helper for HMAC Headers
generate_headers() {
    local method=$1
    local path=$2
    local body=$3
    node -e "
        const crypto = require('crypto');
        const secret = '$API_SECRET';
        const method = '$method';
        const path = '$path';
        const body = '$body';
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 'nonce_${TS}_' + Math.random().toString(36).substring(7);
        const apiKey = '$VALID_API_KEY_ID';
        const payload = apiKey + nonce + timestamp + body;
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        process.stdout.write(\`X-Api-Key: \${apiKey}\n\`);
        process.stdout.write(\`X-Nonce: \${nonce}\n\`);
        process.stdout.write(\`X-Timestamp: \${timestamp}\n\`);
        process.stdout.write(\`X-Signature: \${signature}\n\`);
    "
}

run_score_test() {
    local run_id=$1
    local target_file=$2
    local target_asset_id="asset_target_${run_id}_$TS_SEED"
    local shot_id="shot_test_${run_id}_$TS_SEED"

    log "Run $run_id: Testing with $target_file..."

    # Seed Asset/Shot for this run
    psql "$DATABASE_URL" <<EOF
INSERT INTO "shots" ("id", "sceneId", "index", "type", "reviewStatus")
VALUES ('$shot_id', '$SCENE_ID', $run_id, 'CLOSE_UP', 'APPROVED');

INSERT INTO "assets" ("id", "projectId", "storageKey", "type", "ownerId", "ownerType", "status")
VALUES ('$target_asset_id', '$PROJ_ID', 'p15_mock/$target_file', 'IMAGE', '$shot_id', 'SHOT', 'GENERATED');
EOF

    local BODY="{\"projectId\":\"$PROJ_ID\",\"characterId\":\"char_p15\",\"referenceAssetId\":\"$REF_ASSET_ID\",\"targetAssetId\":\"$target_asset_id\",\"shotId\":\"$shot_id\",\"referenceAnchorId\":\"anchor_$TS_SEED\"}"
    local TARGET_PATH="/api/_internal/ce23/score-and-record"
    local HEADERS=$(generate_headers "POST" "$TARGET_PATH" "$BODY")
    local CURL_H=()
    while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

    RESP=$(curl -s -X POST "$API_URL$TARGET_PATH" \
        -H "Content-Type: application/json" \
        "${CURL_H[@]}" \
        -d "$BODY")

    echo "$RESP" >> "$EVIDENCE_DIR/details.jsonl"
    
    local SCORE=$(echo "$RESP" | jq -r ".score")
    local VERDICT=$(echo "$RESP" | jq -r ".verdict")
    local PROVIDER=$(echo "$RESP" | jq -r ".details.provider")

    log "Result $run_id: Score=$SCORE, Verdict=$VERDICT, Provider=$PROVIDER"
    echo "$run_id,$target_file,$SCORE,$VERDICT" >> "$EVIDENCE_DIR/scores.csv"

    if [ "$PROVIDER" != "real-embed-v1" ]; then log "❌ Wrong provider (got $PROVIDER)! Resp: $RESP"; exit 1; fi
}

echo "run,file,score,verdict" > "$EVIDENCE_DIR/scores.csv"

# 5. Execute 5-shot test
run_score_test 1 "target_same.png"
run_score_test 2 "target_same.png"
run_score_test 3 "target_same.png"
run_score_test 4 "target_diff.png"
run_score_test 5 "target_diff.png"

# 6. Assertions
log "Verifying assertions..."
MIN_SCORE=$(cut -d, -f3 "$EVIDENCE_DIR/scores.csv" | grep -v "score" | sort -n | head -n 1)
log "Minimum score in 5-shot: $MIN_SCORE"

# Double PASS stability check (Run 1 vs Run 2)
S1=$(jq -r "select(.score) | .score" "$EVIDENCE_DIR/details.jsonl" | head -n 1)
S2=$(jq -r "select(.score) | .score" "$EVIDENCE_DIR/details.jsonl" | sed -n '2p')

log "Stability check: S1=$S1, S2=$S2"
if [ "$S1" != "$S2" ]; then
    log "❌ Double PASS stability check failed ($S1 vs $S2)"
    exit 1
fi
log "✅ Double PASS stability check: OK"

# Finalize Evidence
sha256sum "$EVIDENCE_DIR/scores.csv" "$EVIDENCE_DIR/details.jsonl" > "$EVIDENCE_DIR/SHA256SUMS.txt"
log "P15-0 REAL gate PASSED with 5-shot proof."
exit 0
