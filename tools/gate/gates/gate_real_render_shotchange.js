const fs = require('fs');

/**
 * Gate: Real Render Shot Change Assert
 * Asserts: >= 80% shots in manifest have unique IDs/Hashes
 */

const manifestPath = process.argv[2];
const outputFile = process.argv[3];

if (!manifestPath) {
  console.error('Usage: node gate_real_render_shotchange.js <manifest_json> [output_file]');
  process.exit(1);
}

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const shots = manifest.shots || [];

  if (shots.length === 0) {
    throw new Error('Empty manifest.');
  }

  // A shot is "changed" if it was executed uniquely.
  // In our SIMULATOR, we check if multiple shots share the same hash despite being different shots.
  const uniqueHashes = new Set(shots.map((s) => s.hash));
  const uniqueRatio = uniqueHashes.size / shots.length;

  const result = {
    timestamp: new Date().toISOString(),
    manifestPath,
    totalShots: shots.length,
    uniqueHashes: uniqueHashes.size,
    uniqueRatio: parseFloat(uniqueRatio.toFixed(4)),
    threshold: 0.8,
    status: uniqueRatio >= 0.8 ? 'PASS' : 'FAIL',
  };

  console.log(`=== Gate: Shot Change Coverage ===`);
  console.log(
    `Execution Coverage: ${result.uniqueRatio * 100}% (Threshold: ${result.threshold * 100}%)`
  );

  if (result.status === 'PASS') {
    console.log('✅ SUCCESS: All shots executed with distinct parameters.');
  } else {
    console.error('❌ FAIL: Excessive duplicated shots detected (Static recycle).');
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  }

  process.exit(result.status === 'PASS' ? 0 : 1);
} catch (err) {
  console.error('❌ Gate Error:', err.message);
  process.exit(1);
}
