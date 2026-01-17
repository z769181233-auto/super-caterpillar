#!/usr/bin/env bash
set -e

# ==============================================================================
# Commercial Launch Sealing Script (P4 + Full Gate Suite)
# ==============================================================================

# 1. 基础配置
TS="$(date +%Y%m%d_%H%M%S)"
EVI="docs/_evidence/p4_seal_verification_$TS"
mkdir -p "$EVI"

echo "=== SEALING COMMERCIAL LAUNCH [$TS] ==="
echo "Evidence Directory: $EVI"

# ==============================================================================
# PLAN-1: 导出全量门禁硬证据
# ==============================================================================
echo ""
echo ">>> [PLAN-1] Running Full Gate Suite (Gate 1-11)..."

# 1) 跑全量门禁 (不允许静默)
# 使用 2>&1 | tee 既能看到输出，又能保存日志
bash tools/gate/run_launch_gates.sh 2>&1 | tee "$EVI/run_launch_gates.log"

# 获取上一条命令的退出码 (tee 会掩盖管道前的退出码，使用 PIPESTATUS)
GATE_EXIT_CODE=${PIPESTATUS[0]}

echo "Run exit code: $GATE_EXIT_CODE"

# 2) 汇总最终 PASS/FAIL 行
echo "Extracting summary..."
rg -n "PASS|FAIL|GATE|Gate" "$EVI/run_launch_gates.log" | tail -n 200 > "$EVI/run_launch_gates_tail_200.txt"

# 3) 导出 P4 Gate 的 evidence 目录树
echo "Listing evidence trees..."
ls -la docs/_evidence | rg -n "p4|publish|e2e|seal|gate" | tee "$EVI/evidence_listing.txt" || true
find docs/_evidence -maxdepth 2 -type d | rg -n "p4|publish|e2e|p3|p2_3" | tee "$EVI/evidence_dirs.txt" || true


# ==============================================================================
# PLAN-2: 导出 P4 的 DB 事实 (Reference P4 Run)
# ==============================================================================
echo ""
echo ">>> [PLAN-2] Exporting DB Facts for Reference P4 Run (trace_p4_1768632657)..."

# 使用用户指定的 Reference P4 ID
REF_TRACE="trace_p4_1768632748"
REF_ASSET="ea5505b0-a413-41eb-95e8-160cefe17b14"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

echo "Reference Trace: $REF_TRACE"
echo "Reference Asset: $REF_ASSET"

# 导出 Jobs
psql "$DATABASE_URL" -c "
select id, type, status, priority, \"organizationId\", \"projectId\",
       \"workerId\", locked_by, lease_until, retryCount, maxRetry,
       payload->>'traceId' as traceId,
       payload->>'pipelineRunId' as pipelineRunId,
       left(\"lastError\", 500) as lastError_500
from shot_jobs
where payload->>'traceId' = '$REF_TRACE'
order by \"createdAt\" asc;
" > "$EVI/p4_jobs_by_trace.txt" 2>&1

cat "$EVI/p4_jobs_by_trace.txt"

# 导出 Asset Row
psql "$DATABASE_URL" -c "
select id, \"projectId\", status, type, \"ownerId\", \"ownerType\",
       \"storageKey\", checksum, hls_playlist_url, signed_url, watermark_mode
from assets
where id = '$REF_ASSET';
" > "$EVI/p4_asset_row.txt" 2>&1

cat "$EVI/p4_asset_row.txt"


# ==============================================================================
# PLAN-3: 导出文件系统事实 (Verification)
# ==============================================================================
echo ""
echo ">>> [PLAN-3] Verifying File System & FFprobe..."

# 3.1 从 P4 DB Export 解析路径
# 注意：sql 输出有边框，使用 grep/awk 提取值
# 格式示例:
#  storageKey | ...
# ------------+...
#  secure/... | ...
# (1 row)

# 提取 storageKey (去头去尾去空格)
# 使用 grep -v 排除 header/footer 行
# 使用 awk 提取列 (假设 psql 输出格式固定)
# Better approach: psql -t -A (csv like)
# Re-querying specifically for extraction to variable
# Use -t (tuples only) and -A (no align) to get clean output
# Quote DATABASE_URL to handle special chars
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/scu}"

