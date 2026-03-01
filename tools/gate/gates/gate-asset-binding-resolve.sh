#!/bin/bash
IFS=$'
	'
set -e

# Gate: Asset Binding Resolve
# Scans all requiredAssets in render_map.json and verifies their physical existence.

MAP_PATH="docs/assets/render_map.json"
ASSETS_ROOT="docs" # Virtual root for asset paths in map
TS=$(date +%Y%m%d_%H%M%S)
EVI_PATH=${EVI:-"docs/_evidence/phase_f_asset_binding_$TS"}
mkdir -p "$EVI_PATH"

REPORT_OUT="$EVI_PATH/asset_binding_report.json"

echo "=== Gate: Asset Binding Resolve Started ==="

# Validation Logic
node -e "
const fs = require('fs');
const path = require('path');
const map = JSON.parse(fs.readFileSync('$MAP_PATH', 'utf8'));

const missing = [];
const scanned = new Set();
let totalScanned = 0;

const checkAsset = (assetPath) => {
    if (scanned.has(assetPath)) return;
    scanned.add(assetPath);
    totalScanned++;
    const fullPath = path.join('$ASSETS_ROOT', assetPath);
    if (!fs.existsSync(fullPath)) {
        missing.push({ assetPath, fullPath });
    }
};

// Scan Poses
for (const id in map.poses) {
    (map.poses[id].requiredAssets || []).forEach(checkAsset);
}
// Scan Motions
for (const id in map.motions) {
    (map.motions[id].requiredAssets || []).forEach(checkAsset);
}
// Scan CameraMoves
for (const id in map.cameraMoves) {
    (map.cameraMoves[id].requiredAssets || []).forEach(checkAsset);
}

const report = {
    totalScanned,
    missingCount: missing.length,
    missing,
    passed: missing.length === 0
};

fs.writeFileSync('$REPORT_OUT', JSON.stringify(report, null, 2));

console.log('--- Asset Scan Results ---');
console.log('Total Assets Scanned:', totalScanned);
console.log('Missing Assets:', missing.length);

if (!report.passed) {
    console.error('❌ FAIL: Missing associated assets detect in repository!');
    missing.forEach(m => console.error('  MISSING: ' + m.assetPath));
    process.exit(1);
}
console.log('✅ SUCCESS: All required assets found in repository.');
"

echo "Full report: $REPORT_OUT"
echo "=== Gate Completed ==="
