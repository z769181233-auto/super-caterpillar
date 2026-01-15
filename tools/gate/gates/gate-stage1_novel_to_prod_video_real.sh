#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Stage-1 Real Baseline Gate
# Verifies: real video (non-mock), checksum (sha256), ffprobe evidence

API_URL=${API_URL:-"http://localhost:3000"}
EVIDENCE_DIR="docs/_evidence/STAGE1_REAL_GATE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

export $(grep -v API_KEY=${TEST_API_KEY:-"dev-worker-key"}
API_SECRET="dev-worker-secret"

# Helper: Generate HMAC Headers (V1.1 Specification)
generate_hmac_headers() {
  local method=$1
  local path=$2
  local timestamp=$3
  local body=$4

  node -e "
    const crypto = require(    const secret =     const apiKey =     const timestamp =     const nonce =     const body =     
    // V1.1: message = apiKey + nonce + timestamp + body
    const message = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    console.log(    console.log(    console.log(    console.log(  "
}

echo "🚀 [Gate-Stage1-Real] START"

# 1. Trigger Pipeline
TS=$(date +%s)
PAYLOAD=$(jq -n --arg nt "在遥远的星系中，有一只向往自由的毛毛虫，它正在拼命对抗重力。" 
echo "Payload: $PAYLOAD"

HEADERS_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS" "$PAYLOAD")
CURL_ARGS=()
for h in $HEADERS_RAW; do CURL_ARGS+=(-H "$h"); done
unset export RENDER_ENGINE=ffmpeg
RESPONSE=$(curl -s -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS[@]}" \
  -d "$PAYLOAD")

echo "$RESPONSE" | tee "$EVIDENCE_DIR/01_trigger_response.json"

PROJECT_ID=$(echo "$RESPONSE" | jq -r PIPELINE_RUN_ID=$(echo "$RESPONSE" | jq -r 
if [ -z "$PROJECT_ID" ] || [ -z "$PIPELINE_RUN_ID" ]; then
  echo "❌ Missing projectId or pipelineRunId"
  exit 1
fi

echo "Pipeline started: projectId=$PROJECT_ID, pipelineRunId=$PIPELINE_RUN_ID"

# 2. Wait for PublishedVideo
MAX_WAIT=120
i=0
FINAL_STATUS=""

while [ $i -lt $MAX_WAIT ]; do
  TS_GET=$(date +%s)
  HEADERS_GET=$(generate_hmac_headers "GET" "/api/publish/videos?projectId=$PROJECT_ID" "$TS_GET" "")
  CURL_ARGS_GET=()
    for h in $HEADERS_GET; do CURL_ARGS_GET+=(-H "$h"); done
  unset   
  VIDEO_QUERY=$(curl -s -X GET "$API_URL/api/publish/videos?projectId=$PROJECT_ID" "${CURL_ARGS_GET[@]}")
  echo "$VIDEO_QUERY" > "$EVIDENCE_DIR/02_video_status_round_${i}.json"
  
  FINAL_STATUS=$(echo "$VIDEO_QUERY" | jq -r   if [[ "$FINAL_STATUS" == "PUBLISHED" || "$FINAL_STATUS" == "INTERNAL_READY" ]]; then
    break
  fi
  
  sleep 2
  i=$((i+1))
done

if [[ "$FINAL_STATUS" != "PUBLISHED" && "$FINAL_STATUS" != "INTERNAL_READY" ]]; then
  echo "❌ Timeout: PublishedVideo status=$FINAL_STATUS"
  exit 1
fi

echo "✅ PublishedVideo status: $FINAL_STATUS"

# 3. Real Baseline Assertions
STORAGE_KEY=$(echo "$VIDEO_QUERY" | jq -r CHECKSUM=$(echo "$VIDEO_QUERY" | jq -r 
echo "Verifying storageKey=$STORAGE_KEY checksum=$CHECKSUM"

# 3.1 Must NOT be mock
if [[ "$STORAGE_KEY" == mock/* ]]; then
  echo "❌ Real Gate FAIL: storageKey is mock: $STORAGE_KEY"
  exit 1
fi

# 3.2 Must be videos/* OR renders/* (Stage 1)
if [[ ! "$STORAGE_KEY" == videos/* && ! "$STORAGE_KEY" == renders/* ]]; then
  echo "❌ Real Gate FAIL: storageKey must start with videos/ or renders/: $STORAGE_KEY"
  exit 1
fi

# 3.3 Checksum must be sha256 (64 hex)
if [[ ! "$CHECKSUM" =~ ^[0-9a-f]{64}$ ]]; then
  echo "❌ Real Gate FAIL: checksum invalid (not sha256): $CHECKSUM"
  exit 1
fi

# 3.4 File must exist
STORAGE_ROOT="${STORAGE_ROOT:-$(pwd)/.data/storage}"
VIDEO_PATH="$STORAGE_ROOT/$STORAGE_KEY"
FFPROBE_PATH="$STORAGE_ROOT/$STORAGE_KEY.ffprobe.json"

if [ ! -f "$VIDEO_PATH" ]; then
  # Fallback for local worker runtime path (apps/workers CWD)
  VIDEO_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY"
  # Fallback for Root CWD worker
  VIDEO_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY"

  if [ -f "$VIDEO_PATH_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_FALLBACK"
    echo "⚠️  Found video in worker runtime: $VIDEO_PATH"
  elif [ -f "$VIDEO_PATH_ROOT_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_ROOT_FALLBACK"
    echo "⚠️  Found video in ROOT runtime: $VIDEO_PATH"
  else
    echo "❌ missing video file: $VIDEO_PATH"
    echo "❌ also missing in fallback 1: $VIDEO_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $VIDEO_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

SIZE=$(wc -c < "$VIDEO_PATH" | tr -d if [ "$SIZE" -lt 1000 ]; then
  echo "❌ video too small: $SIZE bytes"
  exit 1
fi

# 3.5 ffprobe json must exist and be valid
if [ ! -f "$FFPROBE_PATH" ]; then
  # Fallback for local worker runtime path
  FFPROBE_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY.ffprobe.json"
  FFPROBE_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY.ffprobe.json"

  if [ -f "$FFPROBE_PATH_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_FALLBACK"
    echo "⚠️  Found ffprobe evidence in worker runtime: $FFPROBE_PATH"
  elif [ -f "$FFPROBE_PATH_ROOT_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_ROOT_FALLBACK"
    echo "⚠️  Found ffprobe evidence in ROOT runtime: $FFPROBE_PATH"
  else
    echo "❌ missing ffprobe evidence: $FFPROBE_PATH"
    echo "❌ also missing in fallback 1: $FFPROBE_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $FFPROBE_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

jq -e   echo "❌ ffprobe json invalid"
  exit 1
}

echo "✅ [Gate-Stage1-Real] TOTAL PASS: real video + checksum + ffprobe verified"
echo "Evidence: $EVIDENCE_DIR"

# Stage-1 Real Baseline Gate
# Verifies: real video (non-mock), checksum (sha256), ffprobe evidence

API_URL=${API_URL:-"http://localhost:3000"}
EVIDENCE_DIR="docs/_evidence/STAGE1_REAL_GATE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

export $(grep -v API_KEY=${TEST_API_KEY:-"dev-worker-key"}
API_SECRET="dev-worker-secret"

# Helper: Generate HMAC Headers (V1.1 Specification)
generate_hmac_headers() {
  local method=$1
  local path=$2
  local timestamp=$3
  local body=$4

  node -e "
    const crypto = require(    const secret =     const apiKey =     const timestamp =     const nonce =     const body =     
    // V1.1: message = apiKey + nonce + timestamp + body
    const message = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    console.log(    console.log(    console.log(    console.log(  "
}

echo "🚀 [Gate-Stage1-Real] START"

# 1. Trigger Pipeline
TS=$(date +%s)
PAYLOAD=$(jq -n --arg nt "在遥远的星系中，有一只向往自由的毛毛虫，它正在拼命对抗重力。" 
echo "Payload: $PAYLOAD"

HEADERS_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS" "$PAYLOAD")
CURL_ARGS=()
for h in $HEADERS_RAW; do CURL_ARGS+=(-H "$h"); done
unset export RENDER_ENGINE=ffmpeg
RESPONSE=$(curl -s -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS[@]}" \
  -d "$PAYLOAD")

echo "$RESPONSE" | tee "$EVIDENCE_DIR/01_trigger_response.json"

PROJECT_ID=$(echo "$RESPONSE" | jq -r PIPELINE_RUN_ID=$(echo "$RESPONSE" | jq -r 
if [ -z "$PROJECT_ID" ] || [ -z "$PIPELINE_RUN_ID" ]; then
  echo "❌ Missing projectId or pipelineRunId"
  exit 1
fi

echo "Pipeline started: projectId=$PROJECT_ID, pipelineRunId=$PIPELINE_RUN_ID"

# 2. Wait for PublishedVideo
MAX_WAIT=120
i=0
FINAL_STATUS=""

while [ $i -lt $MAX_WAIT ]; do
  TS_GET=$(date +%s)
  HEADERS_GET=$(generate_hmac_headers "GET" "/api/publish/videos?projectId=$PROJECT_ID" "$TS_GET" "")
  CURL_ARGS_GET=()
    for h in $HEADERS_GET; do CURL_ARGS_GET+=(-H "$h"); done
  unset   
  VIDEO_QUERY=$(curl -s -X GET "$API_URL/api/publish/videos?projectId=$PROJECT_ID" "${CURL_ARGS_GET[@]}")
  echo "$VIDEO_QUERY" > "$EVIDENCE_DIR/02_video_status_round_${i}.json"
  
  FINAL_STATUS=$(echo "$VIDEO_QUERY" | jq -r   if [[ "$FINAL_STATUS" == "PUBLISHED" || "$FINAL_STATUS" == "INTERNAL_READY" ]]; then
    break
  fi
  
  sleep 2
  i=$((i+1))
done

if [[ "$FINAL_STATUS" != "PUBLISHED" && "$FINAL_STATUS" != "INTERNAL_READY" ]]; then
  echo "❌ Timeout: PublishedVideo status=$FINAL_STATUS"
  exit 1
fi

echo "✅ PublishedVideo status: $FINAL_STATUS"

# 3. Real Baseline Assertions
STORAGE_KEY=$(echo "$VIDEO_QUERY" | jq -r CHECKSUM=$(echo "$VIDEO_QUERY" | jq -r 
echo "Verifying storageKey=$STORAGE_KEY checksum=$CHECKSUM"

# 3.1 Must NOT be mock
if [[ "$STORAGE_KEY" == mock/* ]]; then
  echo "❌ Real Gate FAIL: storageKey is mock: $STORAGE_KEY"
  exit 1
fi

# 3.2 Must be videos/* OR renders/* (Stage 1)
if [[ ! "$STORAGE_KEY" == videos/* && ! "$STORAGE_KEY" == renders/* ]]; then
  echo "❌ Real Gate FAIL: storageKey must start with videos/ or renders/: $STORAGE_KEY"
  exit 1
fi

# 3.3 Checksum must be sha256 (64 hex)
if [[ ! "$CHECKSUM" =~ ^[0-9a-f]{64}$ ]]; then
  echo "❌ Real Gate FAIL: checksum invalid (not sha256): $CHECKSUM"
  exit 1
fi

# 3.4 File must exist
STORAGE_ROOT="${STORAGE_ROOT:-$(pwd)/.data/storage}"
VIDEO_PATH="$STORAGE_ROOT/$STORAGE_KEY"
FFPROBE_PATH="$STORAGE_ROOT/$STORAGE_KEY.ffprobe.json"

if [ ! -f "$VIDEO_PATH" ]; then
  # Fallback for local worker runtime path (apps/workers CWD)
  VIDEO_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY"
  # Fallback for Root CWD worker
  VIDEO_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY"

  if [ -f "$VIDEO_PATH_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_FALLBACK"
    echo "⚠️  Found video in worker runtime: $VIDEO_PATH"
  elif [ -f "$VIDEO_PATH_ROOT_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_ROOT_FALLBACK"
    echo "⚠️  Found video in ROOT runtime: $VIDEO_PATH"
  else
    echo "❌ missing video file: $VIDEO_PATH"
    echo "❌ also missing in fallback 1: $VIDEO_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $VIDEO_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

SIZE=$(wc -c < "$VIDEO_PATH" | tr -d if [ "$SIZE" -lt 1000 ]; then
  echo "❌ video too small: $SIZE bytes"
  exit 1
fi

# 3.5 ffprobe json must exist and be valid
if [ ! -f "$FFPROBE_PATH" ]; then
  # Fallback for local worker runtime path
  FFPROBE_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY.ffprobe.json"
  FFPROBE_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY.ffprobe.json"

  if [ -f "$FFPROBE_PATH_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_FALLBACK"
    echo "⚠️  Found ffprobe evidence in worker runtime: $FFPROBE_PATH"
  elif [ -f "$FFPROBE_PATH_ROOT_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_ROOT_FALLBACK"
    echo "⚠️  Found ffprobe evidence in ROOT runtime: $FFPROBE_PATH"
  else
    echo "❌ missing ffprobe evidence: $FFPROBE_PATH"
    echo "❌ also missing in fallback 1: $FFPROBE_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $FFPROBE_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

jq -e   echo "❌ ffprobe json invalid"
  exit 1
}

echo "✅ [Gate-Stage1-Real] TOTAL PASS: real video + checksum + ffprobe verified"
echo "Evidence: $EVIDENCE_DIR"

# Stage-1 Real Baseline Gate
# Verifies: real video (non-mock), checksum (sha256), ffprobe evidence

API_URL=${API_URL:-"http://localhost:3000"}
EVIDENCE_DIR="docs/_evidence/STAGE1_REAL_GATE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

export $(grep -v API_KEY=${TEST_API_KEY:-"dev-worker-key"}
API_SECRET="dev-worker-secret"

# Helper: Generate HMAC Headers (V1.1 Specification)
generate_hmac_headers() {
  local method=$1
  local path=$2
  local timestamp=$3
  local body=$4

  node -e "
    const crypto = require(    const secret =     const apiKey =     const timestamp =     const nonce =     const body =     
    // V1.1: message = apiKey + nonce + timestamp + body
    const message = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    console.log(    console.log(    console.log(    console.log(  "
}

echo "🚀 [Gate-Stage1-Real] START"

# 1. Trigger Pipeline
TS=$(date +%s)
PAYLOAD=$(jq -n --arg nt "在遥远的星系中，有一只向往自由的毛毛虫，它正在拼命对抗重力。" 
echo "Payload: $PAYLOAD"

HEADERS_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS" "$PAYLOAD")
CURL_ARGS=()
for h in $HEADERS_RAW; do CURL_ARGS+=(-H "$h"); done
unset export RENDER_ENGINE=ffmpeg
RESPONSE=$(curl -s -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS[@]}" \
  -d "$PAYLOAD")

echo "$RESPONSE" | tee "$EVIDENCE_DIR/01_trigger_response.json"

PROJECT_ID=$(echo "$RESPONSE" | jq -r PIPELINE_RUN_ID=$(echo "$RESPONSE" | jq -r 
if [ -z "$PROJECT_ID" ] || [ -z "$PIPELINE_RUN_ID" ]; then
  echo "❌ Missing projectId or pipelineRunId"
  exit 1
fi

echo "Pipeline started: projectId=$PROJECT_ID, pipelineRunId=$PIPELINE_RUN_ID"

# 2. Wait for PublishedVideo
MAX_WAIT=120
i=0
FINAL_STATUS=""

while [ $i -lt $MAX_WAIT ]; do
  TS_GET=$(date +%s)
  HEADERS_GET=$(generate_hmac_headers "GET" "/api/publish/videos?projectId=$PROJECT_ID" "$TS_GET" "")
  CURL_ARGS_GET=()
    for h in $HEADERS_GET; do CURL_ARGS_GET+=(-H "$h"); done
  unset   
  VIDEO_QUERY=$(curl -s -X GET "$API_URL/api/publish/videos?projectId=$PROJECT_ID" "${CURL_ARGS_GET[@]}")
  echo "$VIDEO_QUERY" > "$EVIDENCE_DIR/02_video_status_round_${i}.json"
  
  FINAL_STATUS=$(echo "$VIDEO_QUERY" | jq -r   if [[ "$FINAL_STATUS" == "PUBLISHED" || "$FINAL_STATUS" == "INTERNAL_READY" ]]; then
    break
  fi
  
  sleep 2
  i=$((i+1))
done

if [[ "$FINAL_STATUS" != "PUBLISHED" && "$FINAL_STATUS" != "INTERNAL_READY" ]]; then
  echo "❌ Timeout: PublishedVideo status=$FINAL_STATUS"
  exit 1
fi

echo "✅ PublishedVideo status: $FINAL_STATUS"

# 3. Real Baseline Assertions
STORAGE_KEY=$(echo "$VIDEO_QUERY" | jq -r CHECKSUM=$(echo "$VIDEO_QUERY" | jq -r 
echo "Verifying storageKey=$STORAGE_KEY checksum=$CHECKSUM"

# 3.1 Must NOT be mock
if [[ "$STORAGE_KEY" == mock/* ]]; then
  echo "❌ Real Gate FAIL: storageKey is mock: $STORAGE_KEY"
  exit 1
fi

# 3.2 Must be videos/* OR renders/* (Stage 1)
if [[ ! "$STORAGE_KEY" == videos/* && ! "$STORAGE_KEY" == renders/* ]]; then
  echo "❌ Real Gate FAIL: storageKey must start with videos/ or renders/: $STORAGE_KEY"
  exit 1
fi

# 3.3 Checksum must be sha256 (64 hex)
if [[ ! "$CHECKSUM" =~ ^[0-9a-f]{64}$ ]]; then
  echo "❌ Real Gate FAIL: checksum invalid (not sha256): $CHECKSUM"
  exit 1
fi

# 3.4 File must exist
STORAGE_ROOT="${STORAGE_ROOT:-$(pwd)/.data/storage}"
VIDEO_PATH="$STORAGE_ROOT/$STORAGE_KEY"
FFPROBE_PATH="$STORAGE_ROOT/$STORAGE_KEY.ffprobe.json"

if [ ! -f "$VIDEO_PATH" ]; then
  # Fallback for local worker runtime path (apps/workers CWD)
  VIDEO_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY"
  # Fallback for Root CWD worker
  VIDEO_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY"

  if [ -f "$VIDEO_PATH_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_FALLBACK"
    echo "⚠️  Found video in worker runtime: $VIDEO_PATH"
  elif [ -f "$VIDEO_PATH_ROOT_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_ROOT_FALLBACK"
    echo "⚠️  Found video in ROOT runtime: $VIDEO_PATH"
  else
    echo "❌ missing video file: $VIDEO_PATH"
    echo "❌ also missing in fallback 1: $VIDEO_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $VIDEO_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

SIZE=$(wc -c < "$VIDEO_PATH" | tr -d if [ "$SIZE" -lt 1000 ]; then
  echo "❌ video too small: $SIZE bytes"
  exit 1
fi

# 3.5 ffprobe json must exist and be valid
if [ ! -f "$FFPROBE_PATH" ]; then
  # Fallback for local worker runtime path
  FFPROBE_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY.ffprobe.json"
  FFPROBE_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY.ffprobe.json"

  if [ -f "$FFPROBE_PATH_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_FALLBACK"
    echo "⚠️  Found ffprobe evidence in worker runtime: $FFPROBE_PATH"
  elif [ -f "$FFPROBE_PATH_ROOT_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_ROOT_FALLBACK"
    echo "⚠️  Found ffprobe evidence in ROOT runtime: $FFPROBE_PATH"
  else
    echo "❌ missing ffprobe evidence: $FFPROBE_PATH"
    echo "❌ also missing in fallback 1: $FFPROBE_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $FFPROBE_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

jq -e   echo "❌ ffprobe json invalid"
  exit 1
}

echo "✅ [Gate-Stage1-Real] TOTAL PASS: real video + checksum + ffprobe verified"
echo "Evidence: $EVIDENCE_DIR"

# Stage-1 Real Baseline Gate
# Verifies: real video (non-mock), checksum (sha256), ffprobe evidence

API_URL=${API_URL:-"http://localhost:3000"}
EVIDENCE_DIR="docs/_evidence/STAGE1_REAL_GATE_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVIDENCE_DIR"

export $(grep -v API_KEY=${TEST_API_KEY:-"dev-worker-key"}
API_SECRET="dev-worker-secret"

# Helper: Generate HMAC Headers (V1.1 Specification)
generate_hmac_headers() {
  local method=$1
  local path=$2
  local timestamp=$3
  local body=$4

  node -e "
    const crypto = require(    const secret =     const apiKey =     const timestamp =     const nonce =     const body =     
    // V1.1: message = apiKey + nonce + timestamp + body
    const message = apiKey + nonce + timestamp + body;
    const signature = crypto.createHmac(    
    console.log(    console.log(    console.log(    console.log(  "
}

echo "🚀 [Gate-Stage1-Real] START"

# 1. Trigger Pipeline
TS=$(date +%s)
PAYLOAD=$(jq -n --arg nt "在遥远的星系中，有一只向往自由的毛毛虫，它正在拼命对抗重力。" 
echo "Payload: $PAYLOAD"

HEADERS_RAW=$(generate_hmac_headers "POST" "/api/orchestrator/pipeline/stage1" "$TS" "$PAYLOAD")
CURL_ARGS=()
for h in $HEADERS_RAW; do CURL_ARGS+=(-H "$h"); done
unset export RENDER_ENGINE=ffmpeg
RESPONSE=$(curl -s -X POST "$API_URL/api/orchestrator/pipeline/stage1" \
  -H "Content-Type: application/json" \
  "${CURL_ARGS[@]}" \
  -d "$PAYLOAD")

echo "$RESPONSE" | tee "$EVIDENCE_DIR/01_trigger_response.json"

PROJECT_ID=$(echo "$RESPONSE" | jq -r PIPELINE_RUN_ID=$(echo "$RESPONSE" | jq -r 
if [ -z "$PROJECT_ID" ] || [ -z "$PIPELINE_RUN_ID" ]; then
  echo "❌ Missing projectId or pipelineRunId"
  exit 1
fi

echo "Pipeline started: projectId=$PROJECT_ID, pipelineRunId=$PIPELINE_RUN_ID"

# 2. Wait for PublishedVideo
MAX_WAIT=120
i=0
FINAL_STATUS=""

while [ $i -lt $MAX_WAIT ]; do
  TS_GET=$(date +%s)
  HEADERS_GET=$(generate_hmac_headers "GET" "/api/publish/videos?projectId=$PROJECT_ID" "$TS_GET" "")
  CURL_ARGS_GET=()
    for h in $HEADERS_GET; do CURL_ARGS_GET+=(-H "$h"); done
  unset   
  VIDEO_QUERY=$(curl -s -X GET "$API_URL/api/publish/videos?projectId=$PROJECT_ID" "${CURL_ARGS_GET[@]}")
  echo "$VIDEO_QUERY" > "$EVIDENCE_DIR/02_video_status_round_${i}.json"
  
  FINAL_STATUS=$(echo "$VIDEO_QUERY" | jq -r   if [[ "$FINAL_STATUS" == "PUBLISHED" || "$FINAL_STATUS" == "INTERNAL_READY" ]]; then
    break
  fi
  
  sleep 2
  i=$((i+1))
done

if [[ "$FINAL_STATUS" != "PUBLISHED" && "$FINAL_STATUS" != "INTERNAL_READY" ]]; then
  echo "❌ Timeout: PublishedVideo status=$FINAL_STATUS"
  exit 1
fi

echo "✅ PublishedVideo status: $FINAL_STATUS"

# 3. Real Baseline Assertions
STORAGE_KEY=$(echo "$VIDEO_QUERY" | jq -r CHECKSUM=$(echo "$VIDEO_QUERY" | jq -r 
echo "Verifying storageKey=$STORAGE_KEY checksum=$CHECKSUM"

# 3.1 Must NOT be mock
if [[ "$STORAGE_KEY" == mock/* ]]; then
  echo "❌ Real Gate FAIL: storageKey is mock: $STORAGE_KEY"
  exit 1
fi

# 3.2 Must be videos/* OR renders/* (Stage 1)
if [[ ! "$STORAGE_KEY" == videos/* && ! "$STORAGE_KEY" == renders/* ]]; then
  echo "❌ Real Gate FAIL: storageKey must start with videos/ or renders/: $STORAGE_KEY"
  exit 1
fi

# 3.3 Checksum must be sha256 (64 hex)
if [[ ! "$CHECKSUM" =~ ^[0-9a-f]{64}$ ]]; then
  echo "❌ Real Gate FAIL: checksum invalid (not sha256): $CHECKSUM"
  exit 1
fi

# 3.4 File must exist
STORAGE_ROOT="${STORAGE_ROOT:-$(pwd)/.data/storage}"
VIDEO_PATH="$STORAGE_ROOT/$STORAGE_KEY"
FFPROBE_PATH="$STORAGE_ROOT/$STORAGE_KEY.ffprobe.json"

if [ ! -f "$VIDEO_PATH" ]; then
  # Fallback for local worker runtime path (apps/workers CWD)
  VIDEO_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY"
  # Fallback for Root CWD worker
  VIDEO_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY"

  if [ -f "$VIDEO_PATH_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_FALLBACK"
    echo "⚠️  Found video in worker runtime: $VIDEO_PATH"
  elif [ -f "$VIDEO_PATH_ROOT_FALLBACK" ]; then
    VIDEO_PATH="$VIDEO_PATH_ROOT_FALLBACK"
    echo "⚠️  Found video in ROOT runtime: $VIDEO_PATH"
  else
    echo "❌ missing video file: $VIDEO_PATH"
    echo "❌ also missing in fallback 1: $VIDEO_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $VIDEO_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

SIZE=$(wc -c < "$VIDEO_PATH" | tr -d if [ "$SIZE" -lt 1000 ]; then
  echo "❌ video too small: $SIZE bytes"
  exit 1
fi

# 3.5 ffprobe json must exist and be valid
if [ ! -f "$FFPROBE_PATH" ]; then
  # Fallback for local worker runtime path
  FFPROBE_PATH_FALLBACK="$(pwd)/apps/workers/.runtime/$STORAGE_KEY.ffprobe.json"
  FFPROBE_PATH_ROOT_FALLBACK="$(pwd)/.runtime/$STORAGE_KEY.ffprobe.json"

  if [ -f "$FFPROBE_PATH_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_FALLBACK"
    echo "⚠️  Found ffprobe evidence in worker runtime: $FFPROBE_PATH"
  elif [ -f "$FFPROBE_PATH_ROOT_FALLBACK" ]; then
    FFPROBE_PATH="$FFPROBE_PATH_ROOT_FALLBACK"
    echo "⚠️  Found ffprobe evidence in ROOT runtime: $FFPROBE_PATH"
  else
    echo "❌ missing ffprobe evidence: $FFPROBE_PATH"
    echo "❌ also missing in fallback 1: $FFPROBE_PATH_FALLBACK"
    echo "❌ also missing in fallback 2: $FFPROBE_PATH_ROOT_FALLBACK"
    exit 1
  fi
fi

jq -e   echo "❌ ffprobe json invalid"
  exit 1
}

echo "✅ [Gate-Stage1-Real] TOTAL PASS: real video + checksum + ffprobe verified"
echo "Evidence: $EVIDENCE_DIR"
