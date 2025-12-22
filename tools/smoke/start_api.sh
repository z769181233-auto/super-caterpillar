#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Preserve externally injected env (E2E/CI) before loading smoke env file
ORIG_DATABASE_URL="${DATABASE_URL:-}"
ORIG_JWT_SECRET="${JWT_SECRET:-}"
ORIG_REDIS_URL="${REDIS_URL:-}"

SMOKE_ENV_FILE="${SMOKE_ENV_FILE:-tools/smoke/.env.smoke.local}"
if [ -f "$SMOKE_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$SMOKE_ENV_FILE"
  set +a
fi

# 外部注入优先：E2E/CI 传进来的值不能被 .env.smoke.local 覆盖
if [ -n "$ORIG_DATABASE_URL" ]; then export DATABASE_URL="$ORIG_DATABASE_URL"; fi
if [ -n "$ORIG_JWT_SECRET" ]; then export JWT_SECRET="$ORIG_JWT_SECRET"; fi
if [ -n "$ORIG_REDIS_URL" ]; then export REDIS_URL="$ORIG_REDIS_URL"; fi

# dev/smoke only defaults (never for production)
if [ "${NODE_ENV:-}" != "production" ]; then
  if [ -z "${JWT_SECRET:-}" ]; then
    export JWT_SECRET="scu_smoke_jwt_secret__dev_only__32+chars"
    echo "[smoke] JWT_SECRET not set; injected dev default"
  fi
fi

# 强制显式注入必需环境变量（不允许默认值fallback，避免测试假绿）
export JWT_SECRET="${JWT_SECRET:?JWT_SECRET required}"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

# Log masked DATABASE_URL
echo "[API START] DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/')"
echo "[API START] DATABASE_URL_EFFECTIVE=$(echo "$DATABASE_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#')"

# Unique log file for each run
API_LOG_FILE="/tmp/scu_api_smoke_$(date +%Y%m%d_%H%M%S)_$$.log"
echo "$API_LOG_FILE" > /tmp/scu_api_smoke_last.logpath

echo "[start_api] API_LOG_FILE=$API_LOG_FILE"
echo "[start_api] DATABASE_URL=$(echo $DATABASE_URL | sed 's/:[^@]*@/:***@/')"

# Use pre-built main.js if available to avoid webpack overhead in smoke tests
if [ -f "apps/api/dist/main.js" ]; then
  echo "[start_api] Using pre-built dist/main.js"
  export NODE_ENV=development # Use development for smoke even on pre-built dist
  # Note: production mode might require some envs, but for smoke it should be fine as we injected them above
  node apps/api/dist/main.js > "$API_LOG_FILE" 2>&1 &
else
  echo "[start_api] dist/main.js not found, falling back to pnpm dev"
  pnpm --filter api run dev > "$API_LOG_FILE" 2>&1 &
fi
API_PID=$!
echo "$API_PID" > /tmp/scu_api_smoke.pid

echo "[start_api] API started with PID $API_PID"
echo "[start_api] DATABASE_URL (env check)=${DATABASE_URL}"
