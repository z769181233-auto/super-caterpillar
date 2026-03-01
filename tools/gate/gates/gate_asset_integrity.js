const fs = require('fs');
const path = require('path');

/**
 * Gate: Render Asset Integrity (V2)
 * Usage: node gate_asset_integrity.js [render_plan_path]
 */

const renderMapPath = path.join(__dirname, '../../../docs/assets/render_map.json');
const renderPlanPath = process.argv[2];

const renderMap = JSON.parse(fs.readFileSync(renderMapPath, 'utf8'));

console.log('=== Gate: Render Asset Integrity ===');
console.log(`Render Map: ${renderMapPath}`);

const missingAssets = [];
const checkedAssets = new Set();

function checkAsset(relPath) {
  if (!relPath) return;
  if (checkedAssets.has(relPath)) return;
  const absPath = path.join(__dirname, '../../../', relPath);
  if (!fs.existsSync(absPath)) {
    missingAssets.push(relPath);
  }
  checkedAssets.add(relPath);
}

// 1. Scan Render Map (Optional, but good for global audit)
// We focus on the provided plan if available.

// 2. Scan Render Plan
if (renderPlanPath) {
  console.log(`Auditing Render Plan: ${renderPlanPath}`);
  const renderPlan = JSON.parse(fs.readFileSync(renderPlanPath, 'utf8'));

  // Support both 'shots' and 'renderShots' keys
  const shots = renderPlan.renderShots || renderPlan.shots || [];

  shots.forEach((shot) => {
    // Look up assets in renderMap via comboKey
    if (shot.comboKey) {
      const combo = renderMap.combos[shot.comboKey];
      if (combo && combo.requiredAssets) {
        combo.requiredAssets.forEach(checkAsset);
      }
    }
    // Also check explicit assets in shot if any
    if (shot.requiredAssets) {
      shot.requiredAssets.forEach(checkAsset);
    }
  });
} else {
  console.log('No Render Plan provided. Auditing entire Render Map...');
  for (const key in renderMap.combos) {
    if (renderMap.combos[key].requiredAssets) {
      renderMap.combos[key].requiredAssets.forEach(checkAsset);
    }
  }
}

const report = {
  timestamp: new Date().toISOString(),
  checkedCount: checkedAssets.size,
  missingCount: missingAssets.length,
  missingAssets: missingAssets,
  status: missingAssets.length === 0 ? 'PASS' : 'FAIL',
};

const reportPath = path.join(process.cwd(), 'asset_binding_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`Checked: ${report.checkedCount} unique assets.`);
if (report.missingCount > 0) {
  console.error(`❌ FAILED: ${report.missingCount} assets missing!`);
  report.missingAssets.slice(0, 10).forEach((a) => console.error(` - MISSING: ${a}`));
  process.exit(1);
} else {
  console.log('✅ SUCCESS: 0 assets missing (100% binding).');
}
