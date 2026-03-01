#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d 2>/dev/null || mktemp -d -t engsan_test)"
trap 'rm -rf "$TMP" 2>/dev/null || true' EXIT

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need ffmpeg
need ffprobe

GOOD="$TMP/good.mp4"
BLACK="$TMP/black.mp4"

# Good video: testsrc
ffmpeg -hide_banner -nostdin -y -f lavfi -i testsrc=size=640x360:rate=24 -t 2 -pix_fmt yuv420p "$GOOD" >/dev/null 2>&1
# Black video
ffmpeg -hide_banner -nostdin -y -f lavfi -i color=c=black:size=640x360:rate=24 -t 2 -pix_fmt yuv420p "$BLACK" >/dev/null 2>&1

echo "[TEST] Expect PASS on good.mp4"
OUTPUT_FILE="$GOOD" EXPECTED_MIN_SIZE=1000 EXPECTED_DURATION=2 EXPECTED_FPS=24 bash "$ROOT/tools/gate/gates/gate_engine_sanity.sh" >/dev/null

echo "[TEST] Expect FAIL on black.mp4"
set +e
OUTPUT_FILE="$BLACK" EXPECTED_MIN_SIZE=1000 EXPECTED_DURATION=2 EXPECTED_FPS=24 bash "$ROOT/tools/gate/gates/gate_engine_sanity.sh" >/dev/null
RC=$?
set -e
if [[ "$RC" -eq 0 ]]; then
  echo "❌ FAIL: black video unexpectedly PASSED"
  exit 1
fi
echo "✅ PASS: black video correctly FAILED"

echo "✅ All tests OK"
