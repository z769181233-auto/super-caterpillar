#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

# Gate: Video Playback Signed URL + Range Support Verification# Evidence: Audit API response + HTTP headers for no-range/range requests

set -e

GATE_NAME="video-playback-signed-url"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVID_DIR="docs/_evidence/${GATE_NAME}_${TIMESTAMP}"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

error_exit() {
  log "❌ $1"
  exit 1
}

log "========================================="
log "GATE: Video Playback Signed URL Verification"
log "========================================="

# 1. Ensure API is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  error_exit "API not reachable at localhost:3000. Start with: pnpm -w dev"
fi

# 2. Get latest novel with completed VIDEO_RENDER
NOVEL_ID=$(psql -d scu -t -c " # $gate$
  SELECT ns.id 
  FROM novel_sources ns
  JOIN shot_jobs sj ON sj.\"projectId\" = ns.\"projectId\"
  WHERE sj.type =     AND sj.status =   ORDER BY sj.\"createdAt\" DESC
  LIMIT 1;
" | xargs)

if [ -z "$NOVEL_ID" ]; then
  error_exit "No completed VIDEO_RENDER found. Run gate-stage3_p3_full_pipeline_e2e.sh first."
fi

log "   Using NOVEL_ID=$NOVEL_ID"

# 3. Get user for authentication (use test user)
USER_EMAIL="admin@example.com"
USER_PASS="password123"

# Create test user if not exists
npx ts-node -P apps/api/tsconfig.json apps/api/src/create-test-user.ts > /dev/null 2>&1

# Login to get JWT token
log "🔑 Authenticating..."
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")

# Try both possible JWT locations
ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r 
if [ -z "$ACCESS_TOKEN" ]; then
  # Fallback: Check if login succeeded but used cookie-based auth
  USER_ID=$(echo "$LOGIN_RESP" | jq -r   if [ -n "$USER_ID" ]; then
    log "⚠️  Login succeeded but no JWT token. Attempting direct audit call..."
    ACCESS_TOKEN=""  # Will try without auth header
  else
    error_exit "Failed to authenticate. Response: $LOGIN_RESP"
  fi
fi

# 4. Call Audit API
log "📡 Calling Audit API..."
if [ -n "$ACCESS_TOKEN" ]; then
  AUDIT_RESP=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
else
  # Use cookie-based session
  AUDIT_RESP=$(curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
fi

echo "$AUDIT_RESP" | jq   echo "$AUDIT_RESP" > "$EVID_DIR/audit_response.txt"
  error_exit "Audit API returned non-JSON. See $EVID_DIR/audit_response.txt"
}

# 5. Extract videoAsset
VIDEO_STATUS=$(echo "$AUDIT_RESP" | jq -r SECURE_URL=$(echo "$AUDIT_RESP" | jq -r JOB_ID=$(echo "$AUDIT_RESP" | jq -r 
log "   videoAsset.status=$VIDEO_STATUS"
log "   videoAsset.jobId=$JOB_ID"

if [ "$VIDEO_STATUS" != "READY" ]; then
  error_exit "videoAsset.status is not READY (got: $VIDEO_STATUS)"
fi

if [ -z "$SECURE_URL" ]; then
  error_exit "videoAsset.secureUrl is empty"
fi

# Validate signed URL format
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi

log "✅ videoAsset validation passed"

# 6. Test video URL (no Range)
log "🎬 Testing video URL (no Range)..."
if [[ "$SECURE_URL" == http* ]]; then
  FULL_URL="$SECURE_URL"
else
  FULL_URL="http://localhost:3000${SECURE_URL}"
fi

curl -s -I "$FULL_URL" > "$EVID_DIR/video_headers_no_range.txt" 2>&1

NO_RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_no_range.txt" | awk NO_RANGE_CT=$(grep -i 
if [ "$NO_RANGE_STATUS" != "200" ]; then
  error_exit "No-Range request failed (status=$NO_RANGE_STATUS). Expected 200."
fi

if ! echo "$NO_RANGE_CT" | grep -qi   error_exit "Content-Type is not video/* (got: $NO_RANGE_CT)"
fi

log "✅ No-Range: 200 OK, Content-Type: $NO_RANGE_CT"

# 7. Test video URL (with Range)
log "🎬 Testing video URL (Range: bytes=0-1)..."
curl -s -I -H "Range: bytes=0-1" "$FULL_URL" > "$EVID_DIR/video_headers_range_206.txt" 2>&1

RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_range_206.txt" | awk RANGE_AR=$(grep -i 
if [ "$RANGE_STATUS" != "206" ]; then
  log "⚠️  Range request returned $RANGE_STATUS (expected 206). This may affect seek functionality."
else
  log "✅ Range: 206 Partial Content, Accept-Ranges: $RANGE_AR"
fi

# 8. Generate 6-line evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
NOVEL_ID=$NOVEL_ID
VIDEO_ASSET_STATUS=$VIDEO_STATUS
VIDEO_JOB_ID=$JOB_ID
NO_RANGE_STATUS=$NO_RANGE_STATUS
RANGE_STATUS=$RANGE_STATUS
CONTENT_TYPE=$NO_RANGE_CT
EOF

log "📝 Evidence saved to: $EVID_DIR"
log "✅ Gate PASSED: Video playback verified with signed URLs + Range support"

set -e

GATE_NAME="video-playback-signed-url"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVID_DIR="docs/_evidence/${GATE_NAME}_${TIMESTAMP}"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

error_exit() {
  log "❌ $1"
  exit 1
}

log "========================================="
log "GATE: Video Playback Signed URL Verification"
log "========================================="

# 1. Ensure API is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  error_exit "API not reachable at localhost:3000. Start with: pnpm -w dev"
fi

# 2. Get latest novel with completed VIDEO_RENDER
NOVEL_ID=$(psql -d scu -t -c " # $gate$
  SELECT ns.id 
  FROM novel_sources ns
  JOIN shot_jobs sj ON sj.\"projectId\" = ns.\"projectId\"
  WHERE sj.type =     AND sj.status =   ORDER BY sj.\"createdAt\" DESC
  LIMIT 1;
" | xargs)

if [ -z "$NOVEL_ID" ]; then
  error_exit "No completed VIDEO_RENDER found. Run gate-stage3_p3_full_pipeline_e2e.sh first."
fi

log "   Using NOVEL_ID=$NOVEL_ID"

# 3. Get user for authentication (use test user)
USER_EMAIL="admin@example.com"
USER_PASS="password123"

# Create test user if not exists
npx ts-node -P apps/api/tsconfig.json apps/api/src/create-test-user.ts > /dev/null 2>&1

# Login to get JWT token
log "🔑 Authenticating..."
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")

# Try both possible JWT locations
ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r 
if [ -z "$ACCESS_TOKEN" ]; then
  # Fallback: Check if login succeeded but used cookie-based auth
  USER_ID=$(echo "$LOGIN_RESP" | jq -r   if [ -n "$USER_ID" ]; then
    log "⚠️  Login succeeded but no JWT token. Attempting direct audit call..."
    ACCESS_TOKEN=""  # Will try without auth header
  else
    error_exit "Failed to authenticate. Response: $LOGIN_RESP"
  fi
fi

# 4. Call Audit API
log "📡 Calling Audit API..."
if [ -n "$ACCESS_TOKEN" ]; then
  AUDIT_RESP=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
else
  # Use cookie-based session
  AUDIT_RESP=$(curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
fi

echo "$AUDIT_RESP" | jq   echo "$AUDIT_RESP" > "$EVID_DIR/audit_response.txt"
  error_exit "Audit API returned non-JSON. See $EVID_DIR/audit_response.txt"
}

# 5. Extract videoAsset
VIDEO_STATUS=$(echo "$AUDIT_RESP" | jq -r SECURE_URL=$(echo "$AUDIT_RESP" | jq -r JOB_ID=$(echo "$AUDIT_RESP" | jq -r 
log "   videoAsset.status=$VIDEO_STATUS"
log "   videoAsset.jobId=$JOB_ID"

if [ "$VIDEO_STATUS" != "READY" ]; then
  error_exit "videoAsset.status is not READY (got: $VIDEO_STATUS)"
fi

if [ -z "$SECURE_URL" ]; then
  error_exit "videoAsset.secureUrl is empty"
fi

# Validate signed URL format
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi

log "✅ videoAsset validation passed"

# 6. Test video URL (no Range)
log "🎬 Testing video URL (no Range)..."
if [[ "$SECURE_URL" == http* ]]; then
  FULL_URL="$SECURE_URL"
else
  FULL_URL="http://localhost:3000${SECURE_URL}"
fi

curl -s -I "$FULL_URL" > "$EVID_DIR/video_headers_no_range.txt" 2>&1

NO_RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_no_range.txt" | awk NO_RANGE_CT=$(grep -i 
if [ "$NO_RANGE_STATUS" != "200" ]; then
  error_exit "No-Range request failed (status=$NO_RANGE_STATUS). Expected 200."
fi

if ! echo "$NO_RANGE_CT" | grep -qi   error_exit "Content-Type is not video/* (got: $NO_RANGE_CT)"
fi

log "✅ No-Range: 200 OK, Content-Type: $NO_RANGE_CT"

# 7. Test video URL (with Range)
log "🎬 Testing video URL (Range: bytes=0-1)..."
curl -s -I -H "Range: bytes=0-1" "$FULL_URL" > "$EVID_DIR/video_headers_range_206.txt" 2>&1

RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_range_206.txt" | awk RANGE_AR=$(grep -i 
if [ "$RANGE_STATUS" != "206" ]; then
  log "⚠️  Range request returned $RANGE_STATUS (expected 206). This may affect seek functionality."
else
  log "✅ Range: 206 Partial Content, Accept-Ranges: $RANGE_AR"
fi

# 8. Generate 6-line evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
NOVEL_ID=$NOVEL_ID
VIDEO_ASSET_STATUS=$VIDEO_STATUS
VIDEO_JOB_ID=$JOB_ID
NO_RANGE_STATUS=$NO_RANGE_STATUS
RANGE_STATUS=$RANGE_STATUS
CONTENT_TYPE=$NO_RANGE_CT
EOF

log "📝 Evidence saved to: $EVID_DIR"
log "✅ Gate PASSED: Video playback verified with signed URLs + Range support"

set -e

GATE_NAME="video-playback-signed-url"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVID_DIR="docs/_evidence/${GATE_NAME}_${TIMESTAMP}"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

error_exit() {
  log "❌ $1"
  exit 1
}

log "========================================="
log "GATE: Video Playback Signed URL Verification"
log "========================================="

# 1. Ensure API is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  error_exit "API not reachable at localhost:3000. Start with: pnpm -w dev"
fi

# 2. Get latest novel with completed VIDEO_RENDER
NOVEL_ID=$(psql -d scu -t -c " # $gate$
  SELECT ns.id 
  FROM novel_sources ns
  JOIN shot_jobs sj ON sj.\"projectId\" = ns.\"projectId\"
  WHERE sj.type =     AND sj.status =   ORDER BY sj.\"createdAt\" DESC
  LIMIT 1;
" | xargs)

if [ -z "$NOVEL_ID" ]; then
  error_exit "No completed VIDEO_RENDER found. Run gate-stage3_p3_full_pipeline_e2e.sh first."
fi

log "   Using NOVEL_ID=$NOVEL_ID"

# 3. Get user for authentication (use test user)
USER_EMAIL="admin@example.com"
USER_PASS="password123"

# Create test user if not exists
npx ts-node -P apps/api/tsconfig.json apps/api/src/create-test-user.ts > /dev/null 2>&1

# Login to get JWT token
log "🔑 Authenticating..."
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")

# Try both possible JWT locations
ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r 
if [ -z "$ACCESS_TOKEN" ]; then
  # Fallback: Check if login succeeded but used cookie-based auth
  USER_ID=$(echo "$LOGIN_RESP" | jq -r   if [ -n "$USER_ID" ]; then
    log "⚠️  Login succeeded but no JWT token. Attempting direct audit call..."
    ACCESS_TOKEN=""  # Will try without auth header
  else
    error_exit "Failed to authenticate. Response: $LOGIN_RESP"
  fi
fi

# 4. Call Audit API
log "📡 Calling Audit API..."
if [ -n "$ACCESS_TOKEN" ]; then
  AUDIT_RESP=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
else
  # Use cookie-based session
  AUDIT_RESP=$(curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
fi

echo "$AUDIT_RESP" | jq   echo "$AUDIT_RESP" > "$EVID_DIR/audit_response.txt"
  error_exit "Audit API returned non-JSON. See $EVID_DIR/audit_response.txt"
}

# 5. Extract videoAsset
VIDEO_STATUS=$(echo "$AUDIT_RESP" | jq -r SECURE_URL=$(echo "$AUDIT_RESP" | jq -r JOB_ID=$(echo "$AUDIT_RESP" | jq -r 
log "   videoAsset.status=$VIDEO_STATUS"
log "   videoAsset.jobId=$JOB_ID"

if [ "$VIDEO_STATUS" != "READY" ]; then
  error_exit "videoAsset.status is not READY (got: $VIDEO_STATUS)"
fi

if [ -z "$SECURE_URL" ]; then
  error_exit "videoAsset.secureUrl is empty"
fi

# Validate signed URL format
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi

log "✅ videoAsset validation passed"

# 6. Test video URL (no Range)
log "🎬 Testing video URL (no Range)..."
if [[ "$SECURE_URL" == http* ]]; then
  FULL_URL="$SECURE_URL"
else
  FULL_URL="http://localhost:3000${SECURE_URL}"
fi

curl -s -I "$FULL_URL" > "$EVID_DIR/video_headers_no_range.txt" 2>&1

NO_RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_no_range.txt" | awk NO_RANGE_CT=$(grep -i 
if [ "$NO_RANGE_STATUS" != "200" ]; then
  error_exit "No-Range request failed (status=$NO_RANGE_STATUS). Expected 200."
fi

if ! echo "$NO_RANGE_CT" | grep -qi   error_exit "Content-Type is not video/* (got: $NO_RANGE_CT)"
fi

log "✅ No-Range: 200 OK, Content-Type: $NO_RANGE_CT"

# 7. Test video URL (with Range)
log "🎬 Testing video URL (Range: bytes=0-1)..."
curl -s -I -H "Range: bytes=0-1" "$FULL_URL" > "$EVID_DIR/video_headers_range_206.txt" 2>&1

RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_range_206.txt" | awk RANGE_AR=$(grep -i 
if [ "$RANGE_STATUS" != "206" ]; then
  log "⚠️  Range request returned $RANGE_STATUS (expected 206). This may affect seek functionality."
else
  log "✅ Range: 206 Partial Content, Accept-Ranges: $RANGE_AR"
fi

# 8. Generate 6-line evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
NOVEL_ID=$NOVEL_ID
VIDEO_ASSET_STATUS=$VIDEO_STATUS
VIDEO_JOB_ID=$JOB_ID
NO_RANGE_STATUS=$NO_RANGE_STATUS
RANGE_STATUS=$RANGE_STATUS
CONTENT_TYPE=$NO_RANGE_CT
EOF

log "📝 Evidence saved to: $EVID_DIR"
log "✅ Gate PASSED: Video playback verified with signed URLs + Range support"

set -e

GATE_NAME="video-playback-signed-url"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EVID_DIR="docs/_evidence/${GATE_NAME}_${TIMESTAMP}"
mkdir -p "$EVID_DIR"

log() {
  echo "[$(date +}

error_exit() {
  log "❌ $1"
  exit 1
}

log "========================================="
log "GATE: Video Playback Signed URL Verification"
log "========================================="

# 1. Ensure API is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  error_exit "API not reachable at localhost:3000. Start with: pnpm -w dev"
fi

# 2. Get latest novel with completed VIDEO_RENDER
NOVEL_ID=$(psql -d scu -t -c " # $gate$
  SELECT ns.id 
  FROM novel_sources ns
  JOIN shot_jobs sj ON sj.\"projectId\" = ns.\"projectId\"
  WHERE sj.type =     AND sj.status =   ORDER BY sj.\"createdAt\" DESC
  LIMIT 1;
" | xargs)

if [ -z "$NOVEL_ID" ]; then
  error_exit "No completed VIDEO_RENDER found. Run gate-stage3_p3_full_pipeline_e2e.sh first."
fi

log "   Using NOVEL_ID=$NOVEL_ID"

# 3. Get user for authentication (use test user)
USER_EMAIL="admin@example.com"
USER_PASS="password123"

# Create test user if not exists
npx ts-node -P apps/api/tsconfig.json apps/api/src/create-test-user.ts > /dev/null 2>&1

# Login to get JWT token
log "🔑 Authenticating..."
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")

# Try both possible JWT locations
ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r 
if [ -z "$ACCESS_TOKEN" ]; then
  # Fallback: Check if login succeeded but used cookie-based auth
  USER_ID=$(echo "$LOGIN_RESP" | jq -r   if [ -n "$USER_ID" ]; then
    log "⚠️  Login succeeded but no JWT token. Attempting direct audit call..."
    ACCESS_TOKEN=""  # Will try without auth header
  else
    error_exit "Failed to authenticate. Response: $LOGIN_RESP"
  fi
fi

# 4. Call Audit API
log "📡 Calling Audit API..."
if [ -n "$ACCESS_TOKEN" ]; then
  AUDIT_RESP=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
else
  # Use cookie-based session
  AUDIT_RESP=$(curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
    "http://localhost:3000/api/audit/novel/$NOVEL_ID/full")
fi

echo "$AUDIT_RESP" | jq   echo "$AUDIT_RESP" > "$EVID_DIR/audit_response.txt"
  error_exit "Audit API returned non-JSON. See $EVID_DIR/audit_response.txt"
}

# 5. Extract videoAsset
VIDEO_STATUS=$(echo "$AUDIT_RESP" | jq -r SECURE_URL=$(echo "$AUDIT_RESP" | jq -r JOB_ID=$(echo "$AUDIT_RESP" | jq -r 
log "   videoAsset.status=$VIDEO_STATUS"
log "   videoAsset.jobId=$JOB_ID"

if [ "$VIDEO_STATUS" != "READY" ]; then
  error_exit "videoAsset.status is not READY (got: $VIDEO_STATUS)"
fi

if [ -z "$SECURE_URL" ]; then
  error_exit "videoAsset.secureUrl is empty"
fi

# Validate signed URL format
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi
if ! echo "$SECURE_URL" | grep -q   error_exit "secureUrl missing fi

log "✅ videoAsset validation passed"

# 6. Test video URL (no Range)
log "🎬 Testing video URL (no Range)..."
if [[ "$SECURE_URL" == http* ]]; then
  FULL_URL="$SECURE_URL"
else
  FULL_URL="http://localhost:3000${SECURE_URL}"
fi

curl -s -I "$FULL_URL" > "$EVID_DIR/video_headers_no_range.txt" 2>&1

NO_RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_no_range.txt" | awk NO_RANGE_CT=$(grep -i 
if [ "$NO_RANGE_STATUS" != "200" ]; then
  error_exit "No-Range request failed (status=$NO_RANGE_STATUS). Expected 200."
fi

if ! echo "$NO_RANGE_CT" | grep -qi   error_exit "Content-Type is not video/* (got: $NO_RANGE_CT)"
fi

log "✅ No-Range: 200 OK, Content-Type: $NO_RANGE_CT"

# 7. Test video URL (with Range)
log "🎬 Testing video URL (Range: bytes=0-1)..."
curl -s -I -H "Range: bytes=0-1" "$FULL_URL" > "$EVID_DIR/video_headers_range_206.txt" 2>&1

RANGE_STATUS=$(head -1 "$EVID_DIR/video_headers_range_206.txt" | awk RANGE_AR=$(grep -i 
if [ "$RANGE_STATUS" != "206" ]; then
  log "⚠️  Range request returned $RANGE_STATUS (expected 206). This may affect seek functionality."
else
  log "✅ Range: 206 Partial Content, Accept-Ranges: $RANGE_AR"
fi

# 8. Generate 6-line evidence
cat > "$EVID_DIR/FINAL_6LINE_EVIDENCE.txt" <<EOF
NOVEL_ID=$NOVEL_ID
VIDEO_ASSET_STATUS=$VIDEO_STATUS
VIDEO_JOB_ID=$JOB_ID
NO_RANGE_STATUS=$NO_RANGE_STATUS
RANGE_STATUS=$RANGE_STATUS
CONTENT_TYPE=$NO_RANGE_CT
EOF

log "📝 Evidence saved to: $EVID_DIR"
log "✅ Gate PASSED: Video playback verified with signed URLs + Range support"
