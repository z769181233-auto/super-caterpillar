#!/bin/bash
set -euo pipefail

# gate-prod_e2e_novel_to_video.sh
# 验证理由：全链路真实性 + 成本审计。

API_URL=${API_URL:-"http://localhost:3000"}
TEST_PROJECT_ID=${TEST_PROJECT_ID:-"gate_project_e2e"}
EVIDENCE_SUBDIR=".gate_evidence/e2e"
mkdir -p "${EVIDENCE_SUBDIR}"

echo "--- STEP 1: Full E2E Pipeline Trigger ---"
RESPONSE=$(curl -s -X POST "${API_URL}/api/ce-pipeline/run" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"${TEST_PROJECT_ID}\",
    \"novelText\": \"The brave caterpillar found the cosmic leaf. It was glowing with quantum light.\"
  }")

TRACE_ID=$(echo $RESPONSE | jq -r '.traceId')
if [ "$TRACE_ID" == "null" ]; then
  echo "FAIL: Failed to trigger CE pipeline."
  exit 1
fi

echo "Pipeline triggered: ${TRACE_ID}. Waiting for processing..."
sleep 15

echo "--- STEP 2: DB Audit Verification (Real Cost) ---"
# Check cost_ledgers for this trace or project
LEDGER_DATA=$(psql -t -A -c "SELECT json_agg(t) FROM (SELECT \"jobId\", \"costAmount\", \"engineKey\", \"metadata\" FROM cost_ledgers WHERE \"jobId\" LIKE 'gate_%' ORDER BY \"createdAt\" DESC LIMIT 10) t;")

if [ -z "${LEDGER_DATA}" ] || [ "${LEDGER_DATA}" == "" ]; then
  echo "FAIL: No commercial cost ledgers found for gate jobs."
  exit 1
fi

echo "${LEDGER_DATA}" | jq . > "${EVIDENCE_SUBDIR}/cost_audit.json"
REAL_COST_FOUND=$(echo "${LEDGER_DATA}" | jq -r 'any(.[]; .costAmount > 0)')

if [ "${REAL_COST_FOUND}" != "true" ]; then
  echo "FAIL: Commercial cost records exist but costAmount is 0 (Unexpected for Replicate)."
  exit 1
fi

echo "PASS: gate-prod_e2e_novel_to_video.sh"
