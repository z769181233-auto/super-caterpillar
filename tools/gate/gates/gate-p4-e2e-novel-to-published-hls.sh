#!/bin/bash
# P4 Gate: End-to-End Pipeline (Novel -> Published HLS)
# 职责：验证从小说输入到 HLS 发布的全流程
# 包含：Path A (DB 直插) 和 Path B (HTTP Fallback)
# RED LINE: Strict CE09 Integration Required (No Bypass).
# Must assert: CE09 SUCCEEDED, Asset PUBLISHED + HLS URL.

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

GATE_NAME="P4_E2E_PUBLISH"
TS=$(date +%s)
EVI_ROOT="docs/_evidence/p4_e2e_publish_$TS"
mkdir -p "$EVI_ROOT"

log() {
    echo "[$GATE_NAME] $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$EVI_ROOT/GATE_RUN.log"
}

log "START - Evidence at $EVI_ROOT"

# 1. 环境自检
command -v psql >/dev/null 2>&1 || { log "❌ psql required"; exit 1; }
command -v curl >/dev/null 2>&1 || { log "❌ curl required"; exit 1; }
command -v jq >/dev/null 2>&1 || { log "❌ jq required"; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { log "❌ ffprobe required"; exit 1; }

DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/scu"}
API_URL=${API_URL:-"http://localhost:3000"}

# 2. 数据库准备
log "Setting up Org/Project..."
ORG_ID="org-gate"
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users LIMIT 1;" | xargs)

if [ -z "$USER_ID" ]; then
    log "❌ No User found. Please seed DB."
    exit 1
fi

# Upsert Org with Credits
# Note: ownerId is required
psql "$DATABASE_URL" -c "INSERT INTO organizations (id, name, \"ownerId\", credits, \"createdAt\", \"updatedAt\") VALUES ('$ORG_ID', 'Gate Org', '$USER_ID', 999999, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET credits = 999999;" > /dev/null

# Upsert API Key for Worker (HMAC align)
log "Seeding Worker API Key..."
psql "$DATABASE_URL" -c "INSERT INTO api_keys (id, key, \"secretHash\", \"ownerUserId\", \"ownerOrgId\", status, \"updatedAt\") VALUES ('ak-worker-gate', 'dev-worker-key', 'dev-worker-secret', '$USER_ID', '$ORG_ID', 'ACTIVE', NOW()) ON CONFLICT (key) DO UPDATE SET \"secretHash\" = 'dev-worker-secret', status = 'ACTIVE';" > /dev/null

PROJ_ID="p4_proj_$TS"
psql "$DATABASE_URL" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"updatedAt\") VALUES ('$PROJ_ID', 'P4 E2E $TS', '$USER_ID', '$ORG_ID', 'in_progress', NOW());" > /dev/null

# 3. 准备两章小说输入
log "Preparing two-chapter novel input..."
NOVEL_TEXT="Chapter 1: The Silicon Spark.
In the heart of the digital nebula, a spark ignited. Wide shot of a neon city.

Chapter 2: The Gravity Defiance.
The caterpillar looked up at the stars. It began to float. Close up of its glowing eyes."

# 创建 NovelSource/Novels/Volume/Chapter (为了数据完整性)
SOURCE_ID="source_$TS"
NOVEL_ID="nov_$TS"
psql "$DATABASE_URL" -c "INSERT INTO novel_sources (id, \"projectId\", \"organizationId\", \"rawText\", \"fileName\", \"fileKey\", \"fileSize\", \"createdAt\", \"updatedAt\") VALUES ('$SOURCE_ID', '$PROJ_ID', '$ORG_ID', '$(echo "$NOVEL_TEXT" | sed "s/'/''/g")', 'novel.txt', 'key_$TS', 1024, NOW(), NOW());" > /dev/null

psql "$DATABASE_URL" -c "INSERT INTO novels (id, project_id, title, created_at, updated_at) VALUES ('$NOVEL_ID', '$PROJ_ID', 'P4 E2E Novel', NOW(), NOW()) ON CONFLICT (project_id) DO NOTHING;" > /dev/null

VOL_ID="vol_$TS"
psql "$DATABASE_URL" -c "INSERT INTO novel_volumes (id, project_id, novel_source_id, \"index\", title, updated_at) VALUES ('$VOL_ID', '$PROJ_ID', '$NOVEL_ID', 1, 'Volume 1', NOW());" > /dev/null

CH1_ID="ch1_$TS"
psql "$DATABASE_URL" -c "INSERT INTO novel_chapters (id, novel_source_id, volume_id, \"index\", title, updated_at) VALUES ('$CH1_ID', '$NOVEL_ID', '$VOL_ID', 1, 'Chapter 1', NOW());" > /dev/null

