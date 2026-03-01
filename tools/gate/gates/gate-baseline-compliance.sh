#!/bin/bash
IFS=$'
	'
set -e

SSOT_FILE="docs/RENDER_PLAN_SSOT.md"
SAMPLE_PATH="docs/story_bank/season_01/produced/E0001_full.shot.json"
MAP_PATH="docs/assets/render_map.json"

echo "=== Gate: Baseline Compliance Started ==="

# Final attempt at robust matching: use a dedicated JS script with literal matching
if ! node -e "
const fs = require('fs');
const crypto = require('crypto');

const ssot = fs.readFileSync('$SSOT_FILE', 'utf8');
const sample = fs.readFileSync('$SAMPLE_PATH');
const map = fs.readFileSync('$MAP_PATH');

const getSha = (content) => crypto.createHash('sha256').update(content).digest('hex');

const findSha = (key) => {
    const lines = ssot.split('\n');
    for (const line of lines) {
        if (line.includes(key)) {
            const match = line.match(/\`([a-f0-9]{64})\`/);
            if (match) return match[1];
        }
    }
    return null;
};

const expectedSampleSha = findSha('sampleShotSpecSha256');
const expectedMapSha = findSha('render_map_sha256');

const actualSampleSha = getSha(sample);
const actualMapSha = getSha(map);

console.log('Expected Sample SHA:', expectedSampleSha);
console.log('Actual Sample SHA:  ', actualSampleSha);
console.log('Expected Map SHA:   ', expectedMapSha);
console.log('Actual Map SHA:     ', actualMapSha);

if (!expectedSampleSha || !expectedMapSha || expectedSampleSha !== actualSampleSha || expectedMapSha !== actualMapSha) {
    process.exit(1);
}
"; then
    echo "❌ FAIL: Baseline fingerprints mismatch SSOT seal block!"
    exit 1
fi

echo "✅ SUCCESS: Baseline fingerprints match SSOT seal block."
echo "=== Gate Completed ==="
