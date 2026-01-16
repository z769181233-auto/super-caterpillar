#!/bin/bash
# gate-shot-render-real-assert.sh
# 真实渲染断言门禁：验证 .runtime/renders 下的产物是否符合真实渲染标准

set -euo pipefail

TARGET_DIR=${1:-".runtime/renders"}
MIN_DIM=512
MIN_SIZE_KB=20

echo "==== [GATE] Real Shot Render Assertion: $TARGET_DIR ===="

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Target directory $TARGET_DIR does not exist."
  exit 1
fi

FILES=$(find "$TARGET_DIR" -type f \( -name "*.png" -o -name "*.jpg" \))

if [ -z "$FILES" ]; then
  echo "Error: No image files found in $TARGET_DIR"
  exit 1
fi

FAIL_COUNT=0
TOTAL_COUNT=0

for f in $FILES; do
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  echo "Checking: $f"
  
  # 1. Decodability & Resolution Check using ffprobe
  # ffprobe output format: width|height
  DIM=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$f" || echo "FAIL")
  
  if [ "$DIM" == "FAIL" ]; then
    echo "  [FAIL] Cannot decode file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  WIDTH=$(echo "$DIM" | cut -dx -f1)
  HEIGHT=$(echo "$DIM" | cut -dx -f2)
  
  echo "  Resolution: ${WIDTH}x${HEIGHT}"
  
  if [ "$WIDTH" -lt "$MIN_DIM" ] || [ "$HEIGHT" -lt "$MIN_DIM" ]; then
    echo "  [FAIL] Resolution below minimum ${MIN_DIM}x${MIN_DIM}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  if [ "$WIDTH" -eq 2 ] && [ "$HEIGHT" -eq 2 ]; then
    echo "  [FAIL] Detected 2x2 placeholder!"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  # 3. Pixel Variance Check (Prevent Pure Color/Empty Images)
  # Uses ffmpeg to compute standard deviation of Y component.
  # Variance < 1.0 (approx) means the image is nearly uniform.
  VARIANCE=$(ffmpeg -i "$f" -vf "format=yuv420p,split[a][b];[b]lutrgb=r=0:g=0:b=0[c];[a][c]psnr" -f null - 2>&1 | grep "stddev" | head -n 1 | awk '{print $5}' || echo "100.0")
  # Use a more robust method: showinfo + grep 'stddev'
  STDDEV=$(ffmpeg -i "$f" -vf "format=gray,showinfo" -f null - 2>&1 | grep "stddev" | awk -F'stddev:' '{print $2}' | awk '{print $1}' | head -n 1 || echo "0.0")
  
  echo "  Pixel StdDev (Gray): $STDDEV"
  
  # Min StdDev threshold to avoid pure black/white/flat color
  MIN_STDDEV="2.0"
  if (( $(echo "$STDDEV < $MIN_STDDEV" | bc -l) )); then
    echo "  [FAIL] Pixel variance too low ($STDDEV < $MIN_STDDEV). Possible pure color or placeholder."
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  echo "  [PASS]"
done

# 4. MP4 moov atom & ffprobe check
VIDEO_DIR=".runtime/videos"
if [ -d "$VIDEO_DIR" ]; then
  echo "==== [GATE] Video Archive Assertion: $VIDEO_DIR ===="
  MP4S=$(find "$VIDEO_DIR" -name "*.mp4")
  if [ -z "$MP4S" ]; then
    echo "  [WARN] No mp4 files found in $VIDEO_DIR"
  else
    for v in $MP4S; do
      echo "Checking Video: $v"
      if ! ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$v" >/dev/null; then
        echo "  [FAIL] ffprobe failed (possible moov atom missing or corrupt)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
      else
        echo "  [PASS] ffprobe ok"
      fi
    done
  fi
fi

echo "==== [GATE] SUMMARY ===="
echo "Total checked: $TOTAL_COUNT"
echo "Failed: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 1
else
  echo "RESULT: PASS"
  exit 0
fi