echo "Checking if asset exists..."
ASSET_EXISTS=$(psql "$DATABASE_URL" -t -A -c "select count(*) from assets where id = '$REF_ASSET';")
echo "Asset count: $ASSET_EXISTS"

if [ "$ASSET_EXISTS" -eq "0" ]; then
  echo "❌ Reference Asset $REF_ASSET not found in DB! Cannot verify file paths."
  # Don't exit yet, let's see what IS in the DB for that trace
  echo "Listing assets for trace $REF_TRACE:"
  psql "$DATABASE_URL" -c "select id, \"storageKey\" from assets where \"storageKey\" like '%$REF_TRACE%';"
  exit 1
fi

MP4_KEY=$(psql "$DATABASE_URL" -t -A -c "select \"storageKey\" from assets where id = '$REF_ASSET';" | tr -d '\r')
HLS_KEY=$(psql "$DATABASE_URL" -t -A -c "select hls_playlist_url from assets where id = '$REF_ASSET';" | tr -d '\r')

if [ -z "$MP4_KEY" ]; then
    echo "❌ Failed to extract MP4_KEY"
    exit 1
fi

if [ -z "$HLS_KEY" ]; then
    echo "❌ Failed to extract HLS_KEY"
    exit 1
fi

echo "Extracted MP4_KEY: $MP4_KEY"
echo "Extracted HLS_KEY: $HLS_KEY"

echo "MP4_KEY=$MP4_KEY" > "$EVI/p4_paths.txt"
echo "HLS_KEY=$HLS_KEY" >> "$EVI/p4_paths.txt"

ROOT_A="apps/workers/.runtime"
ROOT_B=".data/storage"

# 检查文件存在
echo "Checking existence in $ROOT_A..."
ls -la "$ROOT_A/$MP4_KEY" 2>&1 | tee "$EVI/mp4_exists_rootA.txt" || echo "FAIL rootA"
ls -la "$ROOT_A/$HLS_KEY" 2>&1 | tee "$EVI/hls_exists_rootA.txt" || echo "FAIL rootA"

echo "Checking existence in $ROOT_B..."
ls -la "$ROOT_B/$MP4_KEY" 2>&1 | tee "$EVI/mp4_exists_rootB.txt" || echo "FAIL rootB"
ls -la "$ROOT_B/$HLS_KEY" 2>&1 | tee "$EVI/hls_exists_rootB.txt" || echo "FAIL rootB"

# 列出 HLS 目录内容
if [ -n "$HLS_KEY" ]; then
    HLS_DIR="$(dirname "$HLS_KEY")"
    echo "Listing HLS dir: $HLS_DIR"
    find "$ROOT_A/$HLS_DIR" -maxdepth 1 -type f 2>/dev/null | tee "$EVI/hls_files_rootA.txt" || true
    find "$ROOT_B/$HLS_DIR" -maxdepth 1 -type f 2>/dev/null | tee "$EVI/hls_files_rootB.txt" || true
fi

# 3.2 ffprobe 硬验证
echo "Running ffprobe..."
# MP4
ffprobe -v error -show_format -show_streams "$ROOT_A/$MP4_KEY" > "$EVI/ffprobe_mp4_rootA.txt" 2>&1 || true
# HLS
ffprobe -v error -show_format -show_streams "$ROOT_A/$HLS_KEY" > "$EVI/ffprobe_hls_rootA.txt" 2>&1 || true

echo "=== SEALING COMPLETE ==="
echo "Evidence stored in: $EVI"

if [ "$GATE_EXIT_CODE" -eq 0 ]; then
    echo "✅ GATE SUITE PASSED"
else
    echo "❌ GATE SUITE FAILED (Code: $GATE_EXIT_CODE)"
    exit $GATE_EXIT_CODE
fi
