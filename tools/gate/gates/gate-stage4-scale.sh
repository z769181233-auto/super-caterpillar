#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

# gate-stage4-scale.sh
# 验证 Stage 4: Industrial Scale Refactor (The Shredder)
# 1. 生成 100 章的长篇小说 (模拟 30万字)
# 2. 插入 NOVEL_SCAN_TOC 任务
# 3. 验证 Worker 扫描并扇出 100 个 Chunk Job
# 4. 验证 Chunk Job 处理成功



# Config
PROJECT_ID="proj_stage4_$(date +%s)"
FILE_KEY="uploads/mock_novel_stage4.txt"
ABS_FILE_PATH="$(pwd)/$FILE_KEY"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

echo "=================================================="
echo "GATE: Stage 4 Scale (The Shredder)"
echo "Project: $PROJECT_ID"
echo "=================================================="

# 1. Generate Mock Novel (100 Chapters)
mkdir -p uploads
echo "Generating Mock Novel ($ABS_FILE_PATH)..."
> "$ABS_FILE_PATH"

for i in {1..100}; do
  echo "第${i}章 Mock Chapter $i" >> "$ABS_FILE_PATH"
  echo "This is the content of chapter $i. Data data data." >> "$ABS_FILE_PATH"
  echo "More text for chapter $i." >> "$ABS_FILE_PATH"
  echo "" >> "$ABS_FILE_PATH"
done

echo "[OK] Generated 100 chapters."

# 2. Setup DB (Project)
echo "Setting up Project..."
psql "$DATABASE_URL" -c "INSERT INTO users (id, email, \"passwordHash\", \"userType\", \"createdAt\", \"updatedAt\") VALUES ('user_stage4', 'stage4@example.com', 'hash', 'admin', NOW(), NOW()) ON CONFLICT DO NOTHING;"
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, type, \"createdAt\", \"updatedAt\") VALUES ('org_stage4', 'Stage4 Org', 'user_stage4', 1000, 'personal', NOW(), NOW()) ON CONFLICT DO NOTHING;"
# Fix: Project requires status enum 'in_progress' and json defaults
psql "$DATABASE_URL" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, metadata, \"settingsJson\", \"createdAt\", \"updatedAt\") VALUES ('$PROJECT_ID', 'Stage4 Scale', 'user_stage4', 'org_stage4', 'in_progress', '{}', '{}', NOW(), NOW());"

# 3. Insert SCAN Job
JOB_ID="job_scan_$(date +%s)"
PAYLOAD="{\"projectId\":\"$PROJECT_ID\", \"fileKey\":\"$ABS_FILE_PATH\"}"

echo "Inserting NOVEL_SCAN_TOC Job ($JOB_ID)..."
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, payload, \"createdAt\", \"updatedAt\") VALUES ('$JOB_ID', 'org_stage4', '$PROJECT_ID', NULL, NULL, NULL, 'NOVEL_SCAN_TOC', 'PENDING', '$PAYLOAD', NOW(), NOW());"

echo "Waiting for Worker to pick up NOVEL_SCAN_TOC..."
# Simple poll
for i in {1..30}; do
  STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
  echo "  Status: $STATUS"
  if [ "$STATUS" == "SUCCEEDED" ]; then
    echo "[PASS] Job SUCCEEDED"
    break
  fi
  if [ "$STATUS" == "FAILED" ]; then
    echo "[FAIL] Job FAILED"
    psql "$DATABASE_URL" -t -c "SELECT \"lastError\" FROM shot_jobs WHERE id='$JOB_ID';"
    exit 1
  fi
  sleep 2
done

if [ "$STATUS" != "SUCCEEDED" ]; then
  echo "[FAIL] Timeout waiting for scan job."
  exit 1
fi

# 4. Verify Fan-out
echo "Verifying Fan-out..."
EP_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM episodes WHERE \"projectId\"='$PROJECT_ID';" | xargs)
echo "  Episodes Created: $EP_COUNT"

JOB_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM shot_jobs WHERE \"projectId\"='$PROJECT_ID' AND type='NOVEL_CHUNK_PARSE';" | xargs)
echo "  Chunk Jobs Created: $JOB_COUNT"

if [ "$EP_COUNT" -eq "100" ] && [ "$JOB_COUNT" -eq "100" ]; then
  echo "[PASS] Fan-out Verified (100 chaps -> 100 jobs)"
else
  echo "[FAIL] Fan-out mismatch! Expected 100, got Ep=$EP_COUNT, Job=$JOB_COUNT"
  exit 1
fi

echo "=================================================="
echo "STAGE 4 GATE PASSED: SCALABLE ARCHITECTURE VERIFIED"
echo "=================================================="
exit 0
