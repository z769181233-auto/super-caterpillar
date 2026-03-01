#!/usr/bin/env node
const fs = require('fs');

const ssotPath = process.argv[2] || 'ENGINE_MATRIX_SSOT.md';
const text = fs.readFileSync(ssotPath, 'utf8');

function sliceBetween(begin, end) {
  const b = text.indexOf(begin);
  const e = text.indexOf(end);
  if (b < 0 || e < 0 || e <= b) return '';
  return text.slice(b + begin.length, e);
}

function splitRow(ln) {
  // keep empty cells; remove only leading/trailing pipe empties
  const raw = ln.split('|');
  const cells = raw.slice(1, -1).map((s) => (s ?? '').trim());
  return cells;
}

function cleanCell(s) {
  return (s ?? '').replace(/`/g, '').trim();
}

function parseTable(block) {
  const lines = block
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  let header = null;
  const rows = [];

  for (const ln of lines) {
    if (!ln.startsWith('|')) continue;
    if (ln.includes('---')) continue; // separator row

    const cells = splitRow(ln);

    if (!header) {
      header = cells.map(cleanCell);
      continue;
    }

    const row = {};
    header.forEach((colName, idx) => {
      row[colName] = cleanCell(cells[idx] ?? '');
    });

    // required key
    if (!row.engine_key) continue;
    rows.push(row);
  }
  return rows;
}

const sealed = parseTable(
  sliceBetween('<!-- SSOT_TABLE:SEALED_BEGIN -->', '<!-- SSOT_TABLE:SEALED_END -->')
);
const inprogress = parseTable(
  sliceBetween('<!-- SSOT_TABLE:INPROGRESS_BEGIN -->', '<!-- SSOT_TABLE:INPROGRESS_END -->')
);
const planned = parseTable(
  sliceBetween('<!-- SSOT_TABLE:PLANNED_BEGIN -->', '<!-- SSOT_TABLE:PLANNED_END -->')
);

function uniqKeys(rows) {
  return Array.from(new Set(rows.map((r) => r.engine_key).filter(Boolean)));
}

const out = {
  ssotPath,
  counts: { sealed: sealed.length, inprogress: inprogress.length, planned: planned.length },
  keys: { sealed: uniqKeys(sealed), inprogress: uniqKeys(inprogress), planned: uniqKeys(planned) },
  rows: { sealed, inprogress, planned },
};
process.stdout.write(JSON.stringify(out, null, 2));
