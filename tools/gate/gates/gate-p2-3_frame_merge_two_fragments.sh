#!/bin/bash
# P2-3 Gate: Frame Merge Two Fragments (Minimum Closed Loop)
# 目标：验证 2 个视频片段合并，固化运行态证据。

set -euo pipefail

GATE_NAME="P2_3_FRAME_MERGE"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVI_DIR="apps/workers/.runtime/_evidence/p2_3_merge_$TIMESTAMP"
mkdir -p "$EVI_DIR"

echo "[$GATE_NAME] START - Evidence at $EVI_DIR"

# 1. Prepare dummy inputs (Source from PNG or generate 1s black clip)
CLIP1="$EVI_DIR/clip_1.mp4"
CLIP2="$EVI_DIR/clip_2.mp4"

echo "[$GATE_NAME] Generating dummy clips..."
ffmpeg -y -f lavfi -i color=c=black:s=512x512:d=1 -pix_fmt yuv420p "$CLIP1" > /dev/null 2>&1
ffmpeg -y -f lavfi -i color=c=blue:s=512x512:d=1 -pix_fmt yuv420p "$CLIP2" > /dev/null 2>&1

echo "clip_1: $(du -h "$CLIP1")"
echo "clip_2: $(du -h "$CLIP2")"

# 2. Invoke Merge Engine via Runner
RUNNER="tools/gate/runners/run-p2-3-merge.ts"
PROJECT_ROOT=$(pwd)

echo "[$GATE_NAME] Invoking Merge Engine..."
# 使用 ts-node 运行，确保包含 engine 依赖
npx ts-node -r tsconfig-paths/register "$RUNNER" "$CLIP1" "$CLIP2" | tee "$EVI_DIR/merge_output.log"

# 3. Extract Result
FINAL_MP4=$(grep -o '"uri": "[^"]*"' "$EVI_DIR/merge_output.log" | cut -d'"' -f4 || echo "")

if [ -z "$FINAL_MP4" ]; then
    echo "[$GATE_NAME] ❌ FAILED: No output MP4 path found in log"
    exit 1
fi

echo "[$GATE_NAME] Final MP4: $FINAL_MP4"

# 4. Validation
echo "[$GATE_NAME] Validating result..."

if [ ! -f "$FINAL_MP4" ]; then
    echo "[$GATE_NAME] ❌ FAILED: Final MP4 file does not exist at $FINAL_MP4"
    exit 1
fi

SIZE=$(stat -f%z "$FINAL_MP4" 2>/dev/null || stat -c%s "$FINAL_MP4")
if [ "$SIZE" -le 0 ]; then
    echo "[$GATE_NAME] ❌ FAILED: Final MP4 size is 0"
    exit 1
fi
echo "[$GATE_NAME] ✅ Size check passed: $SIZE bytes"

# ffprobe check
ffprobe -v error -show_format -show_streams "$FINAL_MP4" > "$EVI_DIR/ffprobe_output.txt"
echo "[$GATE_NAME] ✅ ffprobe check passed"

# Duration check (should be ~2s)
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$FINAL_MP4")
echo "[$GATE_NAME] Duration: $DURATION s"
# Simple check: duration >= 1.5 (allowing for codec variations)
if (( $(echo "$DURATION < 1.5" | bc -l) )); then
    echo "[$GATE_NAME] ❌ FAILED: Duration $DURATION too small (expected ~2s)"
    exit 1
fi
echo "[$GATE_NAME] ✅ Duration check passed"

# 5. Archive Evidence
cp "$FINAL_MP4" "$EVI_DIR/merged.mp4"
echo '{"input1": "'$CLIP1'", "input2": "'$CLIP2'"}' > "$EVI_DIR/merge_inputs.json"
# Command used is logged in merge_output.log from provider output

( cd "$EVI_DIR" && find . -type f -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt )

echo "[$GATE_NAME] 🏆 PASS (Run at $TIMESTAMP)"
echo "Evidence: $EVI_DIR"
