#!/bin/bash
set -euo pipefail

# Setup
export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export ORCHESTRATOR_ENABLED=true
export JOB_WORKER_ENABLED=false
export HEARTBEAT_TTL_SECONDS=10
export STORAGE_ROOT="${STORAGE_ROOT:-${REPO_ROOT}/.data/storage}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@127.0.0.1:5432/scu?schema=public}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
export API_URL="${API_URL:-$API_BASE_URL}"

echo "=== Stage 8 Video E2E Test ==="
echo "Repo: $REPO_ROOT"
echo "Storage: $STORAGE_ROOT"
# 打印 DATABASE_URL 指纹（屏蔽密码，仅用于确认 seed/API/worker 是否指向同一库）
echo "[Env] DATABASE_URL=${DATABASE_URL:-<not set>}" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#'

# Prisma client ensure (before any tsx scripts)
if [ -x "$REPO_ROOT/tools/smoke/ensure_prisma_generated.sh" ]; then
  bash "$REPO_ROOT/tools/smoke/ensure_prisma_generated.sh"
fi

# 支持 seed-only 模式（只取 Shot ID/Frame keys，不跑后续）
E2E_SEED_ONLY="${E2E_SEED_ONLY:-0}"

# 1. Clean & Init
rm -rf "$STORAGE_ROOT/temp/seed"
mkdir -p "$STORAGE_ROOT"

# Ensure API Key exists
echo "[0/4] Initializing API Key..."
npx tsx tools/smoke/init_api_key.ts

# Set Env for Trigger Script (Align with init_api_key.ts defaults)
export API_KEY="${API_KEY:-ak_smoke_test_key_v1}"
export API_SECRET="${API_SECRET:-scu_smoke_secret}"

wait_for_2xx() {
  local url="$1"
  local max_sec="${2:-60}"
  local start
  start="$(date +%s)"

  while true; do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 --max-time 2 "$url" || echo 000)"
    echo "[wait] $url -> HTTP $code"

    if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
      return 0
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start)) -ge "$max_sec" ]; then
      echo "[wait] TIMEOUT after ${max_sec}s: $url"
      return 1
    fi
    sleep 1
  done
}

dump_api_diag() {
  echo "===== API DIAG BEGIN ====="
  echo "[diag] API_URL=$API_URL"
  echo "[diag] API_PID=${API_PID:-<none>}"

  echo "[diag] lsof 3000"
  lsof -nP -iTCP:3000 -sTCP:LISTEN || true

  echo "[diag] ps api pid"
  if [ -n "${API_PID:-}" ]; then
    ps -p "$API_PID" -o pid,ppid,command || true
  fi

  echo "[diag] curl health candidates"
  curl -s -i --max-time 2 "${API_URL}/api/health/ready" || true
  curl -s -i --max-time 2 "${API_URL}/health/ready" || true
  curl -s -i --max-time 2 "${API_URL}/api/health" || true
  curl -s -i --max-time 2 "${API_URL}/health" || true

  echo "[diag] tail api log"
  if [ -n "${API_LOG_FILE:-}" ] && [ -f "${API_LOG_FILE:-}" ]; then
    tail -n 200 "$API_LOG_FILE" || true
  else
    echo "[diag] API_LOG_FILE not set or file missing"
  fi

  echo "===== API DIAG END ====="
}

# 2. Seed Data
echo "[1/4] Seeding Data..."
# We pass flags to seed script to use smoke org/user if needed, or update seed script logic
SEED_OUTPUT=$(npx tsx tools/smoke/e2e_video_seed.ts | tail -n 1)
SHOT_ID=$(echo "$SEED_OUTPUT" | jq -r .shotId)
FRAME_KEYS=$(echo "$SEED_OUTPUT" | jq -r .frameKeys) # This is a JSON array string

echo "Shot ID: $SHOT_ID"
echo "Frames: $FRAME_KEYS"

if [ "$E2E_SEED_ONLY" = "1" ]; then
  echo "[E2E] seed-only mode: exiting after seed"
  exit 0
fi

export SHOT_ID
echo "[E2E] Assert shot exists in DB (seed DB)..."
npx tsx tools/smoke/assert_shot_exists.ts

E2E_FORCE_RESTART_API="${E2E_FORCE_RESTART_API:-false}"

kill_port_3000_if_needed() {
  local pids
  pids=$(lsof -ti tcp:3000 || true)
  if [ -n "$pids" ]; then
    if [ "$E2E_FORCE_RESTART_API" = "true" ]; then
      echo "[E2E] Port 3000 is in use, force restarting API (pids: $pids)"
      kill $pids || true
      sleep 2
    else
      echo "[E2E] Port 3000 is in use, reusing existing API (E2E_FORCE_RESTART_API=false)"
    fi
  fi
}

kill_port_3000_if_needed

# 3. Start Services (force using same DATABASE_URL)
API_LOG_FILE="${API_LOG_FILE:-$REPO_ROOT/.tmp/scu_api_smoke.log}"
mkdir -p "$(dirname "$API_LOG_FILE")"
export API_LOG_FILE

if ! lsof -i:3000 -t >/dev/null 2>&1; then
    echo "API is not running. Starting API via tools/smoke/start_api.sh..."
    bash tools/smoke/start_api.sh >"$API_LOG_FILE" 2>&1 &
    API_PID=$!
else
    echo "API already running on port 3000; skipping start_api.sh"
fi

echo "[E2E] Waiting for API ready..."
READY_OK=false
if wait_for_2xx "${API_URL}/api/health/ready" 60; then READY_OK=true; fi
if [ "$READY_OK" != "true" ] && wait_for_2xx "${API_URL}/health/ready" 60; then READY_OK=true; fi
if [ "$READY_OK" != "true" ] && wait_for_2xx "${API_URL}/api/health" 60; then READY_OK=true; fi
if [ "$READY_OK" != "true" ] && wait_for_2xx "${API_URL}/health" 60; then READY_OK=true; fi

