#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# gate-s3-scale-event-dag.sh
# Verifies: Multi-worker concurrency, Event-Driven DAG, and Stage-1 regression

# === Configuration ===
API_URL="${API_URL:-http://127.0.0.1:3000}"
CURL_BIN="${CURL_BIN:-curl}"
CURL_OPTS=(--ipv4 --max-time 15 --connect-timeout 5 -sS)
EVIDENCE_DIR="docs/_evidence/S3_SCALE_EVENT_DAG_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${EVIDENCE_DIR}"

# Load environment (safe)
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

API_KEY="${TEST_API_KEY:?missing TEST_API_KEY in .env.local}"
API_SECRET="${API_SECRET_KEY:?missing API_SECRET_KEY in .env.local}"
TEST_TOKEN="${TEST_TOKEN:-scu_smoke_key}"
export TEST_TOKEN

echo "🚀 [Gate-S3] START: Event-Driven DAG + Multi-Worker Concurrency"
echo "📂 Evidence Directory: ${EVIDENCE_DIR}"

# === Cleanup Function ===
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "node dist/main" || true
    pkill -f "stage3-mock-worker" || true
    pkill -f "apps/workers/src/main.ts" || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT
cleanup

# === Helper: Generate HMAC Headers ===
generate_hmac_headers() {
  local method=$1
  local path=$2
  local timestamp=$3
  local body=$4

  local input
  input=$(jq -n \
    --arg apiKey "$API_KEY" \
    --arg apiSecret "$API_SECRET" \
    --arg timestamp "$timestamp" \
    --arg method "$method" \
    --arg path "$path" \
    --arg body "$body" \
    '{"apiKey":$apiKey, "apiSecret":$apiSecret, "timestamp":$timestamp, "method":$method, "path":$path, "body":$body}')

  npx tsx tools/gate/scripts/hmac_v11_headers.ts "$input"
}

# === 1. Start API ===
echo "🔌 Starting API..."
cd apps/api
GATE_MODE=1 VERIFICATION_MODE=1 HMAC_DEBUG=1 PORT=3000 node dist/main > "../../${EVIDENCE_DIR}/api.log" 2>&1 &
API_PID=$!
cd ../..

# Wait for API to be ready
echo "⏳ Waiting for API to LISTEN on 127.0.0.1:3000..."
max_retries=60
retries=0
connected=0
while [ $retries -lt $max_retries ]; do
    if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
        echo "✅ API is LISTENING on 3000"
        connected=1
        break
    fi
    if ! ps -p "$API_PID" >/dev/null 2>&1; then
        echo "❌ API process exited unexpectedly."
        tail -50 "${EVIDENCE_DIR}/api.log" || true
        exit 1
    fi
    sleep 1
    retries=$((retries+1))
    echo -n "."
done
echo ""

if [ $connected -eq 0 ]; then
    echo "❌ Timeout: API failed to start on 3000"
    exit 1
fi

sleep 5

# --- HMAC Probe ---
echo "🧪 HMAC_V2 Probe..."
PROBE_TS=$(date +%s)
PROBE_PAYLOAD=$(jq -n --arg nt "probe" '{"novelText":$nt}')
PROBE_HEADERS_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$PROBE_TS" "$PROBE_PAYLOAD")
PROBE_CURL_ARGS=()
while read -r h; do PROBE_CURL_ARGS+=(-H "$h"); done <<< "$PROBE_HEADERS_RAW"

PROBE_RESP=$("${CURL_BIN}" "${CURL_OPTS[@]}" -w "\nHTTP_CODE:%{http_code}" -X POST "${API_URL}/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${PROBE_CURL_ARGS[@]}" \
  --data-binary "$PROBE_PAYLOAD")

echo "$PROBE_RESP" | tee "${EVIDENCE_DIR}/hmac_probe.json"
PROBE_CODE=$(echo "$PROBE_RESP" | grep "HTTP_CODE" | cut -d: -f2)
if [[ ! "$PROBE_CODE" =~ ^20[0-2]$ ]]; then
  echo "❌ FAIL: HMAC_V2 Probe failed with HTTP $PROBE_CODE"
  exit 1
fi
echo "✅ HMAC_V2 Probe PASS"

# === PART A: Multi-Worker Concurrency & Event-Driven DAG ===
echo ""
echo "--- 🟢 PART A: Multi-Worker Concurrency & Event-Driven DAG ---"

echo "👷 Starting 3 Mock Workers..."
for i in 1 2 3; do
  WORKER_SUFFIX=$i API_URL="http://127.0.0.1:3000" TEST_TOKEN="${TEST_TOKEN}" npx ts-node tools/gate/mocks/stage3-mock-worker.ts > "${EVIDENCE_DIR}/worker_$i.log" 2>&1 &
