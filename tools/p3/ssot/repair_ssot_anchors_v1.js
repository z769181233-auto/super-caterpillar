const fs = require('fs');

const ssotPath = process.argv[2] || process.env.SSOT_PATH;
if (!ssotPath) {
  console.error('[FATAL] SSOT path not provided');
  process.exit(2);
}

let s = fs.readFileSync(ssotPath, 'utf8');

function has(marker) {
  return s.includes(`<!-- SSOT_TABLE:${marker} -->`);
}

function findHeading(re) {
  const m = s.match(re);
  if (!m || m.index == null) return null;
  return { index: m.index, text: m[0] };
}

// 更宽松的标题匹配（兼容中英文）
const hSealed = findHeading(/^##\s+.*SEALED.*$/m);
const hInprog = findHeading(/^##\s+.*IN-?PROGRESS.*$/m);
const hPlanned = findHeading(/^##\s+.*PLANNED.*$/m);

if (!hSealed || !hInprog || !hPlanned) {
  console.error('[FATAL] Cannot find required headings for SEALED/IN-PROGRESS/PLANNED');
  console.error('SEALED heading found?', !!hSealed);
  console.error('IN-PROGRESS heading found?', !!hInprog);
  console.error('PLANNED heading found?', !!hPlanned);
  process.exit(3);
}

function insertAt(pos, text) {
  s = s.slice(0, pos) + text + s.slice(pos);
}

function ensureBeginAfterHeading(heading, marker) {
  if (has(marker)) return;
  // 插在标题行后面（跳过紧随其后的空行）
  const headEnd = s.indexOf('\n', heading.index);
  if (headEnd < 0) return;
  let p = headEnd + 1;
  while (p < s.length && (s[p] === '\n' || s[p] === '\r')) p++;
  insertAt(p, `<!-- SSOT_TABLE:${marker} -->\n`);
}

function ensureEndBeforeHeading(nextHeading, marker) {
  if (has(marker)) return;
  // 插在下一段标题前一个换行处
  let p = nextHeading.index;
  // 保证 marker 前有一个空行隔开
  const prefix = (p > 0 && s[p - 1] !== '\n') ? '\n' : '';
  insertAt(p, `${prefix}<!-- SSOT_TABLE:${marker} -->\n\n`);
}

// 1) SEALED_BEGIN（你现在已有，但仍做幂等补全）
ensureBeginAfterHeading(hSealed, 'SEALED_BEGIN');
// 2) SEALED_END：插在 IN-PROGRESS 标题之前
ensureEndBeforeHeading(hInprog, 'SEALED_END');

// 3) INPROGRESS_BEGIN：插在 IN-PROGRESS 标题之后
ensureBeginAfterHeading(hInprog, 'INPROGRESS_BEGIN');
// 4) INPROGRESS_END：插在 PLANNED 标题之前
ensureEndBeforeHeading(hPlanned, 'INPROGRESS_END');

// 5) PLANNED_BEGIN：插在 PLANNED 标题之后
ensureBeginAfterHeading(hPlanned, 'PLANNED_BEGIN');
// 6) PLANNED_END：如果没有，则插到文件末尾
if (!has('PLANNED_END')) {
  const tail = s.endsWith('\n') ? '' : '\n';
  s = s + `${tail}\n<!-- SSOT_TABLE:PLANNED_END -->\n`;
}

// 最后：去重（如果历史上被插过多次，保留第一次）
function dedupe(marker) {
  const tag = `<!-- SSOT_TABLE:${marker} -->`;
  const parts = s.split(tag);
  if (parts.length <= 2) return;
  s = parts[0] + tag + parts.slice(1).join('');
}
['SEALED_BEGIN','SEALED_END','INPROGRESS_BEGIN','INPROGRESS_END','PLANNED_BEGIN','PLANNED_END'].forEach(dedupe);

fs.writeFileSync(ssotPath, s, 'utf8');
console.log('[OK] Anchors repaired:', ssotPath);
