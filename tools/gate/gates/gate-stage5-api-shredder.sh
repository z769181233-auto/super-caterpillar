#!/usr/bin/env bash
set -e

# gate_stage5_api_shredder.sh
# 验证 Stage 5: Industrial Shot Planning (Cascade Trigger + V3 API Progress)

ROOT_DIR="$(pwd)"
# Use a smaller slice for Stage 5 quick verification (or full 15m if needed)
# Defaulting to 15m to prove scalability, but might need large memory for curl/jq
INPUT_FILE="${ROOT_DIR}/uploads/novels/test_novel_15m.txt"

# Fallback generator if file doesn't exist
if [ ! -f "$INPUT_FILE" ]; then
  echo "Generating 15M test file with structured chapters..."
  mkdir -p "${ROOT_DIR}/uploads/novels"
  node -e "
    const fs = require('fs');
    let content = '';
    for(let i=1; i<=50; i++) {
      content += '第一章 第' + i + '回\n\n';
      for(let j=1; j<=20; j++) {
        content += '这是第' + i + '章的第' + j + '个段落。描写了一段精彩的场景故事。这里有特写镜头。场景非常震撼。\n\n';
      }
    }
    // Repeat to make it large enough if needed, but 1000 paragraphs with tags should trigger Shredder
    fs.writeFileSync('${INPUT_FILE}', content.repeat(30)); 
  "
fi

PROJECT_ID="gate-stage5-shredder-$(date +%s)"
ORG_ID="org-gate"
USER_ID="pilot-api"
API_KEY="ak_smoke_test_key_v1"
API_SECRET="sk_worker_dev_1234567890123456"

echo "===================================================="
echo "STAGE 5: SHREDDER + SHOT PLANNING (CASCADE TRIGGER)"
echo "Project ID: ${PROJECT_ID}"
echo "===================================================="

