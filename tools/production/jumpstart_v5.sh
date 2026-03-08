#!/usr/bin/env bash
set -euo pipefail

# jumpstart_v5.sh
PROJECT_ID="wangu_ep1_v5"
ORG_ID="org-wangu-prod"
TRACE_ID=$(psql -At -c "SELECT \"traceId\" FROM shot_jobs WHERE id = 'job-pipe-wangu_ep1_v5';" postgresql://postgres:password@localhost:5434/scu)
N_ID="n-wangu_ep1_v5"
EP_ID="ep-wangu_ep1_v5"
SC_ID="sc-wangu_ep1_v5"
SH_ID="sh-wangu_ep1_v5"
ROOT_JOB_ID="job-pipe-wangu_ep1_v5"
DATABASE_URL="postgresql://postgres:password@localhost:5434/scu"

echo "Using TraceID: $TRACE_ID"

JOB_ID="job-ce06-jumpstart-${PROJECT_ID}"

# Construct Payload for CE06
JSON_PAYLOAD=$(python3 -c "import json, sys; print(json.dumps({'novelSourceId': sys.argv[1], 'projectId': sys.argv[2], 'rootJobId': sys.argv[3], 'traceId': sys.argv[4], 'organizationId': sys.argv[5], 'episodeId': sys.argv[6], 'sceneId': sys.argv[7], 'shotId': sys.argv[8]}))" "${N_ID}" "${PROJECT_ID}" "${ROOT_JOB_ID}" "${TRACE_ID}" "${ORG_ID}" "${EP_ID}" "${SC_ID}" "${SH_ID}")

echo "Injecting CE06 Job..."
psql "${DATABASE_URL}" -c "INSERT INTO shot_jobs (id, \"projectId\", \"organizationId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, priority, payload, \"createdAt\", \"updatedAt\", \"traceId\") VALUES ('${JOB_ID}', '${PROJECT_ID}', '${ORG_ID}', '${EP_ID}', '${SC_ID}', '${SH_ID}', 'CE06_NOVEL_PARSING', 'PENDING', 200, '${JSON_PAYLOAD//\'/\'\'}', NOW(), NOW(), '${TRACE_ID}') ON CONFLICT (id) DO NOTHING;"

echo "Binding Engine..."
BIND_ID="bind-ce06-${PROJECT_ID}"
# Use a trick to get around potential missing fields in current prisma client view if needed, but SQL is safest
psql "${DATABASE_URL}" -c "INSERT INTO job_engine_bindings (id, \"jobId\", \"engineKey\", status, \"createdAt\", \"updatedAt\") VALUES ('${BIND_ID}', '${JOB_ID}', 'ce06_novel_parsing', 'BOUND', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;"

echo "SUCCESS: CE06 Injected. Pipeline should start shortly."
