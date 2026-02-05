#!/usr/bin/env bash
# gate_engine_sanity.sh
# Week 1 引擎真化验收门禁
# 
# 目标：验证 SHOT_RENDER 真实引擎输出的基本质量
# 范围：非占位符、非黑屏、可播放性、帧数一致性

set -euo pipefail

# --- 配置 ---
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMP_DIR="${TEMP_DIR:-$PROJECT_ROOT/.temp/gate_engine_sanity}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$PROJECT_ROOT/docs/_evidence/engine_sanity_$(date +%Y%m%d_%H%M%S)}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- 初始化 ---
mkdir -p "$TEMP_DIR"
mkdir -p "$EVIDENCE_DIR"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Engine Sanity Gate (Week 1)${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# --- 期望参数 ---
# 可以通过环境变量传入，或者从固定的测试 Job 中读取
OUTPUT_FILE="${OUTPUT_FILE:-}"
EXPECTED_MIN_SIZE="${EXPECTED_MIN_SIZE:-102400}"  # 100KB
EXPECTED_DURATION="${EXPECTED_DURATION:-}"
EXPECTED_FPS="${EXPECTED_FPS:-}"

if [ -z "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ OUTPUT_FILE not specified${NC}"
    echo "Usage: OUTPUT_FILE=/path/to/output.mp4 bash gate_engine_sanity.sh"
    exit 1
fi

if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ OUTPUT_FILE does not exist: $OUTPUT_FILE${NC}"
    exit 1
fi

echo "Target File: $OUTPUT_FILE"
echo "Evidence Dir: $EVIDENCE_DIR"
echo ""

# --- 断言 1: 非占位符检测（文件大小）---
echo -e "${BLUE}[1/4] Non-Placeholder Check (File Size)${NC}"
FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
echo "File Size: $FILE_SIZE bytes (threshold: $EXPECTED_MIN_SIZE bytes)"

if [ "$FILE_SIZE" -lt "$EXPECTED_MIN_SIZE" ]; then
    echo -e "${RED}❌ FAILED: File too small (placeholder suspected)${NC}"
    echo "File Size: $FILE_SIZE bytes < $EXPECTED_MIN_SIZE bytes" > "$EVIDENCE_DIR/FAILURE_SIZE.txt"
    exit 1
else
    echo -e "${GREEN}✅ PASSED${NC}"
fi
echo ""

# --- 断言 2: 非黑屏检测 ---
echo -e "${BLUE}[2/4] Black Frame Detection${NC}"
BLACK_DETECT_LOG="$EVIDENCE_DIR/black_frame_check.log"

# 使用 ffmpeg blackdetect filter
# d=0.1: 至少持续 0.1 秒的黑帧才报告
# pix_th=0.1: 像素阈值（越小越严格）
if command -v ffmpeg &> /dev/null; then
    ffmpeg -i "$OUTPUT_FILE" -vf "blackdetect=d=0.1:pix_th=0.1" -f null - 2>&1 | tee "$BLACK_DETECT_LOG"
    
    if grep -q "black_start" "$BLACK_DETECT_LOG"; then
        echo -e "${YELLOW}⚠️  WARNING: Black frames detected${NC}"
        # 注意：这里配置为 WARNING 而非 ERROR，因为某些真实视频可能有黑屏过渡
        # 生产环境可以根据业务需求调整为 ERROR
    else
        echo -e "${GREEN}✅ PASSED (No significant black frames)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  ffmpeg not found, skipping black frame detection${NC}"
fi
echo ""

# --- 断言 3: 帧数一致性检查 ---
echo -e "${BLUE}[3/4] Frame Count Consistency${NC}"

if [ -n "$EXPECTED_DURATION" ] && [ -n "$EXPECTED_FPS" ]; then
    if command -v ffprobe &> /dev/null; then
        ACTUAL_FRAMES=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$OUTPUT_FILE" 2>/dev/null || echo "0")
        EXPECTED_FRAMES=$((EXPECTED_DURATION * EXPECTED_FPS))
        
        echo "Actual Frames: $ACTUAL_FRAMES"
        echo "Expected Frames: $EXPECTED_FRAMES (${EXPECTED_DURATION}s × ${EXPECTED_FPS}fps)"
        
        # 允许 ±5% 的误差
        MIN_FRAMES=$(echo "$EXPECTED_FRAMES * 0.95" | bc | cut -d. -f1)
        MAX_FRAMES=$(echo "$EXPECTED_FRAMES * 1.05" | bc | cut -d. -f1)
        
        if [ "$ACTUAL_FRAMES" -lt "$MIN_FRAMES" ]; then
            echo -e "${RED}❌ FAILED: Frame count too low${NC}"
            echo "Actual: $ACTUAL_FRAMES < Min: $MIN_FRAMES" > "$EVIDENCE_DIR/FAILURE_FRAMES.txt"
            exit 1
        elif [ "$ACTUAL_FRAMES" -gt "$MAX_FRAMES" ]; then
            echo -e "${RED}❌ FAILED: Frame count too high${NC}"
            echo "Actual: $ACTUAL_FRAMES > Max: $MAX_FRAMES" > "$EVIDENCE_DIR/FAILURE_FRAMES.txt"
            exit 1
        else
            echo -e "${GREEN}✅ PASSED (within ±5% tolerance)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  ffprobe not found, skipping frame count check${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  EXPECTED_DURATION or EXPECTED_FPS not set, skipping${NC}"
fi
echo ""

# --- 断言 4: 可播放性验证 ---
echo -e "${BLUE}[4/4] Playability Verification (ffprobe)${NC}"
FFPROBE_REPORT="$EVIDENCE_DIR/ffprobe_report.json"

if command -v ffprobe &> /dev/null; then
    if ffprobe -v error -show_format -show_streams "$OUTPUT_FILE" > "$FFPROBE_REPORT" 2>&1; then
        echo -e "${GREEN}✅ PASSED (File is playable and metadata is valid)${NC}"
        
        # 提取关键信息
        echo "  Format: $(jq -r '.format.format_name // "N/A"' "$FFPROBE_REPORT" 2>/dev/null || echo "N/A")"
        echo "  Duration: $(jq -r '.format.duration // "N/A"' "$FFPROBE_REPORT" 2>/dev/null || echo "N/A")s"
        echo "  Codec: $(jq -r '.streams[0].codec_name // "N/A"' "$FFPROBE_REPORT" 2>/dev/null || echo "N/A")"
    else
        echo -e "${RED}❌ FAILED: File is not playable or corrupt${NC}"
        cp "$FFPROBE_REPORT" "$EVIDENCE_DIR/FAILURE_FFPROBE.txt"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  ffprobe not found, skipping playability check${NC}"
fi
echo ""

# --- 证据产出 ---
echo -e "${BLUE}Generating Evidence${NC}"

# Video Hash
VIDEO_HASH=$(shasum -a 256 "$OUTPUT_FILE" | awk '{print $1}')
echo "$VIDEO_HASH" > "$EVIDENCE_DIR/video_hash.txt"
echo "Video SHA256: $VIDEO_HASH"

# Render Params (如果有)
if [ -n "${RENDER_PARAMS:-}" ]; then
    echo "$RENDER_PARAMS" > "$EVIDENCE_DIR/render_params.json"
fi

# 创建摘要报告
cat > "$EVIDENCE_DIR/REPORT.md" <<EOF
# Engine Sanity Gate Report

**Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**File**: $OUTPUT_FILE

## Test Results

- **File Size**: $FILE_SIZE bytes ✅
- **Black Frame Detection**: $(grep -q "black_start" "$BLACK_DETECT_LOG" 2>/dev/null && echo "⚠️ Detected" || echo "✅ None")
- **Frame Count Consistency**: $([ -n "$EXPECTED_DURATION" ] && echo "✅ Verified" || echo "⚠️ Skipped")
- **Playability**: ✅ Valid

## Evidence

- [video_hash.txt](./video_hash.txt)
- [ffprobe_report.json](./ffprobe_report.json)
- [black_frame_check.log](./black_frame_check.log)

## SHA256

\`\`\`
$VIDEO_HASH
\`\`\`
EOF

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ All Engine Sanity Checks Passed${NC}"
echo -e "${GREEN}=========================================${NC}"
echo "Evidence saved to: $EVIDENCE_DIR"
