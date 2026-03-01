#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3000}"
API_BASE_URL="${API_BASE_URL:-http://localhost:${PORT}}"
API_URL="${API_URL:-$API_BASE_URL}"
API_LOG_FILE="${API_LOG_FILE:-$REPO_ROOT/.tmp/scu_api_smoke.log}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu?schema=public}"

mkdir -p "$(dirname "$API_LOG_FILE")"

echo "[start_api_smoke] REPO_ROOT=$REPO_ROOT"
echo "[start_api_smoke] PORT=$PORT"
echo "[start_api_smoke] API_URL=$API_URL"
echo "[start_api_smoke] API_LOG_FILE=$API_LOG_FILE"
echo "[start_api_smoke] DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#')"

if [ "${FORCE_KILL_PORT:-0}" = "1" ]; then
  pids="$(lsof -ti tcp:${PORT} || true)"
  if [ -n "$pids" ]; then
    echo "[start_api_smoke] killing pids on port $PORT: $pids"
    kill $pids || true
    sleep 2
  fi
fi

if lsof -ti tcp:${PORT} >/dev/null 2>&1; then
  echo "[start_api_smoke] port $PORT already in use; not starting new API"
else
  echo "[start_api_smoke] starting API..."
  (
    cd "$REPO_ROOT"
    export NODE_ENV="${NODE_ENV:-development}"
    export PORT="$PORT"
    export DATABASE_URL="$DATABASE_URL"
    pnpm --filter api dev
  ) >"$API_LOG_FILE" 2>&1 &
  echo $! > "$REPO_ROOT/.tmp/api.pid"
fi

wait_2xx() {
  local url="$1"
  local max_sec="${2:-60}"
  local start
  start="$(date +%s)"
  while true; do
    code="$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 --max-time 2 "$url" || echo 000)"
    echo "[wait] $url -> $code"
    if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
      return 0
    fi
    now="$(date +%s)"
    if [ $((now - start)) -ge "$max_sec" ]; then
      return 1
    fi
    sleep 1
  done
}

READY_OK=0
for u in \
  "$API_URL/api/health/ready" \
  "$API_URL/health/ready" \
  "$API_URL/api/health" \
  "$API_URL/health"
do
  if wait_2xx "$u" 60; then
    READY_OK=1
    echo "[start_api_smoke] ready via $u"
    break
  fi
done

if [ "$READY_OK" != "1" ]; then
  echo "[start_api_smoke] ERROR: API not ready; tail log:"
  tail -n 200 "$API_LOG_FILE" || true
  exit 1
fi

echo "[start_api_smoke] OK"


