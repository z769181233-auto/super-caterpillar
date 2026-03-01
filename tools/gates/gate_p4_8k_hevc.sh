#!/bin/bash
# P4-0: 8K HEVC Quality Gate
set -e

VIDEO_FILE=$1
if [ -z "$VIDEO_FILE" ]; then
    echo "Usage: $0 <video_file>"
    exit 1
fi

echo "--- [GATE] P4 8K HEVC Quality Audit ---"

# 1. 解析元数据
JSON_META=$(ffprobe -v error -show_format -show_streams -of json "$VIDEO_FILE")

CODEC=$(echo "$JSON_META" | jq -r '.streams[0].codec_name')
WIDTH=$(echo "$JSON_META" | jq -r '.streams[0].width')
HEIGHT=$(echo "$JSON_META" | jq -r '.streams[0].height')
PIX_FMT=$(echo "$JSON_META" | jq -r '.streams[0].pix_fmt')
DURATION=$(echo "$JSON_META" | jq -r '.format.duration')
SIZE=$(echo "$JSON_META" | jq -r '.format.size')

echo "Codec: $CODEC"
echo "Resolution: ${WIDTH}x${HEIGHT}"
echo "PixFmt: $PIX_FMT"
echo "Duration: ${DURATION}s"
echo "Size: ${SIZE} bytes"

# 2. 强断言
[ "$CODEC" == "hevc" ] || (echo "FAILED: Codec is not HEVC ($CODEC)"; exit 1)
[ "$WIDTH" == "7680" ] || (echo "FAILED: Width is not 8K ($WIDTH)"; exit 1)
[ "$HEIGHT" == "4320" ] || (echo "FAILED: Height is not 8K ($HEIGHT)"; exit 1)

# 支持 10bit 或 8bit (yuv420p10le/yuv420p)
if [[ "$PIX_FMT" != "yuv420p10le" && "$PIX_FMT" != "yuv420p" ]]; then
    echo "FAILED: Unsupported Pixel Format ($PIX_FMT)"
    exit 1
fi

if (( $(echo "$DURATION < 3.0" | bc -l) )); then
    echo "FAILED: Duration too short ($DURATION < 3s)"
    exit 1
fi

if [ "$SIZE" -lt 204800 ]; then
    echo "FAILED: File size too small ($SIZE < 200KB)"
    exit 1
fi

echo "--- [GATE] 8K HEVC QUALITY PASS ---"
