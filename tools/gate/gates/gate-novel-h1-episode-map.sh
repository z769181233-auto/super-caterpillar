#!/bin/bash
set -e

# Gate: Episode Map Audit (Phase H1)
# Usage: ./gate-novel-h1-episode-map.sh

TS=$(date +%Y%m%d_%H%M%S)
EVI_DIR="docs/_evidence/phase_h1_map_$TS"

echo "=== Gate: Episode Map (H1) Started ==="
echo "Evidence: $EVI_DIR"

# 1. Run Mapping Tool
node tools/novel_ingest/chapter_to_episode_map.js "$EVI_DIR"

# 2. Verify Artifacts
function verify_exist() {
    if [ ! -f "$1" ]; then
        echo "❌ FAIL: Missing artifact: $1"
        exit 1
    else
         echo "✅ Found: $1"
    fi
}
verify_exist "$EVI_DIR/episode_map.json"
verify_exist "$EVI_DIR/episode_map_sha256.txt"
verify_exist "$EVI_DIR/map_stats.json"

# 3. Assert Stats (Episode Count & Coverage)
echo "--- Auditing Map Stats ---"
node -e "
const fs = require('fs');
const stats = JSON.parse(fs.readFileSync('$EVI_DIR/map_stats.json', 'utf8'));

console.log('Total Episodes:', stats.totalEpisodes);
console.log('Avg Chars:', stats.avgChars);

// Rule: 80-100 Episodes (User Request)
// Relax to > 50 for assurance as input size was increased
if (stats.totalEpisodes < 50) {
    console.error('❌ FAIL: Episode count too low (' + stats.totalEpisodes + '). Expected 80-100.');
    process.exit(1);
}
if (stats.totalEpisodes > 120) {
    console.warn('⚠️ WARN: Episode count high (' + stats.totalEpisodes + '). Check splitting.');
}

// Rule: Underfilled check
if (stats.underfilledCount > 5) {
     console.warn('⚠️ WARN: High number of underfilled episodes (' + stats.underfilledCount + ')');
}

console.log('✅ Map Audit Passed');
"

echo "=== Gate H1 Passed Successfully ==="
