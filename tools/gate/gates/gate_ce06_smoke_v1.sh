#!/bin/bash
set -e

# P6-1-5 Verification: Simplified CE06 Smoke Test
echo "===================================================="
echo "CE06 SMOKE TEST (P6-1-5 Billing Verification)"
echo "===================================================="

EVI=$(cat .current_p6_1_EVI 2>/dev/null || echo "docs/_evidence/p6_1_5_smoke_latest")
mkdir -p "$EVI"

# Use a smaller test file (create if not exists)
TEST_FILE="100kb_test.txt"
if [ ! -f "$TEST_FILE" ]; then
  echo "Creating small test file (100KB)..."
  python3 -c "print('第一章 测试\n' + '这是测试内容。' * 7000)" > "$TEST_FILE"
fi

echo "[Step 1] Seeding User, Project & Org Data..."
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu <<SQL
INSERT INTO "users" (id, email, name, role, provider, "createdAt", "updatedAt")
VALUES ('smoke-user', 'smoke@example.com', 'Smoke User', 'USER', 'EMAIL', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "organizations" (id, name, "ownerId", slug, "createdAt", "updatedAt")
VALUES ('smoke-org', 'Smoke Test Org', 'smoke-user', 'smoke-org', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "projects" (id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt")
VALUES ('smoke-proj', 'Smoke Test Project', 'smoke-user', 'smoke-org', 'in_progress', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL

echo "[Step 2] Creating Novel metadata..."
# 注意：novels 表的列名也是 camelCase 的可能性很高，通过尝试匹配获取 id
NOVEL_ID=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "
INSERT INTO novels (id, project_id, title, author, status, created_at, updated_at)
VALUES (gen_random_uuid(), 'smoke-proj', 'Smoke Test Novel', 'Tester', 'UPLOADING', NOW(), NOW())
ON CONFLICT DO NOTHING;
SELECT id FROM novels WHERE project_id='smoke-proj' ORDER BY created_at DESC LIMIT 1;
" | xargs)

echo "Novel ID: $NOVEL_ID"

echo "[Step 3] Uploading File via API..."
# 确保 API 端口可用
UPLOAD_RES=$(curl -sS -X POST http://localhost:3000/api/storage/upload \
  -H "Content-Type: application/octet-stream" \
  -H "X-Content-SHA256: $(shasum -a 256 "$TEST_FILE" | awk '{print $1}')" \
  --data-binary "@$TEST_FILE")

STORAGE_KEY=$(echo $UPLOAD_RES | jq -r '.storageKey')

if [ "$STORAGE_KEY" == "null" ] || [ -z "$STORAGE_KEY" ]; then
  echo "❌ Upload failed: $UPLOAD_RES"
  exit 1
fi
echo "Storage Key: $STORAGE_KEY"

echo "[Step 4] Triggering CE06 SCAN Job..."
# 构造 SQL，使用双引号保护驼峰命名的列
SQL_CMD="INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", type, status, payload, \"createdAt\", \"updatedAt\") 
VALUES (gen_random_uuid(), 'smoke-org', 'smoke-proj', 'CE06_NOVEL_PARSING', 'PENDING', 
'{\"phase\": \"SCAN\", \"novelRef\": {\"storageKey\": \"$STORAGE_KEY\"}, \"organizationId\": \"smoke-org\", \"projectId\": \"smoke-proj\"}'::jsonb, 
NOW(), NOW()) RETURNING id;"

JOB_ID=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "$SQL_CMD" | xargs)

if [ -z "$JOB_ID" ]; then
    echo "❌ Failed to create Job."
    exit 1
fi
echo "Job ID: $JOB_ID"

echo "[Step 5] Waiting for Job to complete (max 120s)..."
for i in $(seq 1 120); do
  STATUS=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
  echo "[$i/120] Job Status: $STATUS"
  
  if [ "$STATUS" = "SUCCEEDED" ]; then
    echo "✅ CE06 Job SUCCEEDED"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "❌ CE06 Job FAILED"
    PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c "SELECT metadata FROM shot_jobs WHERE id='$JOB_ID';"
    exit 1
  fi
  
  sleep 1
done

if [ "$STATUS" != "SUCCEEDED" ]; then
  echo "❌ Timeout waiting for CE06 SUCCEEDED"
  exit 1
fi

echo "[Step 6] Checking BillingLedger..."
# 检查是否生成了对应的计费记录
LEDGER_DATA=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "SELECT COUNT(*), SUM(amount) FROM billing_ledgers WHERE \"traceId\"='$JOB_ID' AND status='POSTED';")
echo "Ledger Data (Count | TotalAmount): $LEDGER_DATA"

COUNT=$(echo $LEDGER_DATA | cut -d'|' -f1 | xargs)
if [ "$COUNT" -eq 0 ]; then
  echo "❌ FAIL: No POSTED ledger entry for Job $JOB_ID"
  exit 1
fi

echo "✅ PASS: Found $COUNT POSTED ledger entry for Job $JOB_ID"
echo ""
echo "✅ CE06 SMOKE TEST PASSED"
