import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P3' Evidence Index Generator (Strong Consistency)
 * Generates both EVIDENCE_INDEX.json and EVIDENCE_INDEX.checksums
 */
const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node gen_evidence_index.mjs <target_dir>');
  process.exit(1);
}

const absoluteDir = path.resolve(targetDir);

function getFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, allFiles);
    } else {
      const base = path.basename(name);
      if (base !== 'EVIDENCE_INDEX.json' && base !== 'EVIDENCE_INDEX.checksums') {
        allFiles.push(name);
      }
    }
  }
  return allFiles;
}

const fileList = getFiles(absoluteDir);
const items = fileList.map((f) => {
  const relativePath = path.relative(absoluteDir, f);
  const sha256 = execSync(`shasum -a 256 "${f}"`).toString().trim().split(/\s+/)[0];
  return {
    path: relativePath,
    sha256,
    size: fs.statSync(f).size,
  };
});

const index = {
  evidence_dir: path.basename(absoluteDir),
  timestamp: new Date().toISOString(),
  files: items,
};

// 1. Write JSON
const indexPath = path.join(absoluteDir, 'EVIDENCE_INDEX.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

// 2. Write Checksums (Standard shasum format)
const checksumsContent = items.map((i) => `${i.sha256}  ${i.path}`).join('\n') + '\n';
const checksumsPath = path.join(absoluteDir, 'EVIDENCE_INDEX.checksums');
fs.writeFileSync(checksumsPath, checksumsContent);

console.log(`[INDEX] Generated: ${indexPath} (${items.length} files)`);
console.log(`[INDEX] Checksums: ${checksumsPath}`);
