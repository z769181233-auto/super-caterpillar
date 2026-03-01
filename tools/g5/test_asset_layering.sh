#!/bin/bash
# G5-P0-3: Asset Layering Resolver 验证脚本
# Usage: ./tools/g5/test_asset_layering.sh

set -e

echo "=== G5-P0-3: Asset Layering Resolver Test ==="

# 1. Prepare test data
EVIDENCE_DIR="docs/_evidence/g5_p0_engines_v1_staged"
mkdir -p "$EVIDENCE_DIR"

RENDER_PLAN_PATH="$EVIDENCE_DIR/E0001.render_plan.json"
CHARACTERS_DIR="assets/characters/v1"

# Create a richer render_plan with character assignments
cat > "$RENDER_PLAN_PATH" << 'EOF'
{
  "episodeId": "E0001",
  "totalDuration": 60,
  "beats": [
    { "id": "beat-0", "goal": "薛知盈尝试逃离萧府", "startSec": 0, "durationSec": 15 },
    { "id": "beat-1", "goal": "被萧云绮拦截", "startSec": 15, "durationSec": 15 }
  ],
  "shots": [
    { "id": "shot-0-0", "beatId": "beat-0", "characterId": "CH_XueZhiYing", "startSec": 0, "durationSec": 7.5 },
    { "id": "shot-1-0", "beatId": "beat-1", "characterId": "CH_XiaoYunQi", "startSec": 15, "durationSec": 7.5 }
  ]
}
EOF

# 2. Create test script (Self-contained Node.js)
TEST_SCRIPT="$EVIDENCE_DIR/test_asset_layering.js"

cat > "$TEST_SCRIPT" << 'EOF'
const fs = require('fs');
const path = require('path');

class G5AssetLayeringResolverAdapter {
  generateLayeringPlan(renderPlan, charsDir) {
    const assignments = [];
    const shots = renderPlan.shots || [];
    const missingAssets = new Set();
    const details = [];
    let layerOkCount = 0;

    shots.forEach(shot => {
      const shotId = shot.id || `shot-${shot.index || 0}`;
      const characterId = shot.characterId || 'UNKNOWN';
      
      const charPath = path.join(charsDir, characterId);
      const layers = [];
      let status = 'MISSING';

      if (fs.existsSync(charPath)) {
        const fullPath = path.join(charPath, 'full.png');
        if (fs.existsSync(fullPath)) {
          layers.push({
            layerId: 'full',
            sourcePath: fullPath,
            order: 10,
            offset: { x: 0, y: 0 },
            opacity: 1.0
          });
          status = 'OK';
        }
      }

      if (status === 'OK') {
        layerOkCount++;
      } else {
        missingAssets.add(characterId);
      }

      assignments.push({
        shotId,
        characterId,
        layers,
        shadow: {
          enabled: true,
          type: 'ellipse_soft',
          color: '#000000',
          opacity: 0.4,
          offset: { x: 0, y: 40 },
          blur: 15
        },
        blending: { mode: 'normal', feather: 2 }
      });

      details.push({ shotId, status, layersCount: layers.length });
    });

    return {
      layeringPlan: { assignments, totalShots: shots.length },
      report: {
        missing_assets: Array.from(missingAssets),
        layer_ok_pct: shots.length > 0 ? layerOkCount / shots.length : 0,
        total_characters_found: new Set(assignments.filter(a => a.layers.length > 0).map(a => a.characterId)).size,
        details
      }
    };
  }
}

const renderPlanPath = process.argv[2];
const charsDir = process.argv[3];
const outputDir = process.argv[4];

const renderPlan = JSON.parse(fs.readFileSync(renderPlanPath, 'utf-8'));
const adapter = new G5AssetLayeringResolverAdapter();
const { layeringPlan, report } = adapter.generateLayeringPlan(renderPlan, charsDir);

fs.writeFileSync(path.join(outputDir, 'layering_plan.json'), JSON.stringify(layeringPlan, null, 2));
fs.writeFileSync(path.join(outputDir, 'asset_layering_report.json'), JSON.stringify(report, null, 2));

console.log(`[G5-ASSET-LAYERING] Coverage: ${(report.layer_ok_pct * 100).toFixed(1)}%, Missing: ${report.missing_assets.length}`);
EOF

# 3. Execute test
echo "[Step 1] Running Asset Layering Resolver..."
node "$TEST_SCRIPT" "$RENDER_PLAN_PATH" "$CHARACTERS_DIR" "$EVIDENCE_DIR"

# 4. Validate outputs
echo "[Step 2] Validating outputs..."

LAYERING_PLAN="$EVIDENCE_DIR/layering_plan.json"
REPORT="$EVIDENCE_DIR/asset_layering_report.json"

if [ ! -f "$LAYERING_PLAN" ]; then
  echo "❌ FAIL: layering_plan.json not generated"
  exit 1
fi

# Check coverage requirement
COVERAGE=$(node -e "console.log(require('./$REPORT').layer_ok_pct)")
echo "[Step 3] Coverage Check..."
echo "  Coverage: $(echo "$COVERAGE * 100" | bc)%"

if [ "$(echo "$COVERAGE < 1.0" | bc)" -eq 1 ]; then
  echo "❌ FAIL: Missing character assets! Expected 100% coverage for staged test."
  node -e "console.log('Missing Assets:', require('./$REPORT').missing_assets)"
  exit 1
fi

echo ""
echo "=== G5-P0-3: Asset Layering Resolver Test PASS ==="
echo "Evidence:"
echo "  - layering_plan.json: $LAYERING_PLAN"
echo "  - asset_layering_report.json: $REPORT"
