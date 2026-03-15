#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Preserve externally injected env (E2E/CI) before loading smoke env file
ORIG_DATABASE_URL="${DATABASE_URL:-}"
ORIG_JWT_SECRET="${JWT_SECRET:-}"
ORIG_API_SECRET_KEY="${API_SECRET_KEY:-}"
ORIG_HMAC_SECRET_KEY="${HMAC_SECRET_KEY:-}"
ORIG_ENGINE_DEFAULT="${ENGINE_DEFAULT:-}"
ORIG_DISABLE_REDIS="${DISABLE_REDIS:-}"
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
if [ -n "$ORIG_API_SECRET_KEY" ]; then export API_SECRET_KEY="$ORIG_API_SECRET_KEY"; fi
if [ -n "$ORIG_HMAC_SECRET_KEY" ]; then export HMAC_SECRET_KEY="$ORIG_HMAC_SECRET_KEY"; fi
if [ -n "$ORIG_ENGINE_DEFAULT" ]; then export ENGINE_DEFAULT="$ORIG_ENGINE_DEFAULT"; fi
if [ -n "$ORIG_DISABLE_REDIS" ]; then export DISABLE_REDIS="$ORIG_DISABLE_REDIS"; fi
if [ -n "$ORIG_REDIS_URL" ]; then export REDIS_URL="$ORIG_REDIS_URL"; fi

# dev/smoke only defaults (never for production)
if [ "${NODE_ENV:-}" != "production" ]; then
  if [ -z "${JWT_SECRET:-}" ]; then
    export JWT_SECRET="scu_smoke_jwt_secret__dev_only__32+chars"
    echo "[smoke] JWT_SECRET not set; injected dev default"
  fi
  if [ -z "${API_SECRET_KEY:-}" ]; then
    export API_SECRET_KEY="scu_smoke_api_secret__dev_only__32+chars"
    echo "[smoke] API_SECRET_KEY not set; injected dev default"
  fi
  if [ -z "${HMAC_SECRET_KEY:-}" ]; then
    export HMAC_SECRET_KEY="scu_smoke_hmac_secret__dev_only__32+chars"
    echo "[smoke] HMAC_SECRET_KEY not set; injected dev default"
  fi
  if [ -z "${ENGINE_DEFAULT:-}" ]; then
    export ENGINE_DEFAULT="ce06_novel_parsing"
    echo "[smoke] ENGINE_DEFAULT not set; injected dev default"
  fi
  if [ -z "${DISABLE_REDIS:-}" ]; then
    export DISABLE_REDIS="true"
    echo "[smoke] DISABLE_REDIS not set; using disabled mode"
  fi
  if [ -z "${REDIS_URL:-}" ]; then
    export REDIS_URL="disabled"
    echo "[smoke] REDIS_URL not set; injected disabled sentinel"
  fi
fi

# 强制显式注入必需环境变量（不允许默认值fallback，避免测试假绿）
export JWT_SECRET="${JWT_SECRET:?JWT_SECRET required}"
export API_SECRET_KEY="${API_SECRET_KEY:?API_SECRET_KEY required}"
export HMAC_SECRET_KEY="${HMAC_SECRET_KEY:?HMAC_SECRET_KEY required}"
export ENGINE_DEFAULT="${ENGINE_DEFAULT:?ENGINE_DEFAULT required}"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export REDIS_URL="${REDIS_URL:-disabled}"

# Log masked DATABASE_URL
echo "[API START] DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/')"
echo "[API START] DATABASE_URL_EFFECTIVE=$(echo "$DATABASE_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1***@#')"

# Unique log file for each run
API_LOG_FILE="/tmp/scu_api_smoke_$(date +%Y%m%d_%H%M%S)_$$.log"
echo "$API_LOG_FILE" > /tmp/scu_api_smoke_last.logpath

echo "[start_api] API_LOG_FILE=$API_LOG_FILE"
echo "[start_api] DATABASE_URL=$(echo $DATABASE_URL | sed 's/:[^@]*@/:***@/')"

# In CI/gate runs, prefer the same startup path as the workflow to avoid local
# dist/module-resolution drift from masking the real gate behavior.
if [ -n "${CI:-}" ] || [ "${GATE_ENV_MODE:-}" = "ci" ]; then
  echo "[start_api] CI/gate mode detected; using pnpm --filter api start"
  pnpm --filter api start > "$API_LOG_FILE" 2>&1 &
elif [ -f "apps/api/dist/main.js" ]; then
  echo "[start_api] Using pre-built dist/main.js"
  export NODE_ENV=development
  node apps/api/dist/main.js > "$API_LOG_FILE" 2>&1 &
else
  echo "[start_api] dist/main.js not found, falling back to pnpm dev"
  pnpm --filter api run dev > "$API_LOG_FILE" 2>&1 &
fi
API_PID=$!
echo "$API_PID" > /tmp/scu_api_smoke.pid

echo "[start_api] API started with PID $API_PID"
echo "[start_api] DATABASE_URL (env check)=${DATABASE_URL}"