if [ "$READY_OK" != "true" ]; then
  echo "[E2E] API not ready; dumping diagnostics"
  dump_api_diag
  exit 1
fi
echo "[E2E] API ready ✅"

# 启动 Worker（同一个 DATABASE_URL / API）
echo "[2/4] Starting Worker App..."
WORKER_LOG_FILE="${WORKER_LOG_FILE:-$REPO_ROOT/.tmp/worker.log}"
mkdir -p "$(dirname "$WORKER_LOG_FILE")"
(
  cd apps/workers && \
  JOB_WORKER_ENABLED=true \
  GATE_MODE=0 \
  IGNORE_ENV_FILE="${IGNORE_ENV_FILE:-true}" \
  JWT_SECRET="${JWT_SECRET:-}" \
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}" \
  API_SECRET_KEY="${API_SECRET_KEY:-}" \
  HMAC_SECRET_KEY="${HMAC_SECRET_KEY:-}" \
  ENGINE_DEFAULT="${ENGINE_DEFAULT:-ce06_novel_parsing}" \
  REDIS_URL="${REDIS_URL:-}" \
  DISABLE_REDIS="${DISABLE_REDIS:-}" \
  DATABASE_URL="${DATABASE_URL:-}" \
  PRISMA_CLIENT_ENGINE_TYPE="${PRISMA_CLIENT_ENGINE_TYPE:-binary}" \
  PRISMA_CLI_QUERY_ENGINE_TYPE="${PRISMA_CLI_QUERY_ENGINE_TYPE:-binary}" \
  API_BASE_URL="${API_BASE_URL:-http://localhost:3000}" \
  API_URL="${API_URL:-http://localhost:3000}" \
  WORKER_ID="${WORKER_ID:-local-worker}" \
  WORKER_API_KEY="${WORKER_API_KEY:-ak_smoke_test_key_v1}" \
  WORKER_API_SECRET="${WORKER_API_SECRET:-scu_smoke_secret}" \
  pnpm dev
) > "$WORKER_LOG_FILE" 2>&1 &
WORKER_PID=$!
sleep 2
if ! kill -0 "$WORKER_PID" >/dev/null 2>&1; then
  echo "[E2E] Worker exited immediately; dumping worker log..."
  tail -n 200 "$WORKER_LOG_FILE" || true
  exit 1
fi
echo "Waiting for worker to ready..."
sleep 20
echo "[E2E] Worker log fingerprint (first 120 lines)..."
tail -n 120 "$WORKER_LOG_FILE" || true

cleanup_pids() {
  if [ -n "${WORKER_PID:-}" ] && kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    kill "$WORKER_PID" || true
  fi
  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" || true
  fi
}
trap cleanup_pids EXIT

# Export for TS script
export SHOT_ID
export FRAME_KEYS

# 4. Trigger & Poll (Auth handled by TS script)
echo "[3/4] Triggering & Polling..."
JOB_RESULT=$(npx tsx tools/smoke/trigger_and_poll_video.ts)

if [ $? -ne 0 ]; then
  echo "Job Verification Failed"
  echo "$JOB_RESULT"
  echo "----- worker.log tail (last 200) -----"
  tail -n 200 "$WORKER_LOG_FILE" || true
  exit 1
fi

echo "Job SUCCEEDED!"
# Parse Result
RESULT=$(echo "$JOB_RESULT" | jq -r .result)
VIDEO_KEY=$(echo "$RESULT" | jq -r .videoKey)

echo "Video Key: $VIDEO_KEY"

# Verify File Existence locally
if [ ! -f "$STORAGE_ROOT/$VIDEO_KEY" ]; then
        echo "XX File missing on disk: $STORAGE_ROOT/$VIDEO_KEY"
        ls -l "$STORAGE_ROOT"
        exit 1
fi

# Verify Serving via signed URL (统一走 /api/storage/sign + signed)
echo "[E2E] Verify serve via signed URL..."

# Source auth env if not already present
if [ -z "${AUTH_COOKIE_HEADER:-}" ]; then
  if [ -f "tools/smoke/.auth_env" ]; then
    source tools/smoke/.auth_env
  else
    echo "❌ tools/smoke/.auth_env not found. Run ensure_auth_state.ts first."
    exit 1
  fi
fi

# Use Cookie header instead of Bearer token
SIGN_JSON="$(curl -s -H "$AUTH_COOKIE_HEADER" "$API_BASE_URL/api/storage/sign/$VIDEO_KEY")"
SIGNED_URL="$(echo "$SIGN_JSON" | jq -r '.url')"

if [ -z "$SIGNED_URL" ] || [ "$SIGNED_URL" = "null" ]; then
  echo "XX Sign failed: $SIGN_JSON"
  echo "Dump API Log (Tail 100):"
  tail -n 100 "$API_LOG_FILE"
  exit 1
fi

echo "[E2E] Signed URL: $SIGNED_URL"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Range: bytes=0-1023" "$SIGNED_URL")
if [ "$HTTP_CODE" != "206" ] && [ "$HTTP_CODE" != "200" ]; then
  echo "XX Signed serve failed: $HTTP_CODE url=$SIGNED_URL"
  echo "Response Body:"
  curl -v -H "Range: bytes=0-1023" "$SIGNED_URL" || true
  echo "Dump API Log (Tail 100):"
  tail -n 100 "$API_LOG_FILE"
  exit 1
fi

echo "✅ Verification Passed: Disk File + Signed URL HTTP $HTTP_CODE"
exit 0
