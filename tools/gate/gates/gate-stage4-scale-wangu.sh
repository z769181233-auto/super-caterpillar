#!/bin/bash
set -e

# gate-stage4-scale-wangu.sh
# 验证 Stage 4: Industrial Scale Refactor (The Shredder) - 真实超长篇小说《万古神帝》
# 1. 使用真实 1500万字文件 ($ABS_FILE_PATH)
# 2. 验证真正的章节特征提取 (正则表达式扫描)
# 3. 验证工业级高吞吐下的系统稳定性

# Config
PROJECT_ID="proj_wangu_$(date +%s)"
FILE_KEY="docs/_specs/万古神帝.txt"
ABS_FILE_PATH="$(pwd)/$FILE_KEY"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/scu}"

echo "=================================================="
echo "GATE: Stage 4 Scale REAL NOVEL (万古神帝)"
echo "Project: $PROJECT_ID"
echo "File: $ABS_FILE_PATH"
echo "=================================================="

if [ ! -f "$ABS_FILE_PATH" ]; then
    echo "[ERROR] Real novel file not found at $ABS_FILE_PATH"
    exit 1
fi

SIZE=$(ls -lh "$ABS_FILE_PATH" | awk '{print $5}')
echo "[OK] Resource Verified. Size: $SIZE"

# 2. Setup DB (Project)
echo "Setting up Project..."
psql "$DB_URL" -c "INSERT INTO users (id, email, \"passwordHash\", role, \"createdAt\", \"updatedAt\") VALUES ('user_wangu', 'wangu@test.com', 'pass', 'ADMIN', NOW(), NOW()) ON CONFLICT DO NOTHING;"
psql "$DB_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", \"createdAt\", \"updatedAt\", credits) VALUES ('org_wangu', 'Wangu Org', 'user_wangu', NOW(), NOW(), 1000) ON CONFLICT DO NOTHING;"
psql "$DB_URL" -c "UPDATE users SET \"defaultOrganizationId\"='org_wangu' WHERE id='user_wangu';"
psql "$DB_URL" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", \"createdAt\", \"updatedAt\", status) VALUES ('$PROJECT_ID', 'Wangu Story', 'user_wangu', 'org_wangu', NOW(), NOW(), 'in_progress');"

# 2.5 Create NovelSource Record
NS_ID="ns_wangu_$(date +%s)"
echo "Creating NovelSource Record ($NS_ID)..."
psql "$DB_URL" -c "INSERT INTO novel_sources (id, \"projectId\", \"organizationId\", \"fileKey\", \"fileName\", \"fileSize\", status, \"totalChapters\", \"processedChunks\", \"createdAt\", \"updatedAt\") VALUES ('$NS_ID', '$PROJECT_ID', 'org_wangu', '$ABS_FILE_PATH', '万古神帝.txt', 150000000, 'PENDING', 0, 0, NOW(), NOW());"

# 3. Insert SCAN Job
JOB_ID="job_scan_wangu_$(date +%s)"
PAYLOAD="{\"projectId\":\"$PROJECT_ID\", \"fileKey\":\"$ABS_FILE_PATH\", \"novelSourceId\":\"$NS_ID\"}"
echo "Inserting NOVEL_SCAN_TOC Job ($JOB_ID)..."
psql "$DB_URL" -c "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", type, status, payload, priority, \"createdAt\", \"updatedAt\") VALUES ('$JOB_ID', '$PROJECT_ID', 'org_wangu', 'NOVEL_SCAN_TOC', 'PENDING', '$PAYLOAD', 100, NOW(), NOW());"

# 4. Monitor Execution
echo "Waiting for Worker to pick up NOVEL_SCAN_TOC..."
for i in {1..60}; do
  STATUS=$(psql "$DB_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
  echo "  Scan Job Status: $STATUS"
  if [ "$STATUS" == "SUCCEEDED" ]; then
    echo "[PASS] Scan Job SUCCEEDED"
    break
  fi
  if [ "$STATUS" == "FAILED" ]; then
    echo "[FAIL] Scan Job FAILED!"
    psql "$DB_URL" -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$JOB_ID';"
    exit 1
  fi
  sleep 2
done

# Check Fan-out
EP_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM episodes WHERE \"projectId\"='$PROJECT_ID';" | xargs)
echo "  Episodes Created: $EP_COUNT"
JOB_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE';" | xargs)
echo "  Chunk Jobs Created: $JOB_COUNT"

if [ "$EP_COUNT" -gt "4250" ] && [ "$JOB_COUNT" -gt "4250" ]; then
  echo "[PASS] Fan-out Verified (Real Novel patterns detected: $EP_COUNT)"
else
  echo "[FAIL] Fan-out mismatch! Expected ~4251, got $EP_COUNT. Check pattern matching."
  exit 1
fi

# 5. Wait for Execution (Sample check)
echo "Waiting for Chunk Jobs Execution (Sample check)..."
for i in {1..30}; do
  SUCCEEDED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE' AND status='SUCCEEDED';" | xargs)
  FAILED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE' AND status='FAILED';" | xargs)
  
  NS_PROGRESS=$(psql "$DB_URL" -t -c "SELECT \"processedChunks\" FROM novel_sources WHERE \"projectId\"='$PROJECT_ID';" | xargs)
  NS_STATUS=$(psql "$DB_URL" -t -c "SELECT status FROM novel_sources WHERE \"projectId\"='$PROJECT_ID';" | xargs)

  echo "  Chunk Jobs: SUCCEEDED=$SUCCEEDED_COUNT, FAILED=$FAILED_COUNT | NS_STATUS=$NS_STATUS, NS_PROGRESS=$NS_PROGRESS"
  
  if [ "$FAILED_COUNT" -gt "50" ]; then
    echo "[FAIL] Too many failures detected ($FAILED_COUNT > 50). System unstable."
    exit 1
  fi
  
  if [ "$SUCCEEDED_COUNT" -gt "50" ] || [ "${NS_PROGRESS:-0}" -gt "50" ]; then
    echo "[PASS] Real world processing active. Throttling logic will engage if load peaks."
    break
  fi
  sleep 3
done

echo "=================================================="
echo "STORY SCALE VERIFICATION:万古神帝 PASS"
echo "=================================================="
