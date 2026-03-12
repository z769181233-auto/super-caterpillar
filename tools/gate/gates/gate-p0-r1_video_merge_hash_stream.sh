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

# === STAGE 1: DD ===
echo "[STAGE 1] Generating 512MB test file at $TMP..." | tee -a "$LOG"
rm -f "$TMP"
if ! dd if=/dev/zero of="$TMP" bs=1m count=512 2>/dev/null; then
    echo "FAIL_STAGE_1_DD: dd command returned non-zero" | tee -a "$LOG"
    exit 11
fi
echo "[STAGE 1] dd done" | tee -a "$LOG"

# === STAGE 2: File Check ===
echo "[STAGE 2] Checking generated file..." | tee -a "$LOG"
if [ ! -f "$TMP" ]; then
    echo "FAIL_STAGE_2_FILE_CHECK: File not found after dd" | tee -a "$LOG"
    exit 12
fi
ls -lh "$TMP" | tee -a "$LOG"
echo "[STAGE 2] file check passed" | tee -a "$LOG"

# === STAGE 3: Node Execution ===
NODE_SCRIPT="$TMP.js"
NODE_OUT="$TMP.out"

cat > "$NODE_SCRIPT" <<'NODE'
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
    console.error("FAIL_STAGE_3_NODE_EXEC: Test file not found by Node");
    process.exit(13);
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
    console.error(`FAIL_STAGE_4_RSS_LIMIT: OOM-risk RSS delta too high: ${deltaMB.toFixed(2)} MB`);
    process.exit(14);
  }
  console.log("✅ RSS delta is within safe limits");
})();
NODE

echo "[STAGE 3] Running Node memory check..." | tee -a "$LOG"
set +e
node "$NODE_SCRIPT" "$TMP" > "$NODE_OUT" 2>&1
RC=$?
set -e

echo "[STEP] node exit code=$RC" | tee -a "$LOG"
echo "--- Node STDOUT/STDERR Start ---" | tee -a "$LOG"
cat "$NODE_OUT" | tee -a "$LOG"
echo "--- Node STDOUT/STDERR End ---" | tee -a "$LOG"

if [ $RC -ne 0 ]; then
    if grep -q "FAIL_STAGE_4_RSS_LIMIT" "$NODE_OUT"; then
        echo "FAIL_STAGE_4_RSS_LIMIT: rss delta exceeded threshold" | tee -a "$LOG"
    elif grep -q "FAIL_STAGE_3_NODE_EXEC" "$NODE_OUT"; then
        echo "FAIL_STAGE_3_NODE_EXEC: file missing at node startup" | tee -a "$LOG"
    else
        echo "FAIL_STAGE_4_NODE_CRASH: Node crashed unexpectedly with exit code $RC" | tee -a "$LOG"
    fi
    exit $RC
fi

echo "[STAGE 4] Node execution completed perfectly" | tee -a "$LOG"

# Cleanup
rm -f "$TMP" "$NODE_SCRIPT" "$NODE_OUT"
echo "GATE P0-R1 [VIDEO_MERGE_HASH_STREAM]: PASS" | tee -a "$LOG"
exit 0
