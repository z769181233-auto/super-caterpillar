#!/usr/bin/env bash
set -e

# gate_stage4_api_shredder.sh
# 验证 API 级的 Shredder 分流流程 (V3.1)

ROOT_DIR="$(pwd)"
INPUT_FILE="${ROOT_DIR}/uploads/novels/test_novel_15m.txt"
PROJECT_ID="gate-api-shredder-$(date +%s)"
ORG_ID="org-gate"
USER_ID="pilot-api"
API_KEY="ak_worker_dev_0000000000000000"
API_SECRET="sk_worker_dev_1234567890123456"

echo "===================================================="
echo "STAGE 4: API-LEVEL SHREDDER INTEGRATION TEST"
echo "Project ID: ${PROJECT_ID}"
echo "===================================================="

# 0. 准备数据 (确保用户、项目和组织存在)
echo "[Step 0] Seeding Database..."
psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -c "INSERT INTO users (id, email, \"passwordHash\", \"userType\", role, tier, \"createdAt\", \"updatedAt\") VALUES ('${USER_ID}', '${USER_ID}@scu.com', 'hash', 'individual', 'ADMIN', 'Pro', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, type, \"createdAt\", \"updatedAt\") VALUES ('${ORG_ID}', 'Gate Org', '${USER_ID}', 1000000, 'personal', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', 'API Shredder Test', '${USER_ID}', '${ORG_ID}', 'in_progress', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -c "INSERT INTO organization_members (id, \"userId\", \"organizationId\", role, \"createdAt\", \"updatedAt\") VALUES ('om-${PROJECT_ID}', '${USER_ID}', '${ORG_ID}', 'ADMIN', NOW(), NOW()) ON CONFLICT (\"userId\", \"organizationId\") DO NOTHING;"

# 1. 构造 JSON Body
echo "[Step 1] Constructing JSON Body (15M Chars)..."
cat <<EOF > tmp_api_body.json
{
  "project_id": "${PROJECT_ID}",
  "title": "15M API Shredder Test",
  "raw_text": $(jq -Rs . < "${INPUT_FILE}")
}
EOF

# 2. 生成 HMAC 签名
echo "[Step 2] Generating HMAC Signatures..."
TIMESTAMP=$(date +%s)
# Note: Use large payload script via stdin
HMAC_OUT=$(cat tmp_api_body.json | npx ts-node tools/gate/scripts/hmac_v11_large_payload.ts "{\"apiKey\":\"${API_KEY}\",\"apiSecret\":\"${API_SECRET}\",\"timestamp\":\"${TIMESTAMP}\",\"method\":\"POST\",\"path\":\"/api/v3/story/parse\"}")

# Parse headers
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
  -d @tmp_api_body.json)

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

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS_RES=$(curl -s -X GET "http://localhost:3000/v3/story/job/${JOB_ID}")
  STATUS=$(echo "$STATUS_RES" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RES" | jq -r '.progress')
  STEP=$(echo "$STATUS_RES" | jq -r '.current_step')
  TOTAL_CHUNKS=$(psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type='NOVEL_CHUNK_PARSE'")
  DONE_CHUNKS=$(psql -d "postgresql://postgres:postgres@127.0.0.1:5433/scu" -t -A -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='${PROJECT_ID}' AND type='NOVEL_CHUNK_PARSE' AND status='SUCCEEDED'")
  
  echo "Time: ${ELAPSED}s | Status: ${STATUS} | Progress: ${PROGRESS}% | Step: ${STEP} | Chunks: ${DONE_CHUNKS}/${TOTAL_CHUNKS}"
  
  if [ "$STATUS" == "SUCCEEDED" ]; then
    echo "✅ API Shredder Test PASSED"
    # psql -d "postgresql://postgres:postgres@127.0.0.1:5434/scu" -c "SELECT title, \"sceneIndex\" FROM scenes WHERE \"projectId\"='${PROJECT_ID}' ORDER BY \"sceneIndex\" LIMIT 10;"
    exit 0
  fi
  
  if [ "$STATUS" == "FAILED" ]; then
    echo "❌ API Shredder Test FAILED"
    echo "$STATUS_RES" | jq .
    exit 1
  fi
  
  sleep 10
  ELAPSED=$((ELAPSED+10))
done

echo "❌ Timeout waiting for Shredder to complete."
exit 1
