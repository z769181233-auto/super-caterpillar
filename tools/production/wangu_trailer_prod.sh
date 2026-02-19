#!/usr/bin/env bash
set -euo pipefail

# wangu_trailer_prod.sh
# 触发《万古神帝》预告片全链路生产 (PIPELINE_PROD_VIDEO_V1)

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
cd "$ROOT"

PROJECT_ID="wangu_trailer_$(date +"%Y%m%d_%H%M%S")"
TRACE_ID="trace_${PROJECT_ID}"
NOVEL_SOURCE_PATH="docs/_specs/wangu_trailer_source.txt"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

echo "=================================================="
echo "STARTING WANGU TRAILER PRODUCTION"
echo "ProjectID: ${PROJECT_ID}"
echo "Source:    ${NOVEL_SOURCE_PATH}"
echo "=================================================="

db() {
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -X -q "$@"
}

# 1. Seed User/Org
echo "[Prod] Checking User & Org..."
db -c "INSERT INTO users (id, email, \"passwordHash\", tier, \"createdAt\", \"updatedAt\") VALUES ('user-wangu-prod', 'wangu-prod@test.com', 'hash', 'Pro', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
db -c "INSERT INTO organizations (id, name, slug, \"ownerId\", \"createdAt\", \"updatedAt\") VALUES ('org-wangu-prod', 'Wangu Prod Org', 'wangu-prod', 'user-wangu-prod', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"
db -c "INSERT INTO organization_members (id, \"organizationId\", \"userId\", role, \"createdAt\", \"updatedAt\") VALUES ('om-wangu-prod', 'org-wangu-prod', 'user-wangu-prod', 'OWNER', NOW(), NOW()) ON CONFLICT (\"userId\", \"organizationId\") DO NOTHING;"
# Inject Credits for Production Test
db -c "UPDATE organizations SET credits = 999999 WHERE id = 'org-wangu-prod';"

# 2. Create Project
echo "[Prod] Creating Project..."
db -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"createdAt\", \"updatedAt\") VALUES ('${PROJECT_ID}', '万古神帝预告片', 'user-wangu-prod', 'org-wangu-prod', 'in_progress', NOW(), NOW());"

# 3. Create Skeleton (Episode -> Scene -> Shot)
echo "[Prod] Creating Skeleton..."
EP_ID="ep-${PROJECT_ID}"
SC_ID="sc-${PROJECT_ID}"
SH_ID="sh-${PROJECT_ID}"

# episodes: NO createdAt/updatedAt
db -c "INSERT INTO episodes (id, \"projectId\", index, name) VALUES ('${EP_ID}', '${PROJECT_ID}', 1, 'Trailer Episode');"
# scenes: snake_case for timestamps, camelCase for episodeId
db -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, title, created_at, updated_at) VALUES ('${SC_ID}', '${EP_ID}', '${PROJECT_ID}', 1, 'Main Scene', NOW(), NOW());"
# shots: NO timestamps, camelCase for relations
db -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", index, type) VALUES ('${SH_ID}', '${SC_ID}', 'org-wangu-prod', 1, 'DEFAULT');"

# 4. Create Novel Record
echo "[Prod] Creating Novel Records..."
N_ID="n-${PROJECT_ID}"
db -c "INSERT INTO novels (id, project_id, title, organization_id, status, created_at, updated_at) VALUES ('${N_ID}', '${PROJECT_ID}', '万古神帝 第一章', 'org-wangu-prod', 'UPLOADING', NOW(), NOW());"

# 5. Trigger Pipeline
echo "[Prod] Triggering PIPELINE_PROD_VIDEO_V1..."
PIPE_JOB_ID="job-pipe-${PROJECT_ID}"
RAW_TEXT=$(cat "${NOVEL_SOURCE_PATH}")

# Construct JSON payload
JSON_PAYLOAD=$(python3 -c "import json, sys; print(json.dumps({'novelId': sys.argv[1], 'projectId': sys.argv[2], 'traceId': sys.argv[3], 'raw_text': sys.argv[4], 'organizationId': 'org-wangu-prod', 'episodeId': sys.argv[5], 'sceneId': sys.argv[6], 'shotId': sys.argv[7]}))" "${N_ID}" "${PROJECT_ID}" "${TRACE_ID}" "${RAW_TEXT}" "${EP_ID}" "${SC_ID}" "${SH_ID}")

db -c "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\") VALUES ('${PIPE_JOB_ID}', '${PROJECT_ID}', 'org-wangu-prod', '${EP_ID}', '${SC_ID}', '${SH_ID}', 'PIPELINE_PROD_VIDEO_V1', 'PENDING', 100, '${JSON_PAYLOAD//\'/\'\'}', NOW(), NOW(), '${TRACE_ID}');"

echo "=================================================="
echo "PIPELINE TRIGGERED: ${PIPE_JOB_ID}"
echo "Monitor using: psql \"${DATABASE_URL}\" -c \"SELECT type, status, \"createdAt\" FROM shot_jobs WHERE \\\"projectId\\\"='${PROJECT_ID}' ORDER BY \\\"createdAt\\\" DESC\""
echo "=================================================="
