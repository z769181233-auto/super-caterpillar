#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# -------- config --------
API_URL="${API_URL:-http://localhost:3000}"

# 你的 HMAC key/secret，优先使用环境变量；没有则默认开发值（与既有 gate 习惯保持一致）
API_KEY="${API_KEY:-dev-worker-key}"
API_SECRET="${API_SECRET:-dev-worker-secret}"

NOVEL_TEXT="${NOVEL_TEXT:-在遥远的星系中，有一只向往自由的毛毛虫，它正在拼命对抗重力。}"

EVIDENCE_DIR="docs/_evidence/STAGE1_GATE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[FATAL] missing cmd: $1"; exit 10; }; }
require_cmd curl
require_cmd jq
require_cmd node
require_cmd openssl
require_cmd ffmpeg
require_cmd ffprobe

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[FATAL] DATABASE_URL is not set. Please: set -a && source .env.local && set +a"
  exit 11
fi

# -------- helpers --------
hmac_headers() {
  local method="$1"
  local path="$2"
  local ts="$3"
  local body="$4"
  local nonce
  nonce="$(openssl rand -hex 16)"

  # 输出 4 行 header，供外部循环拼接 -H
  node - <<'NODE' "$API_KEY" "$API_SECRET" "$nonce" "$ts" "$body"
const crypto = require('crypto');

const apiKey = process.argv[2];
const secret = process.argv[3];
const nonce = process.argv[4];
const timestamp = process.argv[5];
const body = process.argv[6] ?? "";

// V1.1: message = apiKey + nonce + timestamp + body
const msg = `${apiKey}${nonce}${timestamp}${body}`;
const sig = crypto.createHmac('sha256', secret).update(msg).digest('hex');

console.log(`X-Api-Key: ${apiKey}`);
console.log(`X-Nonce: ${nonce}`);
console.log(`X-Timestamp: ${timestamp}`);
console.log(`X-Signature: ${sig}`);
NODE
}

# -------- main --------
echo "🚀 [Gate-Stage1] START (Novel -> Video real pipeline trigger + wait gate-p0-video-1 PASS)"

TS="$(date +%s)"

# 这里 payload 的字段名必须与后端契约一致：
# 由于你当前 stage1 gate 脚本已损坏无法作为依据，先用最常见字段 novelText。
# 如果后端实际字段不同，curl response 会告诉你缺哪个字段，然后再按后端契约改。
PAYLOAD="$(jq -cn --arg novelText "$NOVEL_TEXT" '{novelText:$novelText}')"
echo "$PAYLOAD" > "$EVIDENCE_DIR/01_payload.json"

HEADERS_RAW="$(hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS" "$PAYLOAD")"
CURL_H=()
while IFS= read -r h; do
  [[ -n "$h" ]] && CURL_H+=(-H "$h")
done <<<"$HEADERS_RAW"

set +e
HTTP_CODE="$(curl -sS -o "$EVIDENCE_DIR/02_trigger_response.json" -w "%{http_code}" \
  -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_H[@]}" \
  -d "$PAYLOAD")"
CURL_RC=$?
set -e

echo "$HEADERS_RAW" > "$EVIDENCE_DIR/02_trigger_headers.txt"
echo "$HTTP_CODE" > "$EVIDENCE_DIR/02_trigger_http_code.txt"

if [[ $CURL_RC -ne 0 ]]; then
  echo "[FATAL] curl failed rc=$CURL_RC"
  exit 20
fi

# 允许 200/201/202（异步启动）
if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  echo "[FATAL] trigger stage1 failed: http=$HTTP_CODE"
  echo "[HINT] see $EVIDENCE_DIR/02_trigger_response.json"
  cat "$EVIDENCE_DIR/02_trigger_response.json" || true
  exit 21
fi

echo "[OK] stage1 triggered. http=$HTTP_CODE"

# -------- 加固：验证 renderJobIds 非空（防止假闭环） --------
JOB_ID="$(jq -r '.data.jobId // .jobId // empty' "$EVIDENCE_DIR/02_trigger_response.json")"
if [[ -z "$JOB_ID" ]]; then
  echo "[FATAL] Cannot extract jobId from response"
  cat "$EVIDENCE_DIR/02_trigger_response.json"
  exit 22
fi

echo "[CHECK] Waiting for jobId=$JOB_ID to complete..."
for i in $(seq 1 24); do
  STATUS="$(psql "$DATABASE_URL" -At -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" 2>/dev/null || echo 'PENDING')"
  if [[ "$STATUS" == "SUCCEEDED" ]]; then
    echo "[OK] Job $JOB_ID SUCCEEDED."
    break
  elif [[ "$STATUS" == "FAILED" ]]; then
    ERROR_MSG="$(psql "$DATABASE_URL" -At -c "SELECT result->'error' FROM shot_jobs WHERE id='$JOB_ID';" 2>/dev/null || echo 'unknown error')"
    echo "[FATAL] Job $JOB_ID FAILED! Error: $ERROR_MSG"
    exit 24
  fi
  echo "[WAIT] Job status: $STATUS (round $i/24, sleep 5s)"
  sleep 5
done

RENDER_JOB_IDS="$(psql "$DATABASE_URL" -At -c "SELECT result->'output'->'renderJobIds' FROM shot_jobs WHERE id='$JOB_ID';" 2>/dev/null || echo '[]')"
echo "$RENDER_JOB_IDS" > "$EVIDENCE_DIR/02_renderJobIds.json"

if [[ "$RENDER_JOB_IDS" == "[]" || "$RENDER_JOB_IDS" == "null" || -z "$RENDER_JOB_IDS" ]]; then
  echo "[FATAL] ❌ renderJobIds is empty! Pipeline did not trigger render jobs."
  echo "[FATAL] This indicates processStage1OrchestratorJob空跑 (empty orchestration)"
  echo "[FATAL] renderJobIds=$RENDER_JOB_IDS"
  echo "[HINT] Fix processStage1OrchestratorJob to create SHOT_RENDER/VIDEO_RENDER jobs"
  exit 23
fi

echo "[OK] ✅ renderJobIds is non-empty: $RENDER_JOB_IDS"
echo "[INFO] waiting for real VIDEO asset & mp4 until gate-p0-video-1 PASS..."

# 等待：每 10s 跑一次 gate-p0-video-1.sh，最多 15 分钟（90 次）
MAX=90
for i in $(seq 1 "$MAX"); do
  if bash tools/gate/gates/gate-p0-video-1.sh >"$EVIDENCE_DIR/03_gate_p0_video_1_round_${i}.log" 2>&1; then
    echo "[PASS] gate-p0-video-1 PASSED at round=$i"
    echo "[PASS] evidence=$EVIDENCE_DIR"
    exit 0
  fi
  echo "[WAIT] round=$i/$MAX (sleep 10s)"
  sleep 10
done

echo "[FAIL] timeout: gate-p0-video-1 did not pass within $((MAX*10)) seconds"
echo "[HINT] inspect evidence logs in $EVIDENCE_DIR"
exit 30
