#!/bin/bash
# P3-1/P3-2 Gate: Safety, Watermark & Fingerprint
# 目标：验证视频安全处理流程（可见水印、HLS 转换、SHA256 指纹）。

set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'

GATE_NAME="P3_MEDIA_SECURITY"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVI_DIR="apps/workers/.runtime/_evidence/p3_security_$TIMESTAMP"
mkdir -p "$EVI_DIR"

echo "[$GATE_NAME] START - Evidence at $EVI_DIR"

# 1. Reuse existing asset from P3-0 or create a new one to be safe
echo "[$GATE_NAME] Preparing source asset..."
SOURCE_MP4="$EVI_DIR/source.mp4"
ffmpeg -y -f lavfi -i color=c=yellow:s=512x512:d=2 -pix_fmt yuv420p "$SOURCE_MP4" > /dev/null 2>&1

# Seed project & asset
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
PROJECT_ID="proj_security_$TIMESTAMP"
VALID_USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users LIMIT 1;" | xargs)
VALID_ORG_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM organizations LIMIT 1;" | xargs)
psql "$DATABASE_URL" -c "INSERT INTO projects (id, name, \"ownerId\", \"organizationId\", status, \"updatedAt\") VALUES ('$PROJECT_ID', 'Security Test Project', '$VALID_USER_ID', '$VALID_ORG_ID', 'in_progress', NOW());" > /dev/null

ASSET_ID="asset_sec_$TIMESTAMP"
OWNER_ID="owner_$TIMESTAMP"
STORAGE_ROOT=".runtime"
REL_PATH="assets/gate_p3/source_$TIMESTAMP.mp4"
mkdir -p "$STORAGE_ROOT/assets/gate_p3"
cp "$SOURCE_MP4" "$STORAGE_ROOT/$REL_PATH"

psql "$DATABASE_URL" -c "INSERT INTO assets (id, \"projectId\", \"ownerId\", \"ownerType\", \"storageKey\", \"type\", \"status\") VALUES ('$ASSET_ID', '$PROJECT_ID', '$OWNER_ID', 'SHOT', '$REL_PATH', 'VIDEO', 'GENERATED');" > /dev/null

# 2. Invoke Media Security Runner
RUNNER="tools/gate/runners/run-p3-media-security.ts"
echo "[$GATE_NAME] Processing security (Watermark/HLS/FP)..."
npx ts-node -r tsconfig-paths/register "$RUNNER" --assetId="$ASSET_ID" --projectId="$PROJECT_ID" | tee "$EVI_DIR/security_run.log"

# 3. Assert Production Output Presence
echo "[$GATE_NAME] Verifying results..."

ASSET_JSON=$(sed -n '/--- ASSET RECORD START ---/,/--- ASSET RECORD END ---/p' "$EVI_DIR/security_run.log" | sed '1d;$d')
echo "$ASSET_JSON" > "$EVI_DIR/final_asset.json"

SECURE_KEY=$(echo "$ASSET_JSON" | grep '"storageKey":' | cut -d'"' -f4)
HLS_PLAYLIST=$(echo "$ASSET_JSON" | grep '"hlsPlaylistUrl":' | cut -d'"' -f4)
FP_ID=$(echo "$ASSET_JSON" | grep '"fingerprintId":' | cut -d'"' -f4)

# 4. Physical file checks
if [ ! -f "$STORAGE_ROOT/$SECURE_KEY" ]; then
    echo "[$GATE_NAME] ❌ FAILED: Secured MP4 not found at $SECURE_KEY"
    exit 1
fi
echo "[$GATE_NAME] ✅ Secured MP4 exists."

if [ ! -f "$STORAGE_ROOT/$HLS_PLAYLIST" ]; then
    echo "[$GATE_NAME] ❌ FAILED: HLS Playlist not found at $HLS_PLAYLIST"
    exit 1
fi
echo "[$GATE_NAME] ✅ HLS Playlist exists."

# 5. Metadata checks
STATUS=$(echo "$ASSET_JSON" | grep '"status":' | cut -d'"' -f4)
if [ "$STATUS" != "PUBLISHED" ]; then
    echo "[$GATE_NAME] ❌ FAILED: Asset status is $STATUS (expected PUBLISHED)"
    exit 1
fi
echo "[$GATE_NAME] ✅ Asset status is PUBLISHED"

if [ -z "$FP_ID" ]; then
    echo "[$GATE_NAME] ❌ FAILED: Fingerprint ID missing"
    exit 1
fi
echo "[$GATE_NAME] ✅ Fingerprint recorded: $FP_ID"

# 6. Watermark visual check hint
echo "[$GATE_NAME] Visual Verification Needed: Captured frame from secured video..."
FRAME_OUT="$EVI_DIR/watermark_check.png"
ffmpeg -y -ss 0.5 -i ".runtime/$SECURE_KEY" -frames:v 1 "$FRAME_OUT" > /dev/null 2>&1
echo "[$GATE_NAME] Watermark check frame saved to $FRAME_OUT"

# 8. Archive & Hash
( cd "$EVI_DIR" && find . -type f -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt )

echo "[$GATE_NAME] 🏆 PASS (Run at $TIMESTAMP)"
echo "Evidence: $EVI_DIR"
