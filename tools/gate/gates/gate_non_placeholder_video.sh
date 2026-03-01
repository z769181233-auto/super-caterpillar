#!/usr/bin/env bash
set -euo pipefail

V="$1"
if [ ! -f "$V" ]; then
  echo "[FAIL] File not found: $V"
  exit 1
fi

echo "==> Verifying: $V"

# 1. Size Check (>1MB)
SZ=$(stat -f %z "$V" 2>/dev/null || stat -c %s "$V")
if [ "$SZ" -lt 1000000 ]; then
  echo "[FAIL] video too small: $SZ bytes (<1MB) :: $V"
  exit 1
fi
echo "[PASS] Size: $SZ bytes"

# 2. Duration Check (>= 3s)
DUR=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$V" | awk '{print int($1)}')
if [ "$DUR" -lt 3 ]; then
  echo "[FAIL] duration too short: ${DUR}s (<3s) :: $V"
  exit 1
fi
echo "[PASS] Duration: ${DUR}s"

# 3. Black Detection
if ffmpeg -hide_banner -nostats -i "$V" -vf "blackdetect=d=0.5:pix_th=0.10" -an -f null - 2>&1 | grep -q "black_start"; then
  echo "[FAIL] black detected :: $V"
  # Optional: print details
  ffmpeg -hide_banner -nostats -i "$V" -vf "blackdetect=d=0.5:pix_th=0.10" -an -f null - 2>&1 | grep "black"
  exit 1
fi
echo "[PASS] Non-Black check passed."

echo "[SUCCESS] Video Verified: $V"
exit 0
