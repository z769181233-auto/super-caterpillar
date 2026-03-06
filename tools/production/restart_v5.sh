#!/usr/bin/env bash
set -euo pipefail

# restart_v5.sh
PROJECT_ID="wangu_ep1_v5"
ORG_ID="org-wangu-prod"
TRACE_ID="trace_wangu_ep1_v5_$(date +"%Y%m%d_%H%M%S")"
EP_ID="ep-wangu_ep1_v5"
SC_ID="sc-wangu_ep1_v5"
SH_ID="sh-wangu_ep1_v5"
N_ID="n-wangu_ep1_v5"
DATABASE_URL="postgresql://postgres:password@localhost:5434/scu"

echo "Check Project..."
psql "${DATABASE_URL}" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', '萬古神帝 - 第一集 (V5 旗艦)', 'user-wangu-prod', 'org-wangu-prod', 'in_progress', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"

echo "Ensure Skeleton..."
psql "${DATABASE_URL}" -c "INSERT INTO episodes (id, \"projectId\", index, name) VALUES ('${EP_ID}', '${PROJECT_ID}', 1, '第1章：重生') ON CONFLICT (id) DO NOTHING;"
psql "${DATABASE_URL}" -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, title, created_at, updated_at) VALUES ('${SC_ID}', '${EP_ID}', '${PROJECT_ID}', 1, '開場', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
psql "${DATABASE_URL}" -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", index, type) VALUES ('${SH_ID}', '${SC_ID}', '${ORG_ID}', 1, 'DEFAULT') ON CONFLICT (id) DO NOTHING;"
psql "${DATABASE_URL}" -c "INSERT INTO novels (id, project_id, title, organization_id, status, created_at, updated_at) VALUES ('${N_ID}', '${PROJECT_ID}', '萬古神帝 第一章', '${ORG_ID}', 'UPLOADING', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"

echo "Triggering Job..."
RAW_TEXT=$(cat "docs/_specs/wangu_ep1_source.txt")
JSON_PAYLOAD=$(python3 -c "import json, sys; print(json.dumps({'novelId': sys.argv[1], 'projectId': sys.argv[2], 'traceId': sys.argv[3], 'rawText': sys.argv[4], 'organizationId': sys.argv[5], 'episodeId': sys.argv[6], 'sceneId': sys.argv[7], 'shotId': sys.argv[8]}))" "${N_ID}" "${PROJECT_ID}" "${TRACE_ID}" "${RAW_TEXT}" "${ORG_ID}" "${EP_ID}" "${SC_ID}" "${SH_ID}")

PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
# Use a temporary file for the SQL to avoid shell length limits
echo "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\") VALUES ('${PIPE_JOB_ID}', '${PROJECT_ID}', '${ORG_ID}', '${EP_ID}', '${SC_ID}', '${SH_ID}', 'PIPELINE_PROD_VIDEO_V1', 'PENDING', 100, '${JSON_PAYLOAD//\'/\'\'}', NOW(), NOW(), '${TRACE_ID}') ON CONFLICT (id) DO NOTHING;" > /tmp/v5_trigger.sql

psql "${DATABASE_URL}" -f /tmp/v5_trigger.sql
rm /tmp/v5_trigger.sql

echo "SUCCESS: v5 Triggered."
