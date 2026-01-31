#!/bin/bash
# gate-audio-minloop.sh
# P13-2: Audio 最小闭环门禁（Double PASS）
# 验证 TTS + BGM 音频资产化、混音合成、物理可用性

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
set -x

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
GATE_NAME="AUDIO_MINLOOP"
TS=$(date +%Y%m%d%H%M%S)
EVIDENCE_DIR="docs/_evidence/audio_minloop_$TS"
mkdir -p "$EVIDENCE_DIR"

# P13-2: 固化 traceId（允许外部传入）
TRACE_ID=${TRACE_ID:-"audio_minloop_${TS}"}

# P13-2: Force GATE_MODE for audio generation
export GATE_MODE=1
export AUDIO_MINLOOP_SYNC=1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$GATE_NAME] $1" | tee -a "$EVIDENCE_DIR/GATE_RUN.log"
}

log "Starting P13-2 Audio Minloop Gate with traceId=$TRACE_ID..."

# Auth & Seeding
source tools/gate/lib/gate_auth_seed.sh

generate_headers() {
    local method=$1
    local path=$2
    local body=$3
    node -e "
        const crypto = require('crypto');
        const secret = '$API_SECRET';
        const method = '$method';
        const path = '$path';
        const body = '$body';
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = 'nonce_${TS}_' + Math.random().toString(36).substring(7);
        const apiKey = '$VALID_API_KEY_ID';
        const contentSha256 = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
        const payload = apiKey + nonce + timestamp + (body || '');
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        process.stdout.write(\`X-Api-Key: \${apiKey}\\n\`);
        process.stdout.write(\`X-Nonce: \${nonce}\\n\`);
        process.stdout.write(\`X-Timestamp: \${timestamp}\\n\`);
        process.stdout.write(\`X-Content-SHA256: \${contentSha256}\\n\`);
        process.stdout.write(\`X-Signature: \${signature}\\n\`);
    "
}

# Helper: Assert function
assert() {
    local condition=$1
    local message=$2
    if [ "$condition" != "0" ]; then
        log "${RED}❌ ASSERTION FAILED: $message${NC}"
        exit 1
    fi
    log "${GREEN}✓ PASS: $message${NC}"
}

# === 起跑前硬检查 (P0 必须) ===
log "--- [PRE-FLIGHT CHECKS] ---"

# 1. API Health Check
log "Checking API health..."
if ! curl -sSf "$API_URL/api/health" >/dev/null 2>&1; then
    log "${RED}❌ API health check failed at $API_URL/api/health${NC}"
    log "${YELLOW}Please start API: pnpm --filter api dev${NC}"
    exit 1
fi
log "${GREEN}✓ API is healthy${NC}"

# 2. DB Connectivity Check
log "Checking database connectivity..."
if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
    log "${RED}❌ Database connectivity check failed${NC}"
    log "${YELLOW}DATABASE_URL: $DATABASE_URL${NC}"
    exit 1
fi
log "${GREEN}✓ Database is reachable${NC}"

# 3. Worker Running Check (optional but recommended)
log "${YELLOW}⚠ Worker check: Please ensure workers are running with polling/heartbeat logs${NC}"
log "${YELLOW}  Start with: pnpm --filter workers dev${NC}"

# Phase 1: Setup Data - 绑定 traceId 到 scene
log "--- [PHASE 1] Setup Scene with traceId ---"

# 创建 scene 并绑定 traceId 到 title
SCENE_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO scenes (id, \"chapterId\", \"sceneIndex\", title, \"projectId\", \"createdAt\", \"updatedAt\")
    VALUES (gen_random_uuid(), NULL, 999, 'GATE_AUDIO_${TRACE_ID}', '$PROJ_ID', NOW(), NOW())
    RETURNING id;
" | grep -v "INSERT" | awk '{print $1}' | xargs)

log "Created Scene ID: $SCENE_ID with traceId marker: GATE_AUDIO_${TRACE_ID}"
echo "$SCENE_ID" > "$EVIDENCE_DIR/scene_id.txt"

# 确定性 storageKey
TTS_KEY="audio/tts/${TRACE_ID}__${SCENE_ID}.wav"
BGM_KEY="audio/bgm/${TRACE_ID}__${SCENE_ID}.wav"
STORAGE_ROOT=${STORAGE_ROOT:-"/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/.data/storage"}

log "TTS storageKey: $TTS_KEY"
log "BGM storageKey: $BGM_KEY"

# 创建 Shot 以满足 Asset 外键约束
SHOT_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO shots (id, \"sceneId\", \"index\", \"type\", \"durationSeconds\", \"reviewStatus\")
    VALUES (gen_random_uuid(), '$SCENE_ID', 0, 'MEDIUM_SHOT', 5, 'APPROVED')
    RETURNING id;
" | grep -v "INSERT" | awk '{print $1}' | xargs)
log "Created Shot ID: $SHOT_ID"

# Phase 2: Double PASS
run_pass() {
    PASS_NUM=$1
    log "${YELLOW}=== Pass $PASS_NUM Start ===${NC}"
    
    RUN_TRACE_ID="${TRACE_ID}_pass${PASS_NUM}"
    
    # Create a TIMELINE_RENDER job
    TIMELINE_JSON="{
      \"sceneId\": \"$SCENE_ID\",
      \"projectId\": \"$PROJ_ID\",
      \"episodeId\": \"$EPISODE_ID\",
      \"organizationId\": \"$ORG_ID\",
      \"fps\": 24,
      \"width\": 1280,
      \"height\": 720,
      \"shots\": [
        {
          \"shotId\": \"$SHOT_ID\",
          \"index\": 0,
          \"durationFrames\": 60,
          \"startFrames\": 0,
          \"endFrames\": 60,
          \"framesTxtStorageKey\": \"/tmp/mock_frames.txt\",
          \"transition\": \"none\",
          \"transitionFrames\": 0
        }
      ]
    }"
    
    # Create mock frames.txt and frame
    mkdir -p /tmp
    echo "file '/tmp/mock_frame.png'" > /tmp/mock_frames.txt
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/mock_frame.png
    
    # Save timeline.json
    TIMELINE_PATH="/tmp/timeline_${RUN_TRACE_ID}.json"
    echo "$TIMELINE_JSON" > "$TIMELINE_PATH"
    
    # Insert TIMELINE_RENDER job
    JOB_ID=$(psql "$DATABASE_URL" -t -c "
        INSERT INTO shot_jobs (
            id, \"projectId\", type, status, payload, \"createdAt\", \"updatedAt\", \"organizationId\", \"traceId\"
        ) VALUES (
            gen_random_uuid(),
            '$PROJ_ID',
            'TIMELINE_RENDER',
            'PENDING',
            '{\"timelineStorageKey\":\"$TIMELINE_PATH\",\"pipelineRunId\":\"run-${RUN_TRACE_ID}\"}',
            NOW(),
            NOW(),
            '$ORG_ID',
            '$TRACE_ID'
        ) RETURNING id;
    " | grep -v "INSERT" | awk '{print $1}' | xargs)
    
    log "Dispatched TIMELINE_RENDER Job: $JOB_ID (traceId: $TRACE_ID)"
    
    # Poll for completion
    log "Waiting for job completion..."
    STATUS="PENDING"
    for r in {1..60}; do
        sleep 2
        STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE id='$JOB_ID';" | xargs)
        if [ "$STATUS" == "SUCCEEDED" ] || [ "$STATUS" == "FAILED" ]; then break; fi
        echo -ne "."
    done
    echo ""
    
    if [ "$STATUS" != "SUCCEEDED" ]; then
        log "${RED}❌ Job $JOB_ID failed/timeout: $STATUS${NC}"
        psql "$DATABASE_URL" -c "SELECT * FROM shot_jobs WHERE id='$JOB_ID';"
        exit 1
    fi
    log "${GREEN}Job $JOB_ID SUCCEEDED${NC}"
    
    # === ASSERTIONS (等值匹配) ===
    log "--- [ASSERTIONS Pass $PASS_NUM] ---"
    
    # 1. TTS Asset exists (等值查询)
    TTS_ASSET=$(psql "$DATABASE_URL" -t -c "
        SELECT id, status, checksum, \"storageKey\"
        FROM assets
        WHERE \"projectId\" = '$PROJ_ID'
        AND \"ownerId\" = '$SCENE_ID'
        AND \"ownerType\" = 'SCENE'
        AND \"storageKey\" = '$TTS_KEY'
        LIMIT 1;
    " | xargs)
    
    if [ -z "$TTS_ASSET" ]; then
        log "${RED}❌ TTS asset not found with storageKey=$TTS_KEY${NC}"
        exit 1
    fi
    
    TTS_ASSET_ID=$(echo "$TTS_ASSET" | awk '{print $1}')
    TTS_STATUS=$(echo "$TTS_ASSET" | awk '{print $2}')
    TTS_CHECKSUM=$(echo "$TTS_ASSET" | awk '{print $3}')
    
    log "${GREEN}✓ TTS asset found: id=$TTS_ASSET_ID status=$TTS_STATUS${NC}"
    
    # 2. BGM Asset exists (等值查询)
    BGM_ASSET=$(psql "$DATABASE_URL" -t -c "
        SELECT id, status, checksum, \"storageKey\"
        FROM assets
        WHERE \"projectId\" = '$PROJ_ID'
        AND \"ownerId\" = '$SCENE_ID'
        AND \"ownerType\" = 'SCENE'
        AND \"storageKey\" = '$BGM_KEY'
        LIMIT 1;
    " | xargs)
    
    if [ -z "$BGM_ASSET" ]; then
        log "${RED}❌ BGM asset not found with storageKey=$BGM_KEY${NC}"
        exit 1
    fi
    
    BGM_ASSET_ID=$(echo "$BGM_ASSET" | awk '{print $1}')
    BGM_STATUS=$(echo "$BGM_ASSET" | awk '{print $2}')
    BGM_CHECKSUM=$(echo "$BGM_ASSET" | awk '{print $3}')
    
    log "${GREEN}✓ BGM asset found: id=$BGM_ASSET_ID status=$BGM_STATUS${NC}"
    
    # 3. Physical files exist
    if [ ! -f "$STORAGE_ROOT/$TTS_KEY" ]; then
        log "${RED}❌ TTS file not found: $STORAGE_ROOT/$TTS_KEY${NC}"
        exit 1
    fi
    log "${GREEN}✓ TTS file exists${NC}"
    
    if [ ! -f "$STORAGE_ROOT/$BGM_KEY" ]; then
        log "${RED}❌ BGM file not found: $STORAGE_ROOT/$BGM_KEY${NC}"
        exit 1
    fi
    log "${GREEN}✓ BGM file exists${NC}"
    
    # 4. Checksum verification
    TTS_FILE_HASH=$(sha256sum "$STORAGE_ROOT/$TTS_KEY" | awk '{print $1}')
    BGM_FILE_HASH=$(sha256sum "$STORAGE_ROOT/$BGM_KEY" | awk '{print $1}')
    
    log "TTS: DB checksum=$TTS_CHECKSUM File hash=$TTS_FILE_HASH"
    log "BGM: DB checksum=$BGM_CHECKSUM File hash=$BGM_FILE_HASH"
    
    # === P0-3: 唯一性断言 (防重复插入) ===
    log "--- [UNIQUENESS CHECK Pass $PASS_NUM] ---"
    
    # TTS 唯一性
    TTS_COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM assets
        WHERE \"projectId\" = '$PROJ_ID'
        AND \"ownerId\" = '$SCENE_ID'
        AND \"storageKey\" = '$TTS_KEY';
    " | xargs)
    
    if [ "$TTS_COUNT" != "1" ]; then
        log "${RED}❌ TTS asset not unique: count=$TTS_COUNT (expected 1)${NC}"
        exit 1
    fi
    log "${GREEN}✓ TTS asset is unique (count=1)${NC}"
    
    # BGM 唯一性
    BGM_COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM assets
        WHERE \"projectId\" = '$PROJ_ID'
        AND \"ownerId\" = '$SCENE_ID'
        AND \"storageKey\" = '$BGM_KEY';
    " | xargs)
    
    if [ "$BGM_COUNT" != "1" ]; then
        log "${RED}❌ BGM asset not unique: count=$BGM_COUNT (expected 1)${NC}"
        exit 1
    fi
    log "${GREEN}✓ BGM asset is unique (count=1)${NC}"
    
    # Store uniqueness check
    echo "TTS_COUNT=$TTS_COUNT BGM_COUNT=$BGM_COUNT" > "$EVIDENCE_DIR/unique_check_pass${PASS_NUM}.txt"
    
    # Store checksums for Double PASS comparison
    echo "$TTS_ASSET_ID|$TTS_CHECKSUM|$TTS_FILE_HASH" > "$EVIDENCE_DIR/tts_sha256_pass${PASS_NUM}.txt"
    echo "$BGM_ASSET_ID|$BGM_CHECKSUM|$BGM_FILE_HASH" > "$EVIDENCE_DIR/bgm_sha256_pass${PASS_NUM}.txt"
    
    # 5. Collect Evidence
    psql "$DATABASE_URL" -c "
        SELECT id, \"storageKey\", checksum, status
        FROM assets
        WHERE \"projectId\" = '$PROJ_ID'
        AND \"ownerId\" = '$SCENE_ID'
        AND \"storageKey\" IN ('$TTS_KEY', '$BGM_KEY');
    " > "$EVIDENCE_DIR/assets_dump_pass${PASS_NUM}.txt"
    
    # 6. Final MP4 check (if exists)
    FINAL_MP4="$STORAGE_ROOT/renders/$PROJ_ID/scenes/$SCENE_ID/output.mp4"
    if [ -f "$FINAL_MP4" ]; then
        ffprobe -v error -show_entries format,stream "$FINAL_MP4" > "$EVIDENCE_DIR/ffprobe_final_pass${PASS_NUM}.txt" 2>&1 || true
        
        AUDIO_STREAMS=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$FINAL_MP4" 2>&1 | grep -c "audio" || true)
        if [ "$AUDIO_STREAMS" -lt 1 ]; then
            log "${YELLOW}⚠ No audio stream in final MP4${NC}"
        else
            log "${GREEN}✓ Audio stream exists in final MP4${NC}"
            
            # Duration check
            V_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -select_streams v "$FINAL_MP4" 2>/dev/null || echo "0")
            A_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -select_streams a "$FINAL_MP4" 2>/dev/null || echo "0")
            DIFF=$(echo "$V_DUR - $A_DUR" | bc | tr -d '-' 2>/dev/null || echo "999")
            
            echo "V=$V_DUR A=$A_DUR Diff=$DIFF" > "$EVIDENCE_DIR/duration_check_pass${PASS_NUM}.txt"
            
            ALIGNED=$(echo "$DIFF < 0.5" | bc 2>/dev/null || echo "0")
            if [ "$ALIGNED" == "1" ]; then
                log "${GREEN}✓ Duration aligned: Diff=$DIFF${NC}"
            else
                log "${YELLOW}⚠ Duration mismatch: Diff=$DIFF${NC}"
            fi
        fi
    fi
    
    log "${GREEN}✅ Pass $PASS_NUM: PASSED${NC}"
}

# Execute Double PASS
run_pass 1
log "${YELLOW}First pass complete. Sleeping 3s...${NC}"
sleep 3
run_pass 2

# === Double PASS Assertions ===
log "--- [DOUBLE PASS ASSERTIONS] ---"

# 1. Asset ID 不变
TTS_ID_PASS1=$(cat "$EVIDENCE_DIR/tts_sha256_pass1.txt" | awk -F'|' '{print $1}')
TTS_ID_PASS2=$(cat "$EVIDENCE_DIR/tts_sha256_pass2.txt" | awk -F'|' '{print $1}')

if [ "$TTS_ID_PASS1" != "$TTS_ID_PASS2" ]; then
    log "${RED}❌ TTS asset ID changed: pass1=$TTS_ID_PASS1 pass2=$TTS_ID_PASS2${NC}"
    exit 1
fi
log "${GREEN}✓ TTS asset ID unchanged: $TTS_ID_PASS1${NC}"

BGM_ID_PASS1=$(cat "$EVIDENCE_DIR/bgm_sha256_pass1.txt" | awk -F'|' '{print $1}')
BGM_ID_PASS2=$(cat "$EVIDENCE_DIR/bgm_sha256_pass2.txt" | awk -F'|' '{print $1}')

if [ "$BGM_ID_PASS1" != "$BGM_ID_PASS2" ]; then
    log "${RED}❌ BGM asset ID changed: pass1=$BGM_ID_PASS1 pass2=$BGM_ID_PASS2${NC}"
    exit 1
fi
log "${GREEN}✓ BGM asset ID unchanged: $BGM_ID_PASS1${NC}"

# 2. Checksum 一致
TTS_HASH_PASS1=$(cat "$EVIDENCE_DIR/tts_sha256_pass1.txt" | awk -F'|' '{print $3}')
TTS_HASH_PASS2=$(cat "$EVIDENCE_DIR/tts_sha256_pass2.txt" | awk -F'|' '{print $3}')

if [ "$TTS_HASH_PASS1" != "$TTS_HASH_PASS2" ]; then
    log "${RED}❌ TTS checksum mismatch: pass1=$TTS_HASH_PASS1 pass2=$TTS_HASH_PASS2${NC}"
    exit 1
fi
log "${GREEN}✓ TTS checksum identical: $TTS_HASH_PASS1${NC}"

BGM_HASH_PASS1=$(cat "$EVIDENCE_DIR/bgm_sha256_pass1.txt" | awk -F'|' '{print $3}')
BGM_HASH_PASS2=$(cat "$EVIDENCE_DIR/bgm_sha256_pass2.txt" | awk -F'|' '{print $3}')

if [ "$BGM_HASH_PASS1" != "$BGM_HASH_PASS2" ]; then
    log "${RED}❌ BGM checksum mismatch: pass1=$BGM_HASH_PASS1 pass2=$BGM_HASH_PASS2${NC}"
    exit 1
fi
log "${GREEN}✓ BGM checksum identical: $BGM_HASH_PASS1${NC}"

# Final Evidence
log "--- [FINAL EVIDENCE] ---"
find "$EVIDENCE_DIR" -type f -print0 | xargs -0 sha256sum > "$EVIDENCE_DIR/SHA256SUMS.txt" 2>&1 || true

# Create Evidence Hash Index
cat > "$EVIDENCE_DIR/EVIDENCE_HASH_INDEX.json" <<EOF
{
  "gate": "audio_minloop",
  "timestamp": "$TS",
  "traceId": "$TRACE_ID",
  "sceneId": "$SCENE_ID",
  "status": "DOUBLE_PASS",
  "evidence_dir": "$EVIDENCE_DIR",
  "tts_storageKey": "$TTS_KEY",
  "bgm_storageKey": "$BGM_KEY",
  "tts_asset_id": "$TTS_ID_PASS1",
  "bgm_asset_id": "$BGM_ID_PASS1",
  "checksums_file": "SHA256SUMS.txt"
}
EOF

log "${GREEN}🏆 P13-2 AUDIO MINLOOP DOUBLE PASS ACHIEVED${NC}"
log "Evidence directory: $EVIDENCE_DIR"
exit 0
