const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../../docs/assets');

function patchArrayFile(filename, newItems) {
  const filePath = path.join(assetsDir, filename);
  if (!fs.existsSync(filePath)) return;

  let items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(items)) {
    console.warn(`${filename} is not an array? Skipping.`);
    return;
  }

  let count = 0;
  newItems.forEach((newItem) => {
    // Check duplicate ID
    const exists = items.find((i) => i.id === newItem.id);
    if (!exists) {
      items.push(newItem);
      count++;
    }
  });

  if (count > 0) {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
    console.log(`Patched ${filename}: Added ${count} items.`);
  } else {
    console.log(`Patched ${filename}: No new items (deduplicated).`);
  }
}

// 1. Characters
patchArrayFile('characters.json', [
  { id: 'CH_XUE_ZHIYING', name: '薛知盈', description: 'The cousin who runs away' },
  { id: 'CH_XIAO_YUNQI', name: '萧昀祈', description: 'The dedicated pursuer' },
  { id: 'CH_CHUNTAO', name: '春桃', description: 'Loyal maid' },
  { id: 'CH_WANG_MOMO', name: '王嬷嬷', description: 'Old servant' },
]);

// 2. Locations
patchArrayFile('locations.json', [
  { id: 'LO_XIAO_MANSION', name: '萧府小院', description: 'Traditional courtyard' },
  { id: 'LO_STUDY_ROOM', name: '书案房', description: 'Classic study room' },
  { id: 'LO_INN_ROOM', name: '客栈雅间', description: 'Inn guest room' },
]);

// 3. Props
patchArrayFile('props.json', [
  { id: 'PR_ANCIENT_BOOK', name: '书册', description: 'Bound book' },
  { id: 'PR_PURSE', name: '钱袋', description: 'Embroidered purse' },
  { id: 'PR_CARRIAGE', name: '马车', description: 'Horse carriage' },
  { id: 'PR_BIRD_NEST', name: '燕窝', description: 'Bowl of bird nest soup' },
  { id: 'PR_LETTER', name: '信笺', description: 'Paper letter' },
]);

// 4. SFX (Needs sfx_catalog.json)
// If sfx_catalog.json doesn't exist, we might need to create it or skip
const sfxPath = path.join(assetsDir, 'sfx_catalog.json');
if (!fs.existsSync(sfxPath)) {
  // Determine structure from usage? Usually array of {id...}
  fs.writeFileSync(sfxPath, JSON.stringify([], null, 2));
}
patchArrayFile('sfx_catalog.json', [{ id: 'SF_WIND', name: 'Wind', description: 'Ambient wind' }]);

// 5. Poses/Motions (poses.json, motions.json)
// Need PO_STAND, MO_IDLE
patchArrayFile('poses.json', [
  { id: 'PO_STAND', name: 'Stand', description: 'Standing pose' },
  { id: 'PO_SIT', name: 'Sit', description: 'Sitting pose' },
  { id: 'PO_WALK', name: 'Walk', description: 'Walking pose' },
  { id: 'PO_IDLE', name: 'Idle', description: 'Idle pose' },
  { id: 'PO_RUN', name: 'Run', description: 'Running pose' },
  { id: 'PO_FIGHT', name: 'Fight', description: 'Fighting pose' },
]);

patchArrayFile('motions.json', [
  { id: 'MO_IDLE', name: 'Idle', description: 'Idle motion Loop' },
  { id: 'MO_WALK', name: 'Walk', description: 'Walking Loop' },
  { id: 'MO_TALK', name: 'Talk', description: 'Talking Loop' },
  { id: 'MO_SIT', name: 'Sit', description: 'Sitting Loop' },
  { id: 'MO_RUN', name: 'Run', description: 'Running Loop' },
  { id: 'MO_DANCE', name: 'Dance', description: 'Dancing Loop' },
]);

// 6. Camera Moves
patchArrayFile('camera_moves.json', [
  { id: 'CM_STATIC', name: 'Static', description: 'Static camera' },
  { id: 'CM_PAN_LEFT', name: 'Pan Left', description: 'Pan camera left' },
  { id: 'CM_PAN_RIGHT', name: 'Pan Right', description: 'Pan camera right' },
  { id: 'CM_ZOOM_IN', name: 'Zoom In', description: 'Zoom in' },
  { id: 'CM_ZOOM_OUT', name: 'Zoom Out', description: 'Zoom out' },
  { id: 'CM_DOLLY_IN', name: 'Dolly In', description: 'Dolly in' },
]);
