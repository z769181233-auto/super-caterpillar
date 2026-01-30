const fs = require('fs');
const path = require('path');

/**
 * Gate: Real Render Determinism (G4-ACCEPT)
 * Usage: node gate_real_render_determinism.js <manifest_r1> <manifest_r2> <mp4_r1> <mp4_r2>
 */

const m1 = process.argv[2];
const m2 = process.argv[3];
const p1 = process.argv[4];
const p2 = process.argv[5];

console.log('=== Gate: Real Render Determinism (G4-ACCEPT) ===');

try {
  const man1 = JSON.parse(fs.readFileSync(m1, 'utf8'));
  const man2 = JSON.parse(fs.readFileSync(m2, 'utf8'));

  // 1. Check Frame Manifest
  // Deep comparison of frames
  let mismatchCount = 0;
  const totalShots = Math.max(man1.shots.length, man2.shots.length);

  for (let i = 0; i < totalShots; i++) {
    const s1 = man1.shots[i];
    const s2 = man2.shots[i];
    if (!s1 || !s2 || s1.hash !== s2.hash) {
      mismatchCount++;
    }
  }

  const frameMatched = mismatchCount === 0 && man1.shots.length === man2.shots.length;
  console.log(`Frame Manifest Deep Match: ${frameMatched ? '✅ YES' : '❌ NO'}`);
  if (mismatchCount > 0) console.error(` - Mismatch Count: ${mismatchCount}`);

  // 2. Check MP4 Hash (Container level)
  const { execSync } = require('child_process');
  const hash1 = execSync(`shasum -a 256 "${p1}"`).toString().split(' ')[0];
  const hash2 = execSync(`shasum -a 256 "${p2}"`).toString().split(' ')[0];

  console.log(`MP4 R1 SHA: ${hash1}`);
  console.log(`MP4 R2 SHA: ${hash2}`);

  const binaryMatched = hash1 === hash2;
  console.log(
    `MP4 Binary Match: ${binaryMatched ? '✅ YES' : '⚠️ NO (Minor metadata drift possible)'}`
  );

  const report = {
    timestamp: new Date().toISOString(),
    frameMatched,
    binaryMatched,
    mismatchCount,
    hashes: { r1: hash1, r2: hash2 },
    status: frameMatched ? 'PASS' : 'FAIL',
  };

  fs.writeFileSync('determinism_report.json', JSON.stringify(report, null, 2));

  if (frameMatched) {
    console.log('✅ SUCCESS: Industrial Determinism Verified (Zero mismatch).');
  } else {
    console.error('❌ FAILED: Determinism breach detected.');
    process.exit(1);
  }
} catch (err) {
  console.error(`❌ FATAL: ${err.message}`);
  process.exit(1);
}
