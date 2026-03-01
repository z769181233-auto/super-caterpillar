const fs = require('fs');
const path = require('path');

const renderMapPath = path.join(__dirname, '../../docs/assets/render_map.json');
const renderMap = JSON.parse(fs.readFileSync(renderMapPath, 'utf8'));

console.log('=== Aggressive P0 Upgrade: Render Map REAL Conversion ===');

// 1. Define Asset Mappings
const defaultChar = 'assets/characters/CH_XueZhiYing.uasset';
const defaultLoc = 'assets/locations/LO_XueFuYuanZi.uasset';
const defaultAnim = 'assets/anims/CLIP_Stand.anim';
const defaultCam = 'assets/camera_curves/CURVE_Pan.json';

const poseToAsset = {
  PO_STAND: 'assets/anims/CLIP_Stand.anim',
  PO_SIT: 'assets/anims/CLIP_Sit.anim',
  PO_WALK: 'assets/anims/CLIP_Walk.anim',
  PO_RUN: 'assets/anims/CLIP_Run.anim',
  PO_IDLE: 'assets/anims/CLIP_Stand.anim',
  PO_SIT_RELAX: 'assets/anims/CLIP_Sit.anim',
  PO_IDLE_STAND: 'assets/anims/CLIP_Stand.anim',
};

const motionToAsset = {
  MO_WALK: 'assets/anims/CLIP_Walk.anim',
  MO_RUN: 'assets/anims/CLIP_Run.anim',
  MO_IDLE: 'assets/anims/CLIP_Stand.anim',
  MO_SIT: 'assets/anims/CLIP_Sit.anim',
  MO_DASH_FORWARD: 'assets/anims/CLIP_Run.anim',
};

const camToAsset = {
  CM_STATIC: 'assets/camera_curves/CURVE_Pan.json',
  CM_PUSH_IN: 'assets/camera_curves/CURVE_Push.json',
  CM_PAN_LEFT: 'assets/camera_curves/CURVE_Pan.json',
  CM_ORBIT_360: 'assets/camera_curves/CURVE_Orbit.json',
};

// 2. Process Bases
console.log('Mapping Base Assets...');
for (const id in renderMap.poses) {
  const file = poseToAsset[id] || defaultAnim;
  renderMap.poses[id].assetPath = file;
  renderMap.poses[id].requiredAssets = [file];
}
for (const id in renderMap.motions) {
  const file = motionToAsset[id] || defaultAnim;
  renderMap.motions[id].assetPath = file;
  renderMap.motions[id].requiredAssets = [file];
}
for (const id in renderMap.cameraMoves) {
  const file = camToAsset[id] || defaultCam;
  renderMap.cameraMoves[id].assetPath = file;
  renderMap.cameraMoves[id].requiredAssets = [file];
}

// 3. Process Combos (Universal)
console.log('Rewriting all Combos to REAL templates...');
let comboIndex = 1;
for (const key in renderMap.combos) {
  const combo = renderMap.combos[key];
  const [poseId, motionId, camId] = key.split('|');

  // Force REAL Template ID
  combo.templateId = `TL_COMB_${comboIndex.toString().padStart(3, '0')}`;
  combo.executor = 'UNREAL';
  combo.renderSettings = {
    resolution: '1280x720',
    fps: 24,
    antialiasing: 'TSA',
  };

  // Binding Assets
  const assets = new Set();
  assets.add(defaultChar);
  assets.add(defaultLoc);

  const poseAsset = renderMap.poses[poseId]?.assetPath || defaultAnim;
  const motionAsset = renderMap.motions[motionId]?.assetPath || defaultAnim;
  const camAsset = renderMap.cameraMoves[camId]?.assetPath || defaultCam;

  assets.add(poseAsset);
  assets.add(motionAsset);
  assets.add(camAsset);

  combo.requiredAssets = Array.from(assets);
  combo.rigBinding = 'CH_XueZhiYing';
  combo.animClipId = motionAsset;
  combo.cameraCurveId = camAsset;

  comboIndex++;
}

renderMap.renderContractVersion = '2.0.0-REAL';
fs.writeFileSync(renderMapPath, JSON.stringify(renderMap, null, 2));

console.log(`[SUCCESS] Render Map fully converted. Total Real Combos: ${comboIndex - 1}`);
