#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

# --- begin robust preflight ---
if ! curl -sS --connect-timeout 1 --max-time 2 "$API_URL/api/health" >/dev/null 2>&1 \
   && ! curl -sS --connect-timeout 1 --max-time 2 "$API_URL/health" >/dev/null 2>&1; then
  echo "[probe] API not reachable at $API_URL (start it first)."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

H="$TMP_DIR/h.txt"; B="$TMP_DIR/b.txt"; C="$TMP_DIR/c.txt"
touch "$H" "$B" "$C"
# --- end robust preflight ---

AUTH_TOKEN_A="${AUTH_TOKEN_A:-}"
if [ -z "$AUTH_TOKEN_A" ]; then
  AUTH_TOKEN_A="$(bash tools/smoke/mint_auth_token.sh)"
fi
AUTH_HEADER_A="Authorization: Bearer ${AUTH_TOKEN_A}"

echo "[probe] API_URL=$API_URL"
echo "[probe] tokenA_prefix=$(echo "$AUTH_TOKEN_A" | head -c 12)..."

echo "== Gate2 /api/jobs/capacity =="
echo "[no-auth] HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/jobs/capacity" || echo 000)"
echo "[auth A]  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_HEADER_A" "$API_URL/api/jobs/capacity" || echo 000)"
CAP_BODY="$TMP_DIR/cap_body.json"
curl -s -D "$H" -o "$CAP_BODY" -H "$AUTH_HEADER_A" "$API_URL/api/jobs/capacity" | head -n 30 || true
echo "[body] $(cat "$CAP_BODY" | head -c 300 || true)"

echo
echo "== Gate3 /api/storage/sign/:key =="
TEST_STORAGE_KEY="${TEST_STORAGE_KEY:-}"
if [ -z "$TEST_STORAGE_KEY" ] && [ -x tools/smoke/seed_storage_key.sh ]; then
  TEST_STORAGE_KEY="$(bash tools/smoke/seed_storage_key.sh)"
fi
echo "[probe] TEST_STORAGE_KEY=${TEST_STORAGE_KEY:-<none>}"

if [ -n "${TEST_STORAGE_KEY:-}" ]; then
  echo "[direct] HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/storage/$TEST_STORAGE_KEY" || echo 000) (expect 404)"
  echo "[sign A] HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_HEADER_A" "$API_URL/api/storage/sign/$TEST_STORAGE_KEY" || echo 000)"
  SIGN_JSON="$(curl -s -H "$AUTH_HEADER_A" "$API_URL/api/storage/sign/$TEST_STORAGE_KEY" || true)"
  echo "[sign body] $(echo "$SIGN_JSON" | head -c 300)"
fi

