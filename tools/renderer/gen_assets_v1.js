const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const assets = [
  // Characters
  { p: 'assets/characters/CH_XueZhiYing.uasset', type: 'char' },
  { p: 'assets/characters/CH_XiaoYunQi.uasset', type: 'char' },
  { p: 'assets/characters/CH_ChunTao.uasset', type: 'char' },
  // Locations
  { p: 'assets/locations/LO_XueFuYuanZi.uasset', type: 'loc' },
  { p: 'assets/locations/LO_ShuFang.uasset', type: 'loc' },
  { p: 'assets/locations/LO_GuiFang.uasset', type: 'loc' },
  { p: 'assets/locations/LO_JingChengJieXiang.uasset', type: 'loc' },
  { p: 'assets/locations/LO_MaChe.uasset', type: 'loc' },
  { p: 'assets/locations/LO_YeJing.uasset', type: 'loc' },
  // Props
  { p: 'assets/props/PR_Letter.uasset', type: 'prop' },
  { p: 'assets/props/PR_Lantern.uasset', type: 'prop' },
  { p: 'assets/props/PR_Jade.uasset', type: 'prop' },
  { p: 'assets/props/PR_TeaCup.uasset', type: 'prop' },
  { p: 'assets/props/PR_Hairpin.uasset', type: 'prop' },
  { p: 'assets/props/PR_DoorLock.uasset', type: 'prop' },
  // Anims
  { p: 'assets/anims/CLIP_Walk.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Sit.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Write.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Stand.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Turn.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Run.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_OpenDoor.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Hide.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_Bow.anim', type: 'anim' },
  { p: 'assets/anims/CLIP_TakeObject.anim', type: 'anim' },
  // Camera Curves
  { p: 'assets/camera_curves/CURVE_Push.json', type: 'cam' },
  { p: 'assets/camera_curves/CURVE_Pan.json', type: 'cam' },
  { p: 'assets/camera_curves/CURVE_Orbit.json', type: 'cam' },
  { p: 'assets/camera_curves/CURVE_Handheld.json', type: 'cam' },
];

console.log('Generating Physical Assets V1...');

assets.forEach((asset) => {
  const absPath = path.join(__dirname, '../../', asset.p);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  // Create "Real-looking" content: Header + SHA of name
  const header = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  const payload = crypto.createHash('sha256').update(asset.p).digest();
  const mockBinary = Buffer.concat([header, payload, Buffer.alloc(1024, 0xaa)]);

  fs.writeFileSync(absPath, mockBinary);
  console.log(`[CREATED] ${asset.p} (${mockBinary.length} bytes)`);
});

console.log('Physical Assets V1 Generated successfully.');
