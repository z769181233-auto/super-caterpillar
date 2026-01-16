#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "--- [GATE] P0-VIDEO-1 START ---"

# 0) 依赖检查
command -v ffprobe >/dev/null 2>&1 || { echo "[FAIL] ffprobe not found"; exit 2; }
command -v ffmpeg  >/dev/null 2>&1 || { echo "[FAIL] ffmpeg not found"; exit 2; }

# 0.5) DATABASE_URL 强制校验
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] DATABASE_URL is not set. This gate requires database access to locate VIDEO asset."
  echo "[HINT] Run: export DATABASE_URL='postgresql://user:pass@host:5432/dbname?schema=public'"
  echo "[HINT] Or:   source .env.local"
  exit 1
fi

# 1) 说明
echo "[INFO] This gate verifies VIDEO asset creation, storage, and playability."
echo "[INFO] Ensure CE06 -> CE02 -> SHOT_RENDER -> VIDEO_RENDER pipeline has been executed."

# 2) 创建临时查询脚本
QUERY_SCRIPT=$(mktemp /tmp/gate-video-query.XXXXXX.ts)
trap "rm -f $QUERY_SCRIPT" EXIT

cat > "$QUERY_SCRIPT" <<'TYPESCRIPT'
import { PrismaClient, AssetType } from 'database';

const prisma = new PrismaClient();

async function main() {
  const video = await prisma.asset.findFirst({
    where: { 
      type: AssetType.VIDEO,
      storageKey: { startsWith: 'videos/' }  // 严格限制：只选择 videos/ 前缀
    },
    orderBy: { createdAt: 'desc' },
  });
  
  if (!video) {
    console.error('[FAIL] No VIDEO asset found in database');
    process.exit(3);
  }
  
  // 输出 storageKey（用于后续验证）
  console.log(video.storageKey);
  await prisma.$disconnect();
}

main();
TYPESCRIPT

# 3) 使用 tsx 执行查询（确保模块解析正确）
echo "[INFO] Querying VIDEO asset from database..."

# 分离 stdout 和 stderr 以便精确错误处理
TMP_OUT=$(mktemp /tmp/gate-video-out.XXXXXX.txt)
TMP_ERR=$(mktemp /tmp/gate-video-err.XXXXXX.txt)
trap "rm -f $TMP_OUT $TMP_ERR $QUERY_SCRIPT" EXIT

set +e
pnpm tsx "$QUERY_SCRIPT" 1>"$TMP_OUT" 2>"$TMP_ERR"
RC=$?
set -e

if [[ $RC -ne 0 ]]; then
  echo "[FAIL] VIDEO asset query failed (tsx exit code: $RC)"
  echo "[ERROR] stderr output:"
  cat "$TMP_ERR"
  exit 3
fi

STORAGE_KEY=$(tail -n 1 "$TMP_OUT" | tr -d '\r\n')

if [[ -z "$STORAGE_KEY" ]]; then
  echo "[FAIL] No VIDEO asset found in database"
  exit 3
fi

# 验证 storageKey 格式（防止误判：如 "Node.js v24.3.0"）
# 严格限制：videos/ (最终产物) | renders/ (临时帧) | pending/ (中间态)
if [[ "$STORAGE_KEY" != videos/* ]] && [[ "$STORAGE_KEY" != renders/* ]] && [[ "$STORAGE_KEY" != pending/* ]]; then
  echo "[FAIL] storageKey has invalid format: $STORAGE_KEY"
  echo "[HINT] Expected: videos/... or renders/... or pending/..."
  echo "[HINT] Found mock/stage/... data suggests old test residue - clean database first"
  exit 4
fi

echo "[INFO] Found VIDEO asset: $STORAGE_KEY"

if [[ -z "$STORAGE_KEY" ]]; then
  echo "[FAIL] Failed to retrieve VIDEO asset storageKey"
  exit 4
fi

echo "[INFO] Found VIDEO asset: $STORAGE_KEY"

# 4) 检查是否为 pending 状态
if [[ "$STORAGE_KEY" == pending/* ]]; then
  echo "[FAIL] VIDEO asset still in pending state: $STORAGE_KEY"
  exit 5
fi

# 5) 检查文件是否存在
FILE_PATH=".runtime/${STORAGE_KEY}"
if [[ ! -f "$FILE_PATH" ]]; then
  echo "[FAIL] mp4 file not found at path: $FILE_PATH"
  exit 6
fi

echo "[INFO] mp4 file exists: $FILE_PATH"

# 6) ffprobe 验证可播放 + 时长>0
DURATION=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$FILE_PATH" 2>&1 | head -n 1)

if [[ -z "$DURATION" ]] || ! python3 -c "import sys; d=float('$DURATION' or 0); sys.exit(0 if d > 0 else 1)" 2>/dev/null; then
  echo "[FAIL] ffprobe failed or duration is 0: DURATION=$DURATION"
  exit 7
fi

echo "[PASS] Duration: ${DURATION}s"
echo ""
echo "==================================="
echo "✅ P0-VIDEO-1 GATE PASSED"
echo "==================================="
echo "- VIDEO asset exists in database"
echo "- Status: ready (not pending)"
echo "- File exists: $FILE_PATH"
echo "- Playable: YES (duration=${DURATION}s)"
echo "==================================="