# 0. 准备数据
echo "[Step 0] Seeding Database..."
psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -c "INSERT INTO users (id, email, \"passwordHash\", \"userType\", role, tier, \"createdAt\", \"updatedAt\") VALUES ('${USER_ID}', '${USER_ID}@scu.com', 'hash', 'individual', 'ADMIN', 'Pro', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, type, \"createdAt\", \"updatedAt\") VALUES ('${ORG_ID}', 'Gate Org', '${USER_ID}', 1000000, 'personal', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', 'Stage 5 Shredder Test', '${USER_ID}', '${ORG_ID}', 'in_progress', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -c "INSERT INTO organization_members (id, \"userId\", \"organizationId\", role, \"createdAt\", \"updatedAt\") VALUES ('om-${PROJECT_ID}', '${USER_ID}', '${ORG_ID}', 'ADMIN', NOW(), NOW()) ON CONFLICT (\"userId\", \"organizationId\") DO NOTHING;"

# 1. 构造 JSON Body
echo "[Step 1] Constructing JSON Body..."
# Use a temp file for body
cat <<EOF > tmp_stage5_body.json
{
  "project_id": "${PROJECT_ID}",
  "title": "Stage 5 Shredder Test",
  "raw_text": $(jq -Rs . < "${INPUT_FILE}"),
  "is_verification": true
}
EOF

# 2. 生成 HMAC 签名
echo "[Step 2] Generating HMAC Signatures..."
TIMESTAMP=$(date +%s)
HMAC_OUT=$(cat tmp_stage5_body.json | npx ts-node tools/gate/scripts/hmac_v11_large_payload.ts "{\"apiKey\":\"${API_KEY}\",\"apiSecret\":\"${API_SECRET}\",\"timestamp\":\"${TIMESTAMP}\",\"method\":\"POST\",\"path\":\"/api/v3/story/parse\"}")

X_API_KEY=$(echo "$HMAC_OUT" | grep "X-Api-Key" | cut -d: -f2)
X_NONCE=$(echo "$HMAC_OUT" | grep "X-Nonce" | cut -d: -f2)
X_TIMESTAMP=$(echo "$HMAC_OUT" | grep "X-Timestamp" | cut -d: -f2)
X_SIGNATURE=$(echo "$HMAC_OUT" | grep "X-Signature" | cut -d: -f2)

# 3. 发送请求
echo "[Step 3] Sending API Request to /v3/story/parse ..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/v3/story/parse" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${X_API_KEY}" \
  -H "X-Nonce: ${X_NONCE}" \
  -H "X-Timestamp: ${X_TIMESTAMP}" \
  -H "X-Signature: ${X_SIGNATURE}" \
  -d @tmp_stage5_body.json)

echo "Response: ${RESPONSE}"
JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id')

if [ "$JOB_ID" == "null" ] || [ -z "$JOB_ID" ]; then
  echo "❌ Failed to trigger job via API"
  exit 1
fi

echo "✅ Shredder Job Triggered: ${JOB_ID}"

# 4. 轮询进度
echo "[Step 4] Monitoring Progress..."
MAX_WAIT=600 # 10 minutes
ELAPSED=0
SEEN_PLANNING=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS_RES=$(curl -s -X GET "http://localhost:3000/v3/story/job/${JOB_ID}")
  STATUS=$(echo "$STATUS_RES" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RES" | jq -r '.progress')
  STEP=$(echo "$STATUS_RES" | jq -r '.current_step')
  
  # DB Stats check
  STATS=$(psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -t -A -c "
    SELECT 
      (SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type='NOVEL_CHUNK_PARSE') as chunks,
      (SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type='CE11_SHOT_GENERATOR') as plans,
      (SELECT count(*) FROM shot_plannings WHERE \"shotId\" IN (SELECT id FROM shots WHERE \"sceneId\" IN (SELECT id FROM scenes WHERE \"project_id\"='${PROJECT_ID}'))) as db_plans
  ")
  TOTAL_CHUNKS=$(echo $STATS | cut -d'|' -f1)
  TOTAL_PLANS=$(echo $STATS | cut -d'|' -f2)
  DB_PLANS=$(echo $STATS | cut -d'|' -f3)
  
  echo "Time: ${ELAPSED}s | Status: ${STATUS} | Progress: ${PROGRESS}% | Step: ${STEP} | Jobs: ${TOTAL_CHUNKS} Chunks, ${TOTAL_PLANS} Plans | DB Records: ${DB_PLANS}"
  
  if [ "$STEP" == "CE11_PLANNING" ] || [ "$STEP" == "CE11_SHOT_GEN" ]; then
    SEEN_PLANNING=true
  fi
  
  if [ "$STATUS" == "SUCCEEDED" ]; then
    echo "✅ Job Succeeded."
    
    # Assertions
    if [ "$DB_PLANS" -eq "0" ]; then
      echo "❌ No ShotPlanning records found in DB!"
      exit 1
    fi
    
    if [ "$TOTAL_PLANS" -eq "0" ]; then
       echo "❌ No CE11_SHOT_GENERATOR jobs created!"
       exit 1
    fi

    # Check one record for correctness
    SAMPLE=$(psql -d "postgresql://postgres:password@127.0.0.1:5433/scu" -t -A -c "SELECT data->>'shotType' FROM shot_plannings WHERE \"shotId\" IN (SELECT id FROM shots WHERE \"sceneId\" IN (SELECT id FROM scenes WHERE \"project_id\"='${PROJECT_ID}')) LIMIT 1")
    if [ -z "$SAMPLE" ]; then
       echo "❌ ShotPlanning data field missing shotType"
       exit 1
    fi
    echo "✅ Verified ShotPlanning Data: shotType=${SAMPLE}"

    echo "[Step 5] Running Deep Verification with TS Script..."
    npx ts-node tools/verify-stage4-5-api.ts "${PROJECT_ID}"
    
    echo "✅ Stage 5 API Shredder Test PASSED"
    exit 0
  fi
  
  if [ "$STATUS" == "FAILED" ]; then
    echo "❌ Stage 5 Test FAILED with status FAILED"
    echo "$STATUS_RES" | jq .
    exit 1
  fi
  
  sleep 5
  ELAPSED=$((ELAPSED+5))
done

echo "❌ Timeout waiting for Shredder completion."
exit 1
