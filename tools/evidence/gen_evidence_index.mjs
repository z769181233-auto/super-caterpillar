import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * tools/evidence/gen_evidence_index.mjs
 * 生成证据箱索引与校验和
 */

const targetDir = process.argv[2];
if (!targetDir || !fs.existsSync(targetDir)) {
  console.error('Usage: node gen_evidence_index.mjs <directory>');
  process.exit(1);
}

const files = fs.readdirSync(targetDir).filter(f => !f.startsWith('.') && f !== 'EVIDENCE_INDEX.json' && f !== 'EVIDENCE_INDEX.checksums');
const index = {
  timestamp: new Date().toISOString(),
  files: []
};

let checksums = '';

for (const file of files) {
  const filePath = path.join(targetDir, file);
  if (fs.statSync(filePath).isDirectory()) continue;

  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  index.files.push({
    name: file,
    sha256: hash,
    size: content.length
  });

  checksums += `${hash}  ${file}\n`;
}

fs.writeFileSync(path.join(targetDir, 'EVIDENCE_INDEX.json'), JSON.stringify(index, null, 2));
fs.writeFileSync(path.join(targetDir, 'EVIDENCE_INDEX.checksums'), checksums);

console.log(`[EvidenceIndex] Generated index for ${files.length} files in ${targetDir}`);
