#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

# Use fixed smoke user by default (avoid DB pollution)
AUTH_EMAIL="${AUTH_EMAIL:-smoke@example.com}"
AUTH_PASSWORD="${AUTH_PASSWORD:-smoke-dev-password}"

# --- helpers ---

# prints token if found, else empty
extract_body_token() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      .accessToken // .token // .jwt //
      .data.accessToken? // .data.token? // .data.jwt? //
      empty
    ' 2>/dev/null || true
  else
    grep -oE '"(accessToken|token|jwt)"\s*:\s*"[^"]+"' \
      | head -n1 \
      | cut -d'"' -f4 || true
  fi
}

# prints token if found in headers, else empty
extract_cookie_token() {
  tr -d '\r' \
    | awk '
      BEGIN{IGNORECASE=1}
      /^Set-Cookie:[[:space:]]*accessToken=/{ 
        sub(/^Set-Cookie:[[:space:]]*accessToken=/,"");
        split($0,a,";");
        print a[1];
        exit
      }
    ' || true
}

post_json() {
  local path="$1"
  local payload="$2"
  local out_headers="$3"
  local out_body="$4"
  local code_file="$5"

  curl -sS -X POST "${API_URL}${path}" \
    -H "Content-Type: application/json" \
    -D "$out_headers" \
    -o "$out_body" \
    -w "%{http_code}" \
    -d "$payload" > "$code_file" || echo "000" > "$code_file"
}

mint_via_login() {
  local tmp="${1}"
  local h="${tmp}/h.txt" b="${tmp}/b.json" c="${tmp}/c.txt"
  local payload
  payload="$(printf '{"email":"%s","password":"%s"}' "$AUTH_EMAIL" "$AUTH_PASSWORD")"
  post_json "/api/auth/login" "$payload" "$h" "$b" "$c"
  local code; code="$(cat "$c")"

  local tok=""
  tok="$(cat "$b" | extract_body_token || true)"
  if [ -z "$tok" ]; then
    tok="$(cat "$h" | extract_cookie_token || true)"
  fi

  if [ -n "$tok" ]; then
    printf "%s" "$tok"
    return 0
  fi

  return 1
}

ensure_register() {
  local tmp="${1}"
  local h="${tmp}/rh.txt" b="${tmp}/rb.json" c="${tmp}/rc.txt"
  local payload
  payload="$(printf '{"email":"%s","password":"%s"}' "$AUTH_EMAIL" "$AUTH_PASSWORD")"
  post_json "/api/auth/register" "$payload" "$h" "$b" "$c"
  local code; code="$(cat "$c")"

  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
    return 0
  fi

  if [ "$code" = "400" ] || [ "$code" = "409" ]; then
    return 0
  fi

  echo "[mint_auth_token] register failed (HTTP $code)" >&2
  echo "  headers: $(tr -d '\r' <"$h" | head -n 20 | tr '\n' ' ' | head -c 300)" >&2
  echo "  body: $(cat "$b" | head -c 300)" >&2
  return 1
}

# --- main ---

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# 1) login first (idempotent)
if tok="$(mint_via_login "$TMP_DIR" || true)"; then
  if [ -n "$tok" ]; then
    echo "$tok"
    exit 0
  fi
fi

# 2) ensure user exists
if ! ensure_register "$TMP_DIR"; then
  exit 1
fi

# 3) login again
if tok="$(mint_via_login "$TMP_DIR" || true)"; then
  if [ -n "$tok" ]; then
    echo "$tok"
    exit 0
  fi
fi

echo "[mint_auth_token] failed to obtain token via login/register/login" >&2
echo "  tip: export AUTH_EMAIL / AUTH_PASSWORD to override" >&2
exit 1

