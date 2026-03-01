import fs from 'fs';
import path from 'path';

// Parse args
const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  return idx >= 0 ? args[idx + 1] : null;
};
const inFile = getArg('--in');
const outFile = getArg('--out');

if (!inFile || !outFile) {
  console.error('Usage: node gen_deadcode_manifest.mjs --in <ts_prune_log> --out <json_file>');
  process.exit(1);
}

const content = fs.readFileSync(inFile, 'utf8');
const lines = content.split('\n').filter(Boolean);

const whitelist = [
  'apps/api/src/main.ts',
  'apps/workers/src/main.ts',
  'apps/web/src/pages/_app.tsx',
  'apps/web/src/pages/_document.tsx',
  'packages/database/src/client.ts',
  '.spec.',
  '.test.',
  '__tests__',
  'seed.ts',
  '.controller.ts',
  '.service.ts',
  '.module.ts',
  '.dto.ts',
  '.strategy.ts',
  '.guard.ts',
  '.decorator.ts',
  '.middleware.ts',
  '.processor.ts',
  '.gateway.ts',
];

const items = lines
  .map((line) => {
    // Format: /path/to/file.ts:10 - exportName (used in module)
    const match = line.match(/^(.+):(\d+) - (.+) \((.*)\)$/);
    if (!match) return null;
    const [_, file, lineNum, name, type] = match;

    // Check whitelist
    if (whitelist.some((w) => file.includes(w))) return null;

    return {
      file,
      line: parseInt(lineNum, 10),
      name,
      type: type.replace('used in module', '').trim(),
    };
  })
  .filter(Boolean);

console.log(`Found ${items.length} items. Writing to ${outFile}`);
fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
