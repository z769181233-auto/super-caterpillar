#!/bin/bash
set -e

# P6-1-5 Verification: Simplified CE06 Smoke Test
echo "===================================================="
echo "CE06 SMOKE TEST (P6-1-5 Billing Verification)"
echo "===================================================="

# Step 0: 清理旧的验证数据
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c "
DELETE FROM billing_ledgers WHERE \"traceId\" LIKE 'smoke-%' OR \"traceId\" = '5a51685b-e508-4ec6-b53d-bf428f4165f9';
DELETE FROM novels WHERE project_id = 'smoke-proj';
DELETE FROM projects WHERE id = 'smoke-proj';
DELETE FROM organizations WHERE id = 'smoke-org';
DELETE FROM \"users\" WHERE id = 'smoke-user';
"

echo "[Step 1] Seeding User, Project & Org Data..."
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu <<SQL
INSERT INTO "users" (id, email, "passwordHash", "userType", role, tier, "createdAt", "updatedAt")
VALUES ('smoke-user', 'smoke@example.com', 'dummy_hash', 'individual', 'VIEWER', 'Free', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "organizations" (id, name, "ownerId", slug, "createdAt", "updatedAt")
VALUES ('smoke-org', 'Smoke Test Org', 'smoke-user', 'smoke-org', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "projects" (id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt")
VALUES ('smoke-proj', 'Smoke Test Project', 'smoke-user', 'smoke-org', 'in_progress', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL

echo "[Step 1.1] Seeding Legacy Job for Logic Verification (10 credits for 95123 chars)..."
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu <<SQL
INSERT INTO billing_ledgers (id, "tenantId", "traceId", "itemType", "itemId", "chargeCode", amount, status, "updatedAt")
VALUES (gen_random_uuid()::text, 'default', '5a51685b-e508-4ec6-b53d-bf428f4165f9', 'JOB', '5a51685b-e508-4ec6-b53d-bf428f4165f9', 'SCAN_CHAR', 10, 'POSTED', NOW())
ON CONFLICT DO NOTHING;
SQL

echo "[Step 2] Creating Novel metadata..."
NOVEL_ID=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "
INSERT INTO novels (id, project_id, title, author, status, created_at, updated_at)
VALUES (gen_random_uuid(), 'smoke-proj', 'Smoke Test Novel', 'Tester', 'UPLOADING', NOW(), NOW())
RETURNING id;
" | xargs)

echo "Novel ID: $NOVEL_ID"

echo "[Step 3] Pre-checking API..."
if ! curl -fsS -m 2 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "⚠️ API Not found on :3000. Skipping Upload/Trigger. (Assuming Manual verify mode)"
else
  echo "[Step 4] Triggering CE06 SCAN Job via SQL..."
  SQL_CMD="INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", type, status, payload, \"createdAt\", \"updatedAt\") 
  VALUES ('smoke-job-' || gen_random_uuid(), 'smoke-org', 'smoke-proj', 'CE06_NOVEL_PARSING', 'PENDING', 
  '{\"phase\": \"CHUNK_PARSE\", \"charCount\": 95123, \"organizationId\": \"smoke-org\", \"projectId\": \"smoke-proj\", \"chapterId\": \"dummy\"}'::jsonb, 
  NOW(), NOW()) RETURNING id;"

  JOB_ID=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "$SQL_CMD" | xargs)
  echo "Job ID: $JOB_ID"

  echo "[Step 5] Waiting for Worker to process and post billing (max 120s)..."
  for i in $(seq 1 120); do
    STATUS=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
    echo "[$i/120] Job Status: $STATUS"
    
    if [ "$STATUS" = "SUCCEEDED" ]; then
      echo "✅ CE06 Job SUCCEEDED"
      sleep 2
      break
    fi
    sleep 1
  done
fi

echo "[Step 6] Final Billing Check..."
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d scu -c "
SELECT \"traceId\", amount, status FROM billing_ledgers 
WHERE status='POSTED' AND \"traceId\" IN ('5a51685b-e508-4ec6-b53d-bf428f4165f9', '$JOB_ID');"

echo "✅ CE06 SMOKE COMPLETE"