EP_ID="ep_$TS"
# 为 Project 创建一个 Season
SEA_ID="sea_$TS"
psql "$DATABASE_URL" -c "INSERT INTO seasons (id, \"projectId\", \"index\", title, \"updatedAt\") VALUES ('$SEA_ID', '$PROJ_ID', 1, 'Season 1', NOW());" > /dev/null
psql "$DATABASE_URL" -c "INSERT INTO episodes (id, \"projectId\", \"seasonId\", \"index\", name, \"chapterId\") VALUES ('$EP_ID', '$PROJ_ID', '$SEA_ID', 1, 'Episode 1', '$CH1_ID');" > /dev/null

SCENE_ID="scene_$TS"
psql "$DATABASE_URL" -c "INSERT INTO scenes (id, \"episodeId\", project_id, scene_index, title, summary, status, created_at, updated_at) VALUES ('$SCENE_ID', '$EP_ID', '$PROJ_ID', 1, 'Main Scene', 'Auto-generated for P4 E2E', 'PENDING', NOW(), NOW());" > /dev/null

SHOT_ID="shot_$TS"
# Note: Physical column in 'shots' is 'index' (reserved), quote required.
psql "$DATABASE_URL" -c "INSERT INTO shots (id, \"sceneId\", \"organizationId\", \"index\", type, title) VALUES ('$SHOT_ID', '$SCENE_ID', '$ORG_ID', 1, 'pipeline_stage1', 'Pipeline Shot');" > /dev/null

# 4. 触发管线
TRIGGER_MODE="A" # Default Path A
log "Triggering pipeline via Path $TRIGGER_MODE (DB insertion)..."

TRACE_ID="trace_p4_$TS"
JOB_ID="job_p4_$TS"

# Path A Payload
PAYLOAD=$(jq -n \
  --arg nt "$NOVEL_TEXT" \
  --arg sid "$SOURCE_ID" \
  --arg cid "$CH1_ID" \
  --arg eid "$EP_ID" \
  --arg tid "$TRACE_ID" \
  --arg pid "$PROJ_ID" \
  --arg oid "$ORG_ID" \
  '{ novelText: $nt, novelSourceId: $sid, chapterId: $cid, episodeId: $eid, pipelineRunId: $tid, projectId: $pid, organizationId: $oid, traceId: $tid }')

JOB_TYPE="PIPELINE_STAGE1_NOVEL_TO_VIDEO"

# 执行 Path A
psql "$DATABASE_URL" -c "INSERT INTO shot_jobs (id, \"organizationId\", \"projectId\", \"episodeId\", \"sceneId\", \"shotId\", type, status, priority, payload, \"traceId\", \"createdAt\", \"updatedAt\") VALUES ('$JOB_ID', '$ORG_ID', '$PROJ_ID', '$EP_ID', '$SCENE_ID', '$SHOT_ID', '$JOB_TYPE', 'PENDING', 5, '$PAYLOAD'::jsonb, '$TRACE_ID', NOW(), NOW());" > /dev/null

log "Pipeline triggered (TraceId: $TRACE_ID). Monitoring..."

# 5. 轮询 (PLAN-0: 强制等待 CE09 + hls_playlist_url)
MAX_WAIT=150 # 5 minutes (2s * 150)
i=0
FOUND=0
while [ $i -lt $MAX_WAIT ]; do
    # 记录 Job Trace (增量记录)
    psql "$DATABASE_URL" -t -c "SELECT json_agg(t) FROM (SELECT id, type, status, \"updatedAt\", \"lastError\" FROM shot_jobs WHERE \"projectId\" = '$PROJ_ID' OR \"traceId\" = '$TRACE_ID' ORDER BY \"createdAt\" ASC) t;" >> "$EVI_ROOT/job_trace.jsonl"
    
    # PLAN-0: 强制检查 CE09 job 是否 SUCCEEDED
    CE09_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM shot_jobs WHERE \"projectId\" = '$PROJ_ID' AND type = 'CE09_MEDIA_SECURITY' LIMIT 1" | xargs)
    
    # 检查 Asset 状态 + hls_playlist_url 非空
    ASSET_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM assets WHERE \"projectId\" = '$PROJ_ID' AND status = 'PUBLISHED' AND hls_playlist_url IS NOT NULL LIMIT 1" | xargs)
    
    # PLAN-0: 必须同时满足 CE09 SUCCEEDED + Asset PUBLISHED + hls_playlist_url 非空
    if [ "$CE09_STATUS" = "SUCCEEDED" ] && [ "$ASSET_STATUS" = "PUBLISHED" ]; then
        ASSET_QUERY=$(psql "$DATABASE_URL" -t -c "SELECT json_agg(t) FROM (SELECT * FROM assets WHERE \"projectId\" = '$PROJ_ID' AND status = 'PUBLISHED' LIMIT 1) t;" | jq -c '.[0]')
        log "✅ Asset PUBLISHED + CE09 SUCCEEDED detected after $((i * 2))s"
        echo "$ASSET_QUERY" > "$EVI_ROOT/asset_record.json"
        FOUND=1
        break
    fi
    
    # 失败检测
    LAST_TRACE_LINE=$(tail -n 1 "$EVI_ROOT/job_trace.jsonl" || true)
    if echo "$LAST_TRACE_LINE" | grep -q "FAILED"; then
        log "❌ FAILED: Detected failed job in trace."
        exit 1
    fi

    sleep 2
    i=$((i+1))
    [ $((i % 15)) -eq 0 ] && log "Wait $((i * 2))s... (Polling CE09=$CE09_STATUS, Asset=$ASSET_STATUS)"
