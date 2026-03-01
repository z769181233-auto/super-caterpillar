const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../../docs/assets');
const renderMapPath = path.join(assetsDir, 'render_map.json');

if (!fs.existsSync(renderMapPath)) {
  console.error(`Render Map not found: ${renderMapPath}`);
  process.exit(1);
}

const renderMap = JSON.parse(fs.readFileSync(renderMapPath, 'utf8'));

// Patch Render Map with Ancient Combos (Stubbed)
const ancientLocs = ['LO_XIAO_MANSION', 'LO_STUDY_ROOM', 'LO_INN_ROOM'];
const standardPoses = ['PO_STAND', 'PO_SIT', 'PO_WALK', 'PO_IDLE', 'PO_RUN', 'PO_FIGHT'];
const standardMotions = ['MO_TALK', 'MO_WALK', 'MO_IDLE', 'MO_SIT', 'MO_RUN', 'MO_DANCE'];
const standardCams = [
  'CM_STATIC',
  'CM_PAN_LEFT',
  'CM_PAN_RIGHT',
  'CM_ZOOM_IN',
  'CM_ZOOM_OUT',
  'CM_DOLLY_IN',
];

// A. Patch Definitions
const definitions = [
  { type: 'poses', items: standardPoses, prefix: 'assets/anims/' },
  { type: 'motions', items: standardMotions, prefix: 'assets/anims/CLIP_' },
  { type: 'cameraMoves', items: standardCams, prefix: 'assets/curves/CURVE_' },
];

definitions.forEach((def) => {
  def.items.forEach((id) => {
    if (!renderMap[def.type][id]) {
      renderMap[def.type][id] = {
        assetPath: `${def.prefix}${id.toLowerCase()}.asset`,
        requiredAssets: [`${def.prefix}${id.toLowerCase()}.asset`],
      };
    }
  });
});

let addedCount = 0;

ancientLocs.forEach((loc) => {
  standardPoses.forEach((pose) => {
    standardMotions.forEach((motion) => {
      standardCams.forEach((cam) => {
        const key = `${pose}|${motion}|${cam}`;
        // If not exists, add stub
        if (!renderMap.combos[key]) {
          renderMap.combos[key] = {
            templateId: 'STUB_ANCIENT_SCENE',
            description: 'Auto-generated stub for ancient assets',
          };
          addedCount++;
        }
      });
    });
  });
});

fs.writeFileSync(renderMapPath, JSON.stringify(renderMap, null, 2));
console.log(`Render Map Patched: Added ${addedCount} stub combos for Ancient Assets.`);
