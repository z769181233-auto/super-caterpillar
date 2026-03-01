#!/bin/bash
set -euo pipefail

source tools/smoke/.auth_env
: "${API_BASE_URL:?API_BASE_URL missing}"
: "${AUTH_COOKIE_HEADER:?AUTH_COOKIE_HEADER missing (Please run ensure_auth_state.ts first)}"

if [ -z "${TEST_PROJECT_ID:-}" ]; then
  echo "[verify_seasons] TEST_PROJECT_ID missing, creating temporary project..."
  PROJECT_RESP="$(curl -s -H "$AUTH_COOKIE_HEADER" -H "Content-Type: application/json" -X POST "${API_BASE_URL}/api/projects" -d '{"name":"Seasons Verify Project"}')"
  
  # 使用 tsx 健壮地从 JSON 响应中提取 ID (data.id 或 id)
  TEST_PROJECT_ID=$(pnpm -w exec tsx -e "
    try {
      const resp = JSON.parse(process.argv[1]);
      const id = resp.data?.id || resp.id;
      if (!id) throw new Error('No id in response');
      console.log(id);
    } catch (e) {
      process.exit(1);
    }
  " "$PROJECT_RESP" || echo "")

  if [ -z "$TEST_PROJECT_ID" ]; then
    echo "❌ Failed to create temporary project or extract ID. Response: $PROJECT_RESP"
    exit 1
  fi
  echo "[verify_seasons] Created Project ID: $TEST_PROJECT_ID"
fi
export TEST_PROJECT_ID

echo "[verify_seasons] POST /api/projects/${TEST_PROJECT_ID}/seasons"
POST_CODE="$(curl -s -o /tmp/verify_seasons_post.json -w "%{http_code}" \
  -H "$AUTH_COOKIE_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Season"}' \
  "${API_BASE_URL}/api/projects/${TEST_PROJECT_ID}/seasons" || echo "000")"

cat /tmp/verify_seasons_post.json || true
echo ""
echo "[verify_seasons] post_code=$POST_CODE"

# 201/200/409(已存在也算路由工作) 视你们业务决定
if [ "$POST_CODE" != "200" ] && [ "$POST_CODE" != "201" ] && [ "$POST_CODE" != "409" ]; then
  echo "❌ verify_seasons POST failed"
  exit 1
fi

echo "[verify_seasons] GET /api/projects/${TEST_PROJECT_ID}/seasons"
GET_CODE="$(curl -s -o /tmp/verify_seasons_get.json -w "%{http_code}" \
  -H "$AUTH_COOKIE_HEADER" \
  "${API_BASE_URL}/api/projects/${TEST_PROJECT_ID}/seasons" || echo "000")"

cat /tmp/verify_seasons_get.json || true
echo ""
echo "[verify_seasons] get_code=$GET_CODE"

if [ "$GET_CODE" != "200" ]; then
  echo "❌ verify_seasons GET failed"
  exit 1
fi

echo "✅ verify_seasons OK"