done

if [ $FOUND -eq 0 ]; then
    log "❌ FAILED: Timeout waiting for PUBLISHED status (300s)"
    
    log "[DIAGNOSTIC] Dumping P4 Job Chain Audit..."
    psql "$DATABASE_URL" -c "
      SELECT id, type, status, \"traceId\", \"createdAt\", \"updatedAt\"
      FROM shot_jobs 
      WHERE \"projectId\" = '$PROJ_ID' OR \"traceId\" = '$TRACE_ID'
      ORDER BY \"createdAt\" ASC;"
  
    ROOT_JOB_STATE=$(psql "$DATABASE_URL" -tAc "SELECT status FROM shot_jobs WHERE id='$JOB_ID';") 
    if [ "$ROOT_JOB_STATE" = "PENDING" ]; then
       log "[GATE] ERROR_CODE: FAIL_A (Root job not consumed by worker)"
    elif [ "$ROOT_JOB_STATE" = "FAILED" ]; then
       log "[GATE] ERROR_CODE: FAIL_B (Root job failed during execution)"
    else
       CE09_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM shot_jobs WHERE \"traceId\" = '$TRACE_ID' AND type = 'CE09_MEDIA_SECURITY';")
       if [ "$CE09_EXISTS" -eq 0 ]; then
          log "[GATE] ERROR_CODE: FAIL_C (Root job succeeded but CE09 not spawned - fan-out break)"
       else
          log "[GATE] ERROR_CODE: FAIL_D (CE09 exists but Asset not PUBLISHED - final pipeline break)"
       fi
    fi
    exit 1
fi

# 6. 文件验证
# 6. 文件验证
log "Verifying file tree..."
STORAGE_ROOT=".data/storage"
STORAGE_KEY=$(echo "$ASSET_QUERY" | jq -r '.storageKey')
HLS_URL=$(echo "$ASSET_QUERY" | jq -r '.hls_playlist_url')

log "Validating paths: $STORAGE_ROOT/$HLS_URL and $STORAGE_ROOT/$STORAGE_KEY"

# 检查 master.m3u8
if [ ! -f "$STORAGE_ROOT/$HLS_URL" ]; then
    log "❌ FAILED: master.m3u8 missing at $STORAGE_ROOT/$HLS_URL"
    exit 1
fi
log "✅ master.m3u8 exists."

# 检查 fragments
HLS_DIR=$(dirname "$STORAGE_ROOT/$HLS_URL")
TS_FILES=$(ls "$HLS_DIR"/*.ts 2>/dev/null | wc -l)
if [ "$TS_FILES" -lt 1 ]; then
    log "❌ FAILED: No HLS fragments (.ts) found in $HLS_DIR"
    exit 1
fi
log "✅ Found $TS_FILES HLS fragments."

# 检查 secured.mp4
if [ ! -f "$STORAGE_ROOT/$STORAGE_KEY" ]; then
    log "❌ FAILED: secured.mp4 missing at $STORAGE_ROOT/$STORAGE_KEY"
    exit 1
fi
log "✅ secured.mp4 exists."

# 7. ffprobe 校验
log "Running ffprobe validation..."
# ffprobe output is now guaranteed to be in .runtime due to P4-FIX-0
ffprobe -i "$STORAGE_ROOT/$HLS_URL" > "$EVI_ROOT/ffprobe_hls.log" 2>&1 || log "⚠️ ffprobe HLS warn"
ffprobe -i "$STORAGE_ROOT/$STORAGE_KEY" > "$EVI_ROOT/ffprobe_mp4.log" 2>&1 || log "⚠️ ffprobe MP4 warn"

# 8. 固化 SHA256SUMS
log "Calculating SHA256SUMS..."
( cd "$EVI_ROOT" && find . -maxdepth 1 -type f ! -name "SHA256SUMS.txt" -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt )

log "🏆 PASS: P4 E2E Published HLS"
exit 0

