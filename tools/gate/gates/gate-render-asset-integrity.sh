#!/bin/bash
IFS=$'
	'
set -e

# Gate: Render Asset Integrity (Phase G)
# Scans a Render Plan and verifies that all assets required by its shots physically exist.
# Usage: ./gate-render-asset-integrity.sh <render_plan.json>

PLAN_JSON=${1:-"docs/_evidence/phase_f_commissioning_20260127_224500/plan.json"}
RENDER_MAP="docs/assets/render_map.json"
ASSETS_ROOT="docs" # Asset paths in map are relative to this root

echo "=== Gate: Render Asset Integrity Started ==="
echo "Target Plan: $PLAN_JSON"
echo "Render Map:  $RENDER_MAP"

if [ ! -f "$PLAN_JSON" ]; then
    echo "❌ FAIL: Render Plan not found at $PLAN_JSON"
    exit 1
fi

node -e "
const fs = require('fs');
const path = require('path');

const plan = JSON.parse(fs.readFileSync('$PLAN_JSON', 'utf8'));
const map = JSON.parse(fs.readFileSync('$RENDER_MAP', 'utf8'));

console.log('--- Asset Dependency Scan ---');
let missingCount = 0;
let checkedAssets = new Set();

plan.renderShots.forEach(shot => {
    const comboKey = shot.comboKey;
    if (!comboKey) return;
    
    const combo = map.combos[comboKey];
    // console.log(\`Debug: checking shot \${shot.shotId}, combo \${comboKey}\`); // Verbose debug if needed

    if (combo && combo.requiredAssets) {
        combo.requiredAssets.forEach(assetPath => {
            if (checkedAssets.has(assetPath)) return;
            checkedAssets.add(assetPath);
            
            const fullPath = path.join('$ASSETS_ROOT', assetPath);
            if (!fs.existsSync(fullPath)) {
                console.error(\`❌ FAIL: Missing asset for shot \${shot.shotId} (Combo: \${comboKey}): \${fullPath}\`);
                missingCount++;
            }
        });
    }
});

console.log('Total Unique Assets Verified:', checkedAssets.size);
console.log('Missing Assets:', missingCount);

if (missingCount > 0) {
    console.error('❌ FAIL: Integrity Check Failed. Missing required assets.');
    process.exit(1);
}
"

echo "✅ SUCCESS: All plan dependencies physically verified."
echo "=== Gate Completed ==="
