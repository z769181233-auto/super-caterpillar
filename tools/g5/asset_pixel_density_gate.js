const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * G5 Asset Pixel Density Gate
 * Verifies if character assets have enough physical resolution for 4K/8K tiers.
 */

const THRESHOLDS = {
  '4k': { minHeight: 2600 },
  '8k': { minHeight: 5200 },
};

function getBBox(imagePath) {
  try {
    const cmd = `ffmpeg -i "${imagePath}" -vf "bbox" -f null - 2>&1`;
    const output = execSync(cmd).toString();
    const match = output.match(/x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+) w:(\d+) h:(\d+)/);
    if (match) {
      return {
        x1: parseInt(match[1]),
        x2: parseInt(match[2]),
        y1: parseInt(match[3]),
        y2: parseInt(match[4]),
        w: parseInt(match[5]),
        h: parseInt(match[6]),
      };
    }
  } catch (e) {
    console.error(`Error probing BBox for ${imagePath}:`, e.message);
  }
  return null;
}

async function auditAssets(characterId, tier, customDir = null) {
  const assetBase = customDir || path.join(process.cwd(), 'assets/characters/v1', characterId);
  if (!fs.existsSync(assetBase)) {
    throw new Error(`Asset directory not found at ${assetBase}`);
  }

  const suffix = tier === '8k' ? '_8k.png' : tier === '4k' ? '_4k.png' : '.png';
  const files = fs.readdirSync(assetBase).filter((f) => {
    if (tier === '8k' || tier === '4k') {
      return f.endsWith(suffix);
    }
    // For non-tier (SD/HQ), just check the base views and ignore cleaned or 8k versions
    return f === 'front.png' || f === 'side.png' || f === 'back.png';
  });
  const report = {
    characterId,
    tier,
    assetDirectory: assetBase,
    timestamp: new Date().toISOString(),
    assets: [],
    overallStatus: 'PASS',
  };

  const threshold = THRESHOLDS[tier] || { minHeight: 0 };

  for (const view of files) {
    const viewPath = path.join(assetBase, view);
    if (!fs.existsSync(viewPath)) continue;

    const bbox = getBBox(viewPath);
    const status = bbox && bbox.h >= threshold.minHeight ? 'PASS' : 'FAIL';

    report.assets.push({
      view,
      bbox,
      requiredHeight: threshold.minHeight,
      status,
    });

    if (status === 'FAIL') report.overallStatus = 'FAIL';
  }

  return report;
}

async function main() {
  const charId = process.argv[2];
  const tier = process.argv[3];
  if (!charId || !tier) {
    console.error('Usage: node asset_pixel_density_gate.js <charId> <tier>');
    process.exit(1);
  }

  try {
    const report = await auditAssets(charId, tier);
    console.log(JSON.stringify(report, null, 2));
    if (report.overallStatus === 'FAIL') {
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { auditAssets };
