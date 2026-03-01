#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

TS="$(date +%Y%m%dT%H%M%S)"
EVDIR="docs/_evidence/P0_R2_VIDEO_MERGE_GUARDRAILS_$TS"
mkdir -p "$EVDIR"

LOG="$EVDIR/gate.log"
echo "=== GATE P0-R2 [VIDEO_MERGE_GUARDRAILS] START ===" | tee "$LOG"

# Set up environment
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "[1/3] Assert spawnWithTimeout kills on timeout (deterministic sleep)..." | tee -a "$LOG"
npx tsx tools/gate/gates/helper_p0r2_test.ts timeout | tee -a "$LOG"

echo "[2/3] Assert -threads applied via provider log (default=1 and override=2)..." | tee -a "$LOG"

# Generate minimal PNG frames
npx tsx - <<'NODE'
const fs = require('fs');
const path = require('path');
const minPng = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffffff3f0005fe02fe0dc444200000000049454e44ae426082', 'hex');

const tmpDir = ".tmp/p0r2_frames";
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

for (let i = 0; i < 3; i++) {
  fs.writeFileSync(path.join(tmpDir, `f${i}.png`), minPng);
}
NODE

# Run provider test
npx tsx tools/gate/gates/helper_p0r2_test.ts threads | tee -a "$LOG"

# Assert logs
# These greps depend on the output of helper_p0r2_test.ts which should contain these patterns
grep -q "video_merge_spawn jobId=p0r2_default .*ffmpeg_threads=1" "$LOG" || { echo "❌ missing threads=1 log"; exit 1; }
grep -q "video_merge_spawn jobId=p0r2_threads2 .*ffmpeg_threads=2" "$LOG" || { echo "❌ missing threads=2 log"; exit 1; }

echo "[3/3] PASS" | tee -a "$LOG"
echo "GATE P0-R2 [VIDEO_MERGE_GUARDRAILS]: PASS" | tee -a "$LOG"

# Archive evidence for sealer
mkdir -p docs/_evidence
cp "$LOG" "docs/_evidence/P0_R2_VIDEO_MERGE_GUARDRAILS_EVIDENCE.txt"
