const fs = require('fs');
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');

function ensureHeading(text, markerBegin) {
  if (s.includes(text)) return;
  const m = `<!-- SSOT_TABLE:${markerBegin} -->`;
  const idx = s.indexOf(m);
  if (idx < 0) throw new Error(`missing marker ${m}`);
  // 插在 marker 之前，保证 parser 可见标题
  const ins = `\n${text}\n`;
  s = s.slice(0, idx) + ins + s.slice(idx);
}

function ensureMarker(marker) {
  const t = `<!-- SSOT_TABLE:${marker} -->`;
  if (!s.includes(t)) throw new Error(`marker missing: ${marker}`);
}

ensureHeading('## SEALED ENGINES (已封印/正式生产)', 'SEALED_BEGIN');
ensureHeading('## IN-PROGRESS (已实现/待封印)', 'INPROGRESS_BEGIN');
ensureHeading('## PLANNED ENGINES (纯规划)', 'PLANNED_BEGIN');

[
  'SEALED_BEGIN',
  'SEALED_END',
  'INPROGRESS_BEGIN',
  'INPROGRESS_END',
  'PLANNED_BEGIN',
  'PLANNED_END',
].forEach(ensureMarker);

fs.writeFileSync(p, s, 'utf8');
console.log('[OK] headings+anchors ensured');
