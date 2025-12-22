#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API_URL="${API_URL:-http://localhost:3000}"
AUTH_TOKEN_A="${AUTH_TOKEN_A:-}"
SHOT_ID="${SHOT_ID:-}"
CONCURRENT="${CONCURRENT:-10}"
REQUESTS="${REQUESTS:-100}"
JOB_TYPE="${JOB_TYPE:-VIDEO_RENDER}"

EVID_DIR="$REPO_ROOT/docs/_evidence"
mkdir -p "$EVID_DIR"

ts="$(date +%Y%m%d_%H%M%S)"
api_out="$EVID_DIR/capacity_api_${ts}.json"

if [ -z "$AUTH_TOKEN_A" ]; then
  echo "AUTH_TOKEN_A is required" >&2
  exit 2
fi
if [ -z "$SHOT_ID" ]; then
  echo "SHOT_ID is required" >&2
  exit 2
fi

node "$REPO_ROOT/tools/load/api_smoke_load.js" \
  --url "$API_URL" \
  --concurrent "$CONCURRENT" \
  --requests "$REQUESTS" \
  --shot-id "$SHOT_ID" \
  --job-type "$JOB_TYPE" \
  --auth-token "$AUTH_TOKEN_A" \
  --json true \
  --out "$api_out"

echo "$api_out"


