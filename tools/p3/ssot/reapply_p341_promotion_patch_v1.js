const fs = require('fs');

const ssotPath = process.argv[2];
if (!ssotPath) process.exit(2);

let s = fs.readFileSync(ssotPath, 'utf8');

function sliceBlock(begin, end) {
  const b = `<!-- SSOT_TABLE:${begin} -->`;
  const e = `<!-- SSOT_TABLE:${end} -->`;
  const bi = s.indexOf(b);
  const ei = s.indexOf(e);
  if (bi < 0 || ei < 0 || ei < bi) throw new Error(`missing markers: ${begin}/${end}`);
  const headEnd = s.indexOf('\n', bi) + 1;
  const blockStart = headEnd;
  const blockEnd = ei;
  return { bi, ei, blockStart, blockEnd, b, e, body: s.slice(blockStart, blockEnd) };
}

function parseTable(body) {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  if (lines.length < 2) return { header: [], rows: [] };
  const header = lines[0]
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split('|').map((x) => x.trim());
    const vals = cols.filter((_, idx) => idx > 0 && idx < cols.length - 1);
    const row = {};
    header.forEach((h, idx) => (row[h] = (vals[idx] ?? '').trim()));
    if (row.engine_key) rows.push(row);
  }
  return { header, rows };
}

function renderTable(header, rows) {
  const sep = header.map(() => ':---').join(' | ');
  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${sep} |`);
  for (const r of rows) {
    const vals = header.map((h) => (r[h] ?? '').trim());
    lines.push(`| ${vals.join(' | ')} |`);
  }
  return lines.join('\n') + '\n';
}

const sealed = sliceBlock('SEALED_BEGIN', 'SEALED_END');
const inprog = sliceBlock('INPROGRESS_BEGIN', 'INPROGRESS_END');

const tSealed = parseTable(sealed.body);
const tInprog = parseTable(inprog.body);

const promote = [
  { k: '`emotion_analysis`', tag: '`seal/p3_4_promote_20260201_154257_misc`' },
  { k: '`dialogue_optimization`', tag: '`seal/p3_4_promote_20260201_154257_misc`' },
  { k: '`g5_dialogue_binding`', tag: '`seal/p3_4_promote_20260201_154257_g5`' },
  { k: '`g5_semantic_motion`', tag: '`seal/p3_4_promote_20260201_154257_g5`' },
  { k: '`g5_asset_layering`', tag: '`seal/p3_4_promote_20260201_154257_g5`' },
];

function findAndRemove(rows, key) {
  const idx = rows.findIndex((r) => r.engine_key === key);
  if (idx >= 0) return rows.splice(idx, 1)[0];
  return null;
}

for (const p of promote) {
  // 1) 如果已在SEALED：只补 tag
  let r = tSealed.rows.find((x) => x.engine_key === p.k);
  if (r) {
    r.seal_tag = p.tag;
    continue;
  }
  // 2) 否则从IN-PROGRESS移走 -> SEALED 末尾，并补 tag
  const moved = findAndRemove(tInprog.rows, p.k);
  if (!moved) throw new Error(`engine not found in SEALED or IN-PROGRESS: ${p.k}`);
  moved.seal_tag = p.tag;
  tSealed.rows.push(moved);
}

const sealedOut = renderTable(tSealed.header, tSealed.rows);
const inprogOut = renderTable(tInprog.header, tInprog.rows);

s = s.slice(0, sealed.blockStart) + sealedOut + s.slice(sealed.blockEnd);
const inprog2 = sliceBlock('INPROGRESS_BEGIN', 'INPROGRESS_END'); // 重新定位
s = s.slice(0, inprog2.blockStart) + inprogOut + s.slice(inprog2.blockEnd);

fs.writeFileSync(ssotPath, s, 'utf8');
console.log('[OK] promotion patch applied');
