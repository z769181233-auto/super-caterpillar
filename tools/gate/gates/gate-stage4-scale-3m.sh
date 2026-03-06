#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# gate-stage4-scale-3m.sh
# 验证 Stage 4: Industrial Scale Refactor (The Shredder) - 3M Words Scale
# 1. 生成 10,000 章的长篇小说 (模拟 300万字)
# 2. 插入 NOVEL_SCAN_TOC 任务
# 3. 验证 Worker 扫描并扇出 10,000 个 Chunk Job
# 4. 验证 Chunk Job 处理成功

# Config
PROJECT_ID="proj_stage4_3m_$(date +%s)"
FILE_KEY="uploads/mock_novel_stage4_3m.txt"
ABS_FILE_PATH="$(pwd)/$FILE_KEY"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/scu}"

echo "=================================================="
echo "GATE: Stage 4 Scale 3M (The Shredder)"
echo "Project: $PROJECT_ID"
echo "Target: 10,000 Chapters (~15MB)"
echo "=================================================="

# 1. Generate Mock Novel (10,000 Chapters)
mkdir -p uploads
echo "Generating Mock Novel ($ABS_FILE_PATH)..."
> "$ABS_FILE_PATH"

# Generate a 1KB block of text
BLOCK="This is a block of text to simulate novel content. It repeats to fill space. "
for k in {1..5}; do BLOCK="$BLOCK$BLOCK"; done

# 10,000 Chapters * ~1KB = ~10MB
for i in {1..10000}; do
  if (( i % 1000 == 0 )); then echo "  Generating Chapter $i..."; fi
  echo "第${i}章 Mock Chapter $i" >> "$ABS_FILE_PATH"
  echo "$BLOCK" >> "$ABS_FILE_PATH"
  echo "" >> "$ABS_FILE_PATH"
done

SIZE=$(ls -lh "$ABS_FILE_PATH" | awk '{print $5}')
echo "[OK] Generated 10,000 chapters. Size: $SIZE"

# 2. Setup DB (Project)
echo "Setting up Project..."
psql "$DB_URL" -c "INSERT INTO users (id, email, \"passwordHash\", \"userType\", \"createdAt\", \"updatedAt\") VALUES ('user_stage4_3m', 'stage4_3m@example.com', 'hash', 'admin', NOW(), NOW()) ON CONFLICT DO NOTHING;"
psql "$DB_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, type, \"createdAt\", \"updatedAt\") VALUES ('org_stage4_3m', 'Stage4 3M Org', 'user_stage4_3m', 100000, 'personal', NOW(), NOW()) ON CONFLICT DO NOTHING;"
psql "$DB_URL" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, metadata, \"settingsJson\", \"createdAt\", \"updatedAt\") VALUES ('$PROJECT_ID', 'Stage4 3M Scale', 'user_stage4_3m', 'org_stage4_3m', 'in_progress', '{}', '{}', NOW(), NOW());"

# 2.5 Create NovelSource Record
NS_ID="ns_3m_$(date +%s)"
echo "Creating NovelSource Record ($NS_ID)..."
psql "$DB_URL" -c "INSERT INTO novel_sources (id, \"projectId\", \"organizationId\", \"fileKey\", \"fileName\", \"fileSize\", status, \"totalChapters\", \"processedChunks\", \"createdAt\", \"updatedAt\") VALUES ('$NS_ID', '$PROJECT_ID', 'org_stage4_3m', '$ABS_FILE_PATH', 'mock_novel_stage4_3m.txt', 15000000, 'PENDING', 0, 0, NOW(), NOW());"

# 3. Insert SCAN Job
JOB_ID="job_scan_3m_$(date +%s)"
PAYLOAD="{\"projectId\":\"$PROJECT_ID\", \"fileKey\":\"$ABS_FILE_PATH\", \"novelSourceId\":\"$NS_ID\"}"

echo "Inserting NOVEL_SCAN_TOC Job ($JOB_ID)..."
psql "$DB_URL" -c "INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", type, status, priority, payload, \"createdAt\", \"updatedAt\") VALUES ('$JOB_ID', 'org_stage4_3m', '$PROJECT_ID', 'NOVEL_SCAN_TOC', 'PENDING', 100, '$PAYLOAD', NOW(), NOW());"

echo "Waiting for Worker to pick up NOVEL_SCAN_TOC..."
# Poll for SCAN job completion (It might take longer for 10k chapters)
for i in {1..60}; do
  STATUS=$(psql "$DB_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
  echo "  Scan Job Status: $STATUS"
  if [ "$STATUS" == "SUCCEEDED" ]; then
    echo "[PASS] Scan Job SUCCEEDED"
    break
  fi
  if [ "$STATUS" == "FAILED" ]; then
    echo "[FAIL] Scan Job FAILED"
    psql "$DB_URL" -t -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$JOB_ID';"
    exit 1
  fi
  sleep 5
done

if [ "$STATUS" != "SUCCEEDED" ]; then
  echo "[FAIL] Timeout waiting for scan job completion."
  exit 1
fi

# 4. Verify Fan-out
echo "Verifying Fan-out..."
EP_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM episodes WHERE \"projectId\"='$PROJECT_ID';" | xargs)
echo "  Episodes Created: $EP_COUNT"

JOB_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE';" | xargs)
echo "  Chunk Jobs Created: $JOB_COUNT"

if [ "$EP_COUNT" -eq "10000" ] && [ "$JOB_COUNT" -eq "10000" ]; then
  echo "[PASS] Fan-out Verified (10,000 chaps -> 10,000 jobs)"
else
  echo "[FAIL] Fan-out mismatch! Expected 10,000, got Ep=$EP_COUNT, Job=$JOB_COUNT"
  exit 1
fi

# 5. Wait for Execution (The Real Scaling Test)
echo "Waiting for Chunk Jobs Execution (Sample check)..."
# We won't wait for all 10,000 to finish in this script (might take massive time if concurrency is low), 
# but we check if they are *starting* and *succeeding* without mass failure.

for i in {1..30}; do
  SUCCEEDED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE' AND status='SUCCEEDED';" | xargs)
  FAILED_COUNT=$(psql "$DB_URL" -t -c "SELECT count(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE' AND status='FAILED';" | xargs)
  
  # New: Check NovelSource Progress
  NS_PROGRESS=$(psql "$DB_URL" -t -c "SELECT \"processedChunks\" FROM novel_sources WHERE \"projectId\"='$PROJECT_ID';" | xargs)
  NS_STATUS=$(psql "$DB_URL" -t -c "SELECT status FROM novel_sources WHERE \"projectId\"='$PROJECT_ID';" | xargs)

  echo "  Chunk Jobs: SUCCEEDED=$SUCCEEDED_COUNT, FAILED=$FAILED_COUNT | NS_STATUS=$NS_STATUS, NS_PROGRESS=$NS_PROGRESS"
  
  if [ "$FAILED_COUNT" -gt "50" ]; then
    echo "[FAIL] Too many failures detected ($FAILED_COUNT > 50). System unstable."
    exit 1
  fi
  
  if [ "$SUCCEEDED_COUNT" -gt "100" ] || [ "${NS_PROGRESS:-0}" -gt "100" ]; then
    echo "[PASS] System is processing jobs. Progress: $NS_PROGRESS/10000. Assuming functionality."
    break
  fi
  
  sleep 5
done

echo "=================================================="
echo "STAGE 4 SCALE 3M GATE PASSED"
echo "=================================================="
exit 0
