#!/usr/bin/env bash
set -euo pipefail

EVD_DIR="docs/_evidence/p9_2b/b3"
mkdir -p "$EVD_DIR"

API_PUBLIC_URL="${API_PUBLIC_URL:-}"
PAGES_PUBLIC_URL="${PAGES_PUBLIC_URL:-}"
HEALTH_PATH="${HEALTH_PATH:-}"

fail() { echo "ERROR: $*" | tee "$EVD_DIR/error.txt" >&2; exit 1; }

if [[ -z "$API_PUBLIC_URL" || -z "$PAGES_PUBLIC_URL" || -z "$HEALTH_PATH" ]]; then
  cat <<USAGE
Missing required env vars.
Usage:
  API_PUBLIC_URL="https://xxx.up.railway.app" \\
  PAGES_PUBLIC_URL="https://xxx.pages.dev" \\
  HEALTH_PATH="/api/health" \\
  bash scripts/p9_2b_b3_probe.sh
USAGE
  exit 2
fi

API_PUBLIC_URL="${API_PUBLIC_URL%/}"
PAGES_PUBLIC_URL="${PAGES_PUBLIC_URL%/}"
if [[ "$HEALTH_PATH" != /* ]]; then HEALTH_PATH="/$HEALTH_PATH"; fi

echo "API_PUBLIC_URL=$API_PUBLIC_URL" >  "$EVD_DIR/input_sanitized.txt"
echo "PAGES_PUBLIC_URL=$PAGES_PUBLIC_URL" >> "$EVD_DIR/input_sanitized.txt"
echo "HEALTH_PATH=$HEALTH_PATH" >> "$EVD_DIR/input_sanitized.txt"

API_HEALTH_URL="${API_PUBLIC_URL}${HEALTH_PATH}"

# curl common flags: fail on HTTP errors? we still want body/headers for evidence
CURL_COMMON=(-sS --connect-timeout 10 --max-time 20)

echo "Probing API: $API_HEALTH_URL"
if ! curl "${CURL_COMMON[@]}" -D - -o /dev/null "$API_HEALTH_URL" | tee "$EVD_DIR/api_health_headers.txt" >/dev/null; then
  fail "curl headers failed for API_HEALTH_URL=$API_HEALTH_URL"
fi

if ! curl "${CURL_COMMON[@]}" "$API_HEALTH_URL" | head -c 2048 | tee "$EVD_DIR/api_health_body_head2k.txt" >/dev/null; then
  fail "curl body failed for API_HEALTH_URL=$API_HEALTH_URL"
fi

if ! curl "${CURL_COMMON[@]}" -o /dev/null -w "%{http_code}\n" "$API_HEALTH_URL" \
  | tee "$EVD_DIR/api_health_http_code.txt" >/dev/null; then
  fail "curl http_code failed for API_HEALTH_URL=$API_HEALTH_URL"
fi

echo "Probing Web: $PAGES_PUBLIC_URL"
if ! curl "${CURL_COMMON[@]}" -L -o /dev/null -w "%{http_code}\n" "${PAGES_PUBLIC_URL}/" \
  | tee "$EVD_DIR/pages_root_http_code.txt" >/dev/null; then
  fail "curl http_code failed for PAGES_PUBLIC_URL=${PAGES_PUBLIC_URL}/"
fi

if ! curl "${CURL_COMMON[@]}" -D - -o /dev/null "${PAGES_PUBLIC_URL}/" \
  | tee "$EVD_DIR/pages_root_headers.txt" >/dev/null; then
  fail "curl headers failed for PAGES_PUBLIC_URL=${PAGES_PUBLIC_URL}/"
fi

API_CODE="$(tr -d '\r\n' < "$EVD_DIR/api_health_http_code.txt" || true)"
PAGES_CODE="$(tr -d '\r\n' < "$EVD_DIR/pages_root_http_code.txt" || true)"

# Lightweight semantic checks (no assumptions on schema)
API_BODY_SAMPLE="$(tr -d '\r' < "$EVD_DIR/api_health_body_head2k.txt" | head -c 256)"
API_BODY_NONEMPTY="false"
if [[ -n "${API_BODY_SAMPLE//[[:space:]]/}" ]]; then API_BODY_NONEMPTY="true"; fi

# If API returns HTML, flag it (common for platform error pages)
API_BODY_IS_HTML="false"
if echo "$API_BODY_SAMPLE" | grep -qi "<html"; then API_BODY_IS_HTML="true"; fi

# Detect API Mode
API_MODE="real"
if grep -q '"mode":"stub"' "$EVD_DIR/api_health_body_head2k.txt"; then
  API_MODE="stub"
fi

{
  echo "api_health_url=$API_HEALTH_URL"
  echo "api_health_http_code=$API_CODE"
  echo "api_mode=$API_MODE"
  echo "api_health_body_nonempty=$API_BODY_NONEMPTY"
  echo "api_health_body_is_html=$API_BODY_IS_HTML"
  echo "pages_root_url=${PAGES_PUBLIC_URL}/"
  echo "pages_root_http_code=$PAGES_CODE"
  echo "timestamp_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} > "$EVD_DIR/verdict.txt"

# Evidence index snippet (copy-paste into EVIDENCE_INDEX.md)
cat > "$EVD_DIR/evidence_index_snippet.md" <<SNIP
### P9.2B · Stage B.3 Integration Probe Evidence
- docs/_evidence/p9_2b/b3/secret_sanity.txt
- docs/_evidence/p9_2b/b3/input_sanitized.txt
- docs/_evidence/p9_2b/b3/api_health_headers.txt
- docs/_evidence/p9_2b/b3/api_health_body_head2k.txt
- docs/_evidence/p9_2b/b3/api_health_http_code.txt
- docs/_evidence/p9_2b/b3/pages_root_headers.txt
- docs/_evidence/p9_2b/b3/pages_root_http_code.txt
- docs/_evidence/p9_2b/b3/verdict.txt
- docs/_evidence/p9_2b/b3/evidence_index_snippet.md
SNIP

echo "OK: Evidence written under $EVD_DIR"
