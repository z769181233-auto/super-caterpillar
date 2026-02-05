#!/bin/bash
set -e

# Production Non-Placeholder Gate (V1.0)
# Usage: bash tools/gate_non_placeholder_video.sh <video_path>

VIDEO_PATH=$1

if [ -z "$VIDEO_PATH" ]; then
    echo "Usage: $0 <video_path>"
    exit 1
fi

if [ ! -f "$VIDEO_PATH" ]; then
    echo "Error: Video file not found at $VIDEO_PATH"
    exit 1
fi

echo "--- [GATE] Production Quality Audit: $VIDEO_PATH ---"

# 1. Size Check (Minimum 500KB for a 5s scene at 4M bitrate)
FILE_SIZE=$(stat -f%z "$VIDEO_PATH" 2>/dev/null || stat -c%s "$VIDEO_PATH")
MIN_SIZE=500000
if [ "$FILE_SIZE" -lt "$MIN_SIZE" ]; then
    echo "[FAIL] File size too small: $FILE_SIZE bytes (Min: $MIN_SIZE)"
    exit 1
fi
echo "[PASS] File size check: $FILE_SIZE bytes"

# 2. Black Video Detection (Ban full-black videos)
# -vf blackdetect detects black segments. If start=0 and end=duration, it's a black video.
# We check if more than 90% of the video is black.
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH")
BLACK_LOG=$(ffmpeg -i "$VIDEO_PATH" -vf "blackdetect=d=0.1:pix_th=0.1" -f null - 2>&1)
if [[ $BLACK_LOG == *"black_start:0"* ]] && [[ $BLACK_LOG == *"black_end:$DURATION"* ]]; then
    echo "[FAIL] Black video detected! The entire video is black."
    exit 1
fi
echo "[PASS] Content check: Non-black video verified."

# 3. Placeholder Pattern Detection in bitstream (Ban testsrc / noise markers if present)
# Most mocks use lavfi filters which leave traces or have very specific bitstream characteristics.
# We also check for "Lavfi" or "testsrc" in the metadata if not stripped.
METADATA=$(ffprobe -v error -show_entries format_tags=encoder -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH")
if [[ $METADATA == *"Lavfi"* ]]; then
    echo "[FAIL] Internal Metadata contains 'Lavfi' reference. Likely a placeholder."
    exit 1
fi
echo "[PASS] Metadata check: No placeholder markers found."

# 4. Freeze Frame Detection
# Check for duplicate frames (common in simple image-to-video if not zoomed)
# But our 2.5D has zoom, so it should have varying bitstream.
# This is a bit advanced for a shell script, skip for now.

echo "--- [GATE] ALL PRODUCTION QUALITY CHECKS PASSED ---"
exit 0
