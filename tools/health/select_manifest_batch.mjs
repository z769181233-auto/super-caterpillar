
import fs from 'fs';

const args = process.argv.slice(2);
const getArg = (key) => {
    const idx = args.indexOf(key);
    return idx >= 0 ? args[idx + 1] : null;
};

const inFile = getArg('--in');
const outFile = getArg('--out');
const limit = parseInt(getArg('--limit') || '30', 10);

if (!inFile || !outFile) {
    console.error("Usage: node select_manifest_batch.mjs --in <manifest.json> --out <batch.json> [--limit 30]");
    process.exit(1);
}

const all = JSON.parse(fs.readFileSync(inFile, 'utf8'));

// Priority filtering (if needed). For now, just take top N non-whitelisted.
// (Whitelist already applied in gen step, but double check?)
// Just take top N for Batch 1.

const batch = all.slice(0, limit);

console.log(`Selected ${batch.length} items from ${all.length} total.`);
fs.writeFileSync(outFile, JSON.stringify(batch, null, 2));