done
sleep 15

echo "🎬 Triggering Stage 1 Pipeline for Part A..."
TS_A=$(date +%s)
PAYLOAD_A=$(jq -n --arg nt "Part A: Event-driven DAG content..." '{"novelText":$nt}')
HEADERS_A_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS_A" "$PAYLOAD_A")
CURL_ARGS_A=()
while read -r h; do CURL_ARGS_A+=(-H "$h"); done <<< "$HEADERS_A_RAW"

RESPONSE_A=$(curl -s -X POST "${API_URL}/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS_A[@]}" \
  --data-binary "$PAYLOAD_A")

echo "$RESPONSE_A" | tee "${EVIDENCE_DIR}/trigger_partA.json"
PROJECT_ID_A=$(echo "$RESPONSE_A" | jq -r '.data.projectId // .data.id')
if [ -z "$PROJECT_ID_A" ] || [ "$PROJECT_ID_A" == "null" ]; then
    echo "❌ FAIL: Cannot extract projectId from Part A response"
    exit 1
fi
echo "{\"projectId\":\"$PROJECT_ID_A\"}" | tee "${EVIDENCE_DIR}/project_id_partA.json"
echo "✅ Part A Project ID: $PROJECT_ID_A"

echo "⏳ Waiting for VIDEO_RENDER job creation (DB-LEVEL)..."
max_wait=60
found_video_job=0
for i in $(seq 1 $max_wait); do
    VIDEO_COUNT=$(npx tsx -e "
      import { PrismaClient } from '@prisma/client';
      const prisma=new PrismaClient();
      async function run() {
        try {
          const c = await prisma.shotJob.count({ where: { projectId: '$PROJECT_ID_A', type: 'VIDEO_RENDER' } });
          process.stdout.write(c.toString());
        } catch (e) {
          process.stdout.write('0');
        }
      }
      run().finally(() => prisma.\$disconnect());
    " 2>/dev/null)
    if [[ "$VIDEO_COUNT" =~ ^[1-9][0-9]*$ ]]; then
        echo "✅ DAG Trigger Detected: VIDEO_RENDER job created"
        found_video_job=1
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

if [ $found_video_job -eq 0 ]; then
    echo "❌ Timeout waiting for VIDEO_RENDER spawning"
    exit 1
fi

pkill -f "stage3-mock-worker" || true
echo "✅ Part A Complete"

# === PART B: Stage-1 Regression (Real Worker) ===
echo ""
echo "--- 🟢 PART B: Stage-1 Real Worker Regression ---"
echo "🛠 Starting Real Worker..."
export GATE_MODE=true RENDER_ENGINE=ffmpeg JOB_POLL_INTERVAL=1000
npx ts-node apps/workers/src/main.ts > "${EVIDENCE_DIR}/real_worker.log" 2>&1 &
sleep 10

echo "🎬 Triggering Stage 1 Pipeline for Part B..."
TS_B=$(date +%s)
PAYLOAD_B=$(jq -n --arg nt "Part B: Real regression content..." '{"novelText":$nt}')
HEADERS_B_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS_B" "$PAYLOAD_B")
CURL_ARGS_B=()
while read -r h; do CURL_ARGS_B+=(-H "$h"); done <<< "$HEADERS_B_RAW"

RESPONSE_B=$(curl -s -X POST "${API_URL}/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS_B[@]}" \
  --data-binary "$PAYLOAD_B")

echo "$RESPONSE_B" | tee "${EVIDENCE_DIR}/trigger_partB.json"
PROJECT_ID_B=$(echo "$RESPONSE_B" | jq -r '.projectId // .id')
if [ -z "$PROJECT_ID_B" ] || [ "$PROJECT_ID_B" == "null" ]; then
    echo "❌ FAIL: Cannot extract projectId from Part B response"
    exit 1
fi
echo "✅ Part B Project ID: $PROJECT_ID_B"

echo "⏳ Waiting for PublishedVideo (Regression)..."
max_wait=120
found_published=0
for i in $(seq 1 $max_wait); do
    TS_G=$(date +%s)
    HEADERS_G_RAW=$(generate_hmac_headers "GET" "/api/publish/videos?projectId=${PROJECT_ID_B}" "$TS_G" "")
    CURL_ARGS_G=()
    while read -r h; do CURL_ARGS_G+=(-H "$h"); done <<< "$HEADERS_G_RAW"
    
    VIDEO_QUERY=$(curl -s -X GET "${API_URL}/api/publish/videos?projectId=${PROJECT_ID_B}" "${CURL_ARGS_G[@]}" || echo "{}")
    FINAL_STATUS=$(echo "$VIDEO_QUERY" | jq -r '.[0].status // "PENDING"')
    
    if [[ "$FINAL_STATUS" == "PUBLISHED" || "$FINAL_STATUS" == "INTERNAL_READY" ]]; then
        found_published=1
        echo "$VIDEO_QUERY" > "${EVIDENCE_DIR}/video_status_final.json"
        break
    fi
    sleep 5
    echo -n "."
done
echo ""

if [ $found_published -eq 0 ]; then
    echo "❌ Timeout waiting for PublishedVideo"
    exit 1
fi
echo "✅ Regression Pass: status=$FINAL_STATUS"

# === HARD ASSERTIONS ===
echo "🔒 Running Hard Assertions..."
DB_ASSERT_INPUT=$(jq -n --arg a "${PROJECT_ID_A}" --arg b "${PROJECT_ID_B}" '{"projectA":$a, "projectB":$b}')
DB_RESULT=$(npx tsx tools/gate/scripts/s3_db_assert.ts "$DB_ASSERT_INPUT" 2>&1)
echo "$DB_RESULT" | tee "${EVIDENCE_DIR}/db_assert.json"
if ! echo "$DB_RESULT" | jq -e '.success' >/dev/null; then
    echo "❌ FAIL: DB assertions failed"
    exit 1
fi

echo "🔍 Authorization guard test..."
COMPLETED_JOB_ID=$(npx tsx -e "
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  prisma.shotJob.findFirst({
    where: { projectId: '$PROJECT_ID_A', status: 'SUCCEEDED' },
    select: { id: true }
  }).then(j => { console.log(j?.id || '') });
" 2>/dev/null | tail -1)

if [ -n "$COMPLETED_JOB_ID" ]; then
    WRONG_WORKER_ID="unauthorized-worker-999"
    TS_AUTH=$(date +%s)
    AUTH_PAYLOAD=$(jq -n --arg jid "$COMPLETED_JOB_ID" --arg wid "$WRONG_WORKER_ID" --arg status "SUCCEEDED" '{"jobId":$jid, "workerId":$wid, "status":$status}')
    HEADERS_AUTH_RAW=$(generate_hmac_headers "POST" "/api/worker/job/complete" "$TS_AUTH" "$AUTH_PAYLOAD")
    CURL_ARGS_AUTH=()
    while read -r h; do CURL_ARGS_AUTH+=(-H "$h"); done <<< "$HEADERS_AUTH_RAW"
    
    AUTH_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "${API_URL}/api/worker/job/complete" -H "Content-Type: application/json" "${CURL_ARGS_AUTH[@]}" -d "$AUTH_PAYLOAD")
    echo "$AUTH_RESP" | tee "${EVIDENCE_DIR}/unauthorized_test.json"
    if [[ "$AUTH_RESP" == *"HTTP_CODE:403"* ]]; then
        echo "✅ PASS: Unauthorized complete rejected"
    else
        echo "❌ FAIL: Unauthorized complete NOT rejected"
        exit 1
    fi
fi

# --- Final Evidence Indexing ---
echo "📑 Generating EVIDENCE_INDEX.json..."
sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

# Truncate large API log for summary
if [ -f "${EVIDENCE_DIR}/api.log" ]; then
  tail -n 200 "${EVIDENCE_DIR}/api.log" > "${EVIDENCE_DIR}/api.log.truncated"
fi

cat > "${EVIDENCE_DIR}/EVIDENCE_INDEX.json" <<EOF
{
  "gate": "gate-s3-scale-event-dag",
  "ts": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "evidenceDir": "$(basename "${EVIDENCE_DIR}")",
  "files": [
    {"name":"api.log.truncated","sha256":"$(sha256_file "${EVIDENCE_DIR}/api.log.truncated")"},
    {"name":"db_assert.json","sha256":"$(sha256_file "${EVIDENCE_DIR}/db_assert.json")"},
    {"name":"unauthorized_test.json","sha256":"$(sha256_file "${EVIDENCE_DIR}/unauthorized_test.json")"},
    {"name":"project_id_partA.json","sha256":"$(sha256_file "${EVIDENCE_DIR}/project_id_partA.json" 2>/dev/null || echo 'n/a')"},
    {"name":"project_id_partB.json","sha256":"$(sha256_file "${EVIDENCE_DIR}/project_id_partB.json" 2>/dev/null || echo 'n/a')"}
  ]
}
EOF

echo "🎉 ✅ Gate S3 TOTAL PASS"
exit 0
