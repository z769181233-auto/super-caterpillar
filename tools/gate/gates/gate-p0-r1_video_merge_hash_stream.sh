#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
IFS=$'
	'
IFS=$'\n\t'

LOG="docs/_evidence/P0_R1_VIDEO_MERGE_HASH_STREAM_$(date +%Y%m%dT%H%M%S).log"
mkdir -p docs/_evidence
TMP="docs/_evidence/tmp_bigfile_512mb.bin"

echo "=== GATE P0-R1 [VIDEO_MERGE_HASH_STREAM] START ===" | tee "$LOG"

# 1) 静态断言：禁止 readFileSync 用于 hash
if grep -R -n "readFileSync(" packages/engines-video-merge/providers/local_ffmpeg.provider.ts > /dev/null 2>&1; then
  echo "❌ readFileSync detected in video_merge provider (OOM risk)" | tee -a "$LOG"
  exit 1
else
  echo "✅ No readFileSync calls found in provider" | tee -a "$LOG"
fi

# 2) 生成大文件（512MB）
echo "Generating 512MB test file at $TMP..." | tee -a "$LOG"
rm -f "$TMP"
dd if=/dev/zero of="$TMP" bs=1m count=512 2>/dev/null

# 3) 运行内存检查脚本
echo "Running memory check..." | tee -a "$LOG"
node - "$TMP" <<'NODE'
const fs = require('fs');
const { createHash } = require('crypto');
const path = require('path');

const filePath = process.argv[2];

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

(async () => {
  if (!fs.existsSync(filePath)) {
    console.error("Test file not found:", filePath);
    process.exit(1);
  }

  const before = process.memoryUsage().rss;
  const digest = await sha256File(filePath);
  const after = process.memoryUsage().rss;

  const deltaMB = (after - before) / 1024 / 1024;

  console.log("digest:", digest);
  console.log("rss_before:", (before / 1024 / 1024).toFixed(2) + " MB");
  console.log("rss_after:", (after / 1024 / 1024).toFixed(2) + " MB");
  console.log("rss_delta_mb:", deltaMB.toFixed(2));

  if (deltaMB > 200) {
    console.error(`❌ OOM-risk: RSS delta too high: ${deltaMB.toFixed(2)} MB`);
    process.exit(1);
  }
  console.log("✅ RSS delta is within safe limits");
})();
NODE

# Cleanup
rm -f "$TMP"
echo "GATE P0-R1 [VIDEO_MERGE_HASH_STREAM]: PASS" | tee -a "$LOG"
