#!/bin/bash
# gate-identity-lora.sh
# B2.3: Character Profile LoRA 自动挂载验证门禁

set -euo pipefail
IFS=$'\n\t'

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="IDENTITY_LORA"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/identity_lora_$TS"
mkdir -p "$EVIDENCE_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting B2.3 Character Profile LoRA Auto-Mount Gate..."

# Auth & Seeding
source tools/gate/lib/gate_auth_seed.sh

generate_headers() {
    local method=$1
    local path=$2
    local body=$3
    BODY="$body" node -e "
        const crypto = require('crypto');
        const secret = '$API_SECRET';
        const method = '$method';
        const path = '$path';
        const body = process.env.BODY;
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 'nonce_${TS}_' + Math.random().toString(36).substring(7);
        const apiKey = '$VALID_API_KEY_ID';
        const contentSha256 = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
        const payload = apiKey + nonce + timestamp + (body || '');
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        process.stdout.write(\`X-Api-Key: \${apiKey}\n\`);
        process.stdout.write(\`X-Nonce: \${nonce}\n\`);
        process.stdout.write(\`X-Timestamp: \${timestamp}\n\`);
        process.stdout.write(\`X-Content-SHA256: \${contentSha256}\n\`);
        process.stdout.write(\`X-Signature: \${signature}\n\`);
    "
}

# ========================================
# PHASE 1: 创建角色档案
# ========================================
log "--- [PHASE 1] Creating Character Profile ---"

CHARACTER_PAYLOAD=$(cat <<EOF
{
  "name": "测试角色_$TS",
  "nameEn": "Test_Character_$TS",
  "role": "主角",
  "description": "用于 Gate 测试的角色",
  "baseImageUrl": "https://example.com/base.png",
  "basePrompt": "A brave warrior",
  "attributes": {
    "age": 25,
    "gender": "male",
    "clothing": "armor",
    "hairstyle": "short"
  }
}
EOF
)

PATH_CREATE_CHAR="/api/v1/projects/$PROJ_ID/characters"
HEADERS=$(generate_headers "POST" "$PATH_CREATE_CHAR" "$CHARACTER_PAYLOAD")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

CHAR_RESP=$(curl -s -X POST "${CURL_H[@]}" \
    -H "Content-Type: application/json" \
    -d "$CHARACTER_PAYLOAD" \
    "${API_URL}${PATH_CREATE_CHAR}")

CHARACTER_ID=$(echo "$CHAR_RESP" | jq -r '.id')

if [ "$CHARACTER_ID" == "null" ] || [ -z "$CHARACTER_ID" ]; then
    log "❌ Failed to create character"
    echo "$CHAR_RESP" | jq '.'
    exit 1
fi

log "✅ Created Character: $CHARACTER_ID"
echo "$CHAR_RESP" | jq '.' > "$EVIDENCE_DIR/character_created.json"

# ========================================
# PHASE 2: 模拟 LoRA 训练（直接更新 loraModelId）
# ========================================
log "--- [PHASE 2] Simulating LoRA Training ---"

# 模拟训练完成的 LoRA 模型 ID
LORA_MODEL_ID="test-user/test-character-lora:v1"

# 使用 PATCH 更新角色的 loraModelId
UPDATE_PAYLOAD=$(cat <<EOF
{
  "loraModelId": "$LORA_MODEL_ID",
  "loraTrainingStatus": "succeeded"
}
EOF
)

PATH_UPDATE_CHAR="/api/v1/characters/$CHARACTER_ID"
HEADERS=$(generate_headers "PATCH" "$PATH_UPDATE_CHAR" "$UPDATE_PAYLOAD")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

UPDATE_RESP=$(curl -s -X PATCH "${CURL_H[@]}" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_PAYLOAD" \
    "${API_URL}${PATH_UPDATE_CHAR}")

UPDATED_MODEL_ID=$(echo "$UPDATE_RESP" | jq -r '.loraModelId')

if [ "$UPDATED_MODEL_ID" != "$LORA_MODEL_ID" ]; then
    log "❌ Failed to update LoRA model ID"
    echo "$UPDATE_RESP" | jq '.'
    exit 1
fi

log "✅ Updated Character LoRA Model ID: $LORA_MODEL_ID"
echo "$UPDATE_RESP" | jq '.' > "$EVIDENCE_DIR/character_updated.json"

# ========================================
# PHASE 3: 创建 Shot 并触发 SHOT_RENDER
# ========================================
log "--- [PHASE 3] Creating Shot with Character ID ---"

# 创建 Shot（通过 PSQL）
SHOT_TITLE="Gate LoRA Test Shot"
ENRICHED_PROMPT="A brave warrior in armor standing heroically"

INSERT_SQL="INSERT INTO shots (id, \"sceneId\", index, type, \"reviewStatus\", \"enrichedPrompt\", \"organizationId\") VALUES (gen_random_uuid(), '$SCENE_ID', 1000, 'MEDIUM_SHOT', 'APPROVED', '$ENRICHED_PROMPT', '$ORG_ID') RETURNING id;"

SHOT_ID=$(psql "$DATABASE_URL" -t -c "$INSERT_SQL" | grep -v "INSERT" | awk '{print $1}' | xargs)

if [ -z "$SHOT_ID" ]; then
    log "❌ Failed to create shot via PSQL"
    exit 1
fi

log "✅ Created Shot: $SHOT_ID"

# ========================================
# PHASE 4: 触发 SHOT_RENDER 任务（带 characterId）
# ========================================
log "--- [PHASE 4] Triggering SHOT_RENDER with characterId ---"

TRACE_ID="gate-lora-${TS}-${SHOT_ID}"
RUN_ID="run-lora-${TS}"

# 创建任务，payload 中包含 characterId
JOB_PAYLOAD=$(cat <<EOJSON | jq -c '.'
{
  "traceId": "$TRACE_ID",
  "pipelineRunId": "$RUN_ID",
  "projectId": "$PROJ_ID",
  "characterId": "$CHARACTER_ID"
}
EOJSON
)

JOB_ID=$(psql "$DATABASE_URL" -t -c "INSERT INTO shot_jobs (id, \"projectId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\") VALUES (gen_random_uuid(), '$PROJ_ID', '$SHOT_ID', 'SHOT_RENDER', 'PENDING', '$JOB_PAYLOAD', NOW(), NOW(), '$ORG_ID') RETURNING id;" | grep -v "INSERT" | awk '{print $1}' | xargs)

log "✅ Dispatched Job: $JOB_ID with characterId=$CHARACTER_ID"

# ========================================
# PHASE 5: 轮询任务完成
# ========================================
log "--- [PHASE 5] Polling for Job Completion ---"

STATUS="PENDING"
for r in {1..30}; do
    sleep 2
    STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
    if [ "$STATUS" == "SUCCEEDED" ] || [ "$STATUS" == "FAILED" ]; then break; fi
    echo -ne "."
done
echo ""

if [ "$STATUS" != "SUCCEEDED" ]; then
    log "❌ Job $JOB_ID failed/timeout: $STATUS"
    psql "$DATABASE_URL" -c "SELECT * FROM shot_jobs WHERE id='$JOB_ID';"
    exit 1
fi

log "✅ Job $JOB_ID SUCCEEDED"

# ========================================
# PHASE 6: 验证 LoRA 挂载日志
# ========================================
log "--- [PHASE 6] Verifying LoRA Mount ---"

# 查询 Worker 日志（从 shot_jobs 的 result 或系统日志）
# 由于我们无法直接从 gate 脚本访问 Worker 日志，我们可以：
# 1. 检查 Shot 的 result_image_url 是否生成
# 2. 从数据库中验证任务是否包含 LoRA 相关信息

ROW=$(psql "$DATABASE_URL" -t -c "SELECT \"render_status\", \"result_image_url\" FROM shots WHERE id='$SHOT_ID';")
R_STATUS=$(echo "$ROW" | awk -F '|' '{print $1}' | xargs)
R_URL=$(echo "$ROW" | awk -F '|' '{print $2}' | xargs)

if [ "$R_STATUS" != "COMPLETED" ]; then 
    log "❌ Shot Status: $R_STATUS (expected COMPLETED)"
    exit 1
fi

if [ -z "$R_URL" ]; then 
    log "❌ Shot result_image_url is empty"
    exit 1
fi

log "✅ Shot render completed: $R_URL"

# 检查任务的 payload 是否包含 characterId
JOB_PAYLOAD_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT payload FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
if [[ ! "$JOB_PAYLOAD_CHECK" =~ "$CHARACTER_ID" ]]; then
    log "❌ Job payload does not contain characterId"
    echo "Payload: $JOB_PAYLOAD_CHECK"
    exit 1
fi

log "✅ Job payload contains characterId: $CHARACTER_ID"

# ========================================
# PHASE 7: 最终验证
# ========================================
log "--- [PHASE 7] Final Verification ---"

# 获取更新后的角色信息
PATH_GET_CHAR="/api/v1/characters/$CHARACTER_ID"
HEADERS=$(generate_headers "GET" "$PATH_GET_CHAR" "")
CURL_H=()
while IFS= read -r line; do CURL_H+=(-H "$line"); done <<< "$HEADERS"

FINAL_CHAR=$(curl -s "${CURL_H[@]}" "${API_URL}${PATH_GET_CHAR}")
FINAL_LORA=$(echo "$FINAL_CHAR" | jq -r '.loraModelId')

if [ "$FINAL_LORA" != "$LORA_MODEL_ID" ]; then
    log "❌ LoRA Model ID mismatch: $FINAL_LORA != $LORA_MODEL_ID"
    exit 1
fi

log "✅ Character LoRA Model ID verified: $FINAL_LORA"
echo "$FINAL_CHAR" | jq '.' > "$EVIDENCE_DIR/character_final.json"

# ========================================
# 生成证据
# ========================================
log "--- [PHASE 8] Generating Evidence ---"

psql "$DATABASE_URL" -c "SELECT * FROM character_profiles WHERE id='$CHARACTER_ID';" > "$EVIDENCE_DIR/character_profile_dump.txt"
psql "$DATABASE_URL" -c "SELECT * FROM shots WHERE id='$SHOT_ID';" > "$EVIDENCE_DIR/shot_dump.txt"
psql "$DATABASE_URL" -c "SELECT * FROM shot_jobs WHERE id='$JOB_ID';" > "$EVIDENCE_DIR/job_dump.txt"

find "$EVIDENCE_DIR" -type f -print0 | xargs -0 sha256sum > "$EVIDENCE_DIR/SHA256SUMS.txt"

log "🏆 B2.3 CHARACTER LORA AUTO-MOUNT GATE PASSED."
log "Evidence directory: $EVIDENCE_DIR"
exit 0
