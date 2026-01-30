const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const eviRoot = 'docs/_evidence/orch_v2_audio_l3_20260126_221019';
const r1Json = JSON.parse(fs.readFileSync(path.join(eviRoot, 'R1/input_boundaries.json'), 'utf8'));
const r2Json = JSON.parse(fs.readFileSync(path.join(eviRoot, 'R2/input_boundaries.json'), 'utf8'));

function getSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const r1AudioPath = r1Json.producedArtifacts.audioFile;
const r2AudioPath = r2Json.producedArtifacts.audioFile;

const r1Sha = getSha256(r1AudioPath);
const r2Sha = getSha256(r2AudioPath);

console.log(`R1 Audio: ${r1Sha}`);
console.log(`R2 Audio: ${r2Sha}`);

const result = {
  r1: r1Sha,
  r2: r2Sha,
  match: r1Sha === r2Sha,
};

fs.writeFileSync(path.join(eviRoot, 'fingerprint_compare.json'), JSON.stringify(result, null, 2));

if (result.match) {
  console.log('✅ SHA256 MATCH');
  process.exit(0);
} else {
  console.error('❌ SHA256 MISMATCH');
  process.exit(1);
}
