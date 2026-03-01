const fs = require('fs');

const ssotPath = process.argv[2] || process.env.SSOT_PATH;
if (!ssotPath) process.exit(2);

let s = fs.readFileSync(ssotPath, 'utf8');

function has(marker) {
  return s.includes(`<!-- SSOT_TABLE:${marker} -->`);
}
function findHeading(re) {
  const m = s.match(re);
  if (!m || m.index == null) return null;
  return { index: m.index, text: m[0] };
}
const hSealed = findHeading(/^##\s+.*SEALED.*$/m);
const hInprog = findHeading(/^##\s+.*IN-?PROGRESS.*$/m);
const hPlanned = findHeading(/^##\s+.*PLANNED.*$/m);

if (!hSealed || !hInprog || !hPlanned) {
  console.error('[FATAL] headings missing', {
    sealed: !!hSealed,
    inprog: !!hInprog,
    planned: !!hPlanned,
  });
  process.exit(3);
}

function insertAt(pos, text) {
  s = s.slice(0, pos) + text + s.slice(pos);
}

function ensureBeginAfterHeading(heading, marker) {
  if (has(marker)) return;
  const headEnd = s.indexOf('\n', heading.index);
  let p = headEnd + 1;
  while (p < s.length && (s[p] === '\n' || s[p] === '\r')) p++;
  insertAt(p, `<!-- SSOT_TABLE:${marker} -->\n`);
}

function ensureEndBeforeHeading(nextHeading, marker) {
  if (has(marker)) return;
  const p = nextHeading.index;
  const prefix = p > 0 && s[p - 1] !== '\n' ? '\n' : '';
  insertAt(p, `${prefix}<!-- SSOT_TABLE:${marker} -->\n\n`);
}

ensureBeginAfterHeading(hSealed, 'SEALED_BEGIN');
ensureEndBeforeHeading(hInprog, 'SEALED_END');
ensureBeginAfterHeading(hInprog, 'INPROGRESS_BEGIN');
ensureEndBeforeHeading(hPlanned, 'INPROGRESS_END');
ensureBeginAfterHeading(hPlanned, 'PLANNED_BEGIN');
if (!has('PLANNED_END')) s += `\n<!-- SSOT_TABLE:PLANNED_END -->\n`;

function dedupe(marker) {
  const tag = `<!-- SSOT_TABLE:${marker} -->`;
  const parts = s.split(tag);
  if (parts.length <= 2) return;
  s = parts[0] + tag + parts.slice(1).join('');
}
[
  'SEALED_BEGIN',
  'SEALED_END',
  'INPROGRESS_BEGIN',
  'INPROGRESS_END',
  'PLANNED_BEGIN',
  'PLANNED_END',
].forEach(dedupe);

fs.writeFileSync(ssotPath, s, 'utf8');
console.log('[OK] anchors repaired');
