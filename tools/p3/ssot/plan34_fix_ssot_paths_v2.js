#!/usr/bin/env node
'use strict';

const fs = require('fs');
const cp = require('child_process');

const SSOT = process.argv[2];
if (!SSOT) {
  console.error('Usage: plan34_fix_ssot_paths_v2.js <SSOT_PATH>');
  process.exit(2);
}

function sh(cmd) {
  return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

const FILES = new Set(
  sh('git ls-files')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
);

function findUniqueByBasename(basename, preferContains = []) {
  const hits = [...FILES].filter((f) => f === basename || f.endsWith('/' + basename));
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  for (const pref of preferContains) {
    const p = hits.find((h) => h.includes(pref));
    if (p) return p;
  }
  throw new Error(`AMBIGUOUS basename=${basename} hits=${hits.join(',')}`);
}

function stripTicks(s) {
  const t = String(s ?? '').trim();
  // remove wrapping backticks repeatedly
  return t.replace(/^`+/, '').replace(/`+$/, '').trim();
}
function codeCell(s) {
  const v = stripTicks(s);
  return v ? `\`${v}\`` : '';
}
function plainCell(s) {
  return String(s ?? '').trim();
}

function sliceBetween(src, begin, end) {
  const bi = src.indexOf(begin);
  const ei = src.indexOf(end);
  if (bi < 0 || ei < 0 || ei <= bi) throw new Error(`Missing anchors ${begin}..${end}`);
  return { bi, ei, block: src.slice(bi + begin.length, ei) };
}

function parseTable(block) {
  const lines = block.split('\n');
  const tableLines = lines.filter((l) => l.trim().startsWith('|'));
  if (tableLines.length < 2) throw new Error('Table not found / too short');

  const header = splitRow(tableLines[0]).map((s) => s.trim());
  const sep = tableLines[1];

  const rows = [];
  for (let i = 2; i < tableLines.length; i++) {
    const raw = tableLines[i];
    const cols = splitRow(raw);

    // zero-drop policy: pad/merge
    if (cols.length < header.length) {
      while (cols.length < header.length) cols.push('');
    }
    if (cols.length > header.length) {
      const head = cols.slice(0, header.length - 1);
      const tail = cols.slice(header.length - 1).join(' | ');
      cols.length = 0;
      cols.push(...head, tail);
    }

    const row = {};
    header.forEach((h, idx) => (row[h] = cols[idx]));
    rows.push(row);
  }

  return { header, sep, rows };
}

function splitRow(line) {
  // Keep empties; markdown row is like | a | b | c |
  const t = line.trim();
  const parts = t.split('|');
  // remove first and last (leading/trailing)
  parts.shift();
  parts.pop();
  return parts.map((s) => s.trim());
}

function renderTable(header, rows) {
  const head = '| ' + header.join(' | ') + ' |';
  const sep = '| ' + header.map(() => ':---').join(' | ') + ' |';
  const body = rows.map((r) => '| ' + header.map((h) => r[h] ?? '').join(' | ') + ' |');
  return [head, sep, ...body].join('\n');
}

function renameHeader(header) {
  return header.map((h) => (h === 'billing' ? 'ledger_required' : h));
}

function assertRootRelative(p, field) {
  const v = stripTicks(p);
  if (!v) return;
  if (!v.includes('/')) throw new Error(`${field}_NOT_ROOT_RELATIVE: ${v}`);
}

function normalizeSealedOrInprogressRow(r) {
  // header might still be billing before rename; handle both
  if (r['billing'] !== undefined && r['ledger_required'] === undefined) {
    r['ledger_required'] = r['billing'];
    delete r['billing'];
  }

  // adapter_path
  const ap = stripTicks(r['adapter_path'] || '');
  if (ap && !ap.includes('/')) {
    const fixed = findUniqueByBasename(ap, [
      'apps/api/src/engines/adapters/',
      'apps/api/src/engines/',
      'tools/gate/gates/',
      'tools/',
      'packages/',
    ]);
    if (!fixed) throw new Error(`ADAPTER_NOT_FOUND: ${ap} (${stripTicks(r.engine_key)})`);
    r['adapter_path'] = codeCell(fixed);
  } else if (ap) {
    // Already has /, just wrap in backticks
    r['adapter_path'] = codeCell(ap);
  } else {
    r['adapter_path'] = '';
  }

  // gate_path
  const gp = stripTicks(r['gate_path'] || '');
  if (gp && !gp.includes('/')) {
    const fixed = findUniqueByBasename(gp, [
      'tools/gate/gates/',
      'tools/',
      '.githooks/',
      '.husky/',
    ]);
    if (!fixed) throw new Error(`GATE_NOT_FOUND: ${gp} (${stripTicks(r.engine_key)})`);
    r['gate_path'] = codeCell(fixed);
  } else if (gp) {
    // Already has /, just wrap in backticks
    r['gate_path'] = codeCell(gp);
  } else {
    r['gate_path'] = '';
  }

  // code-format cells
  r['engine_key'] = codeCell(r['engine_key']);
  r['job_type'] = codeCell(r['job_type']);
  r['seal_tag'] =
    stripTicks(r['seal_tag'] || '') && stripTicks(r['seal_tag'] || '') !== '-'
      ? codeCell(r['seal_tag'])
      : stripTicks(r['seal_tag'] || '') === '-'
        ? '-'
        : '';

  // alias semantics: normalize ce02 note
  const ek = stripTicks(r['engine_key']);
  if (ek === 'ce02_identity_lock') {
    const notes = plainCell(r['notes'] || '');
    if (!notes.includes('ALIAS_OF=')) {
      r['notes'] = (notes ? notes + '; ' : '') + 'ALIAS_OF=ce23_identity_consistency';
    }
  }

  // asserts (root relative now)
  assertRootRelative(r['adapter_path'], 'adapter_path');
  assertRootRelative(r['gate_path'], 'gate_path');

  // rename done at table level; but ensure ledger_required exists
  if (r['ledger_required'] === undefined) r['ledger_required'] = '';
}

function normalizePlannedRow(r) {
  if (r['billing'] !== undefined && r['ledger_required'] === undefined) {
    r['ledger_required'] = r['billing'];
    delete r['billing'];
  }
  // expected columns will be added at table level
  const ap = stripTicks(r['adapter_path'] || '');
  const gp = stripTicks(r['gate_path'] || '');

  // move any existing planned adapter/gate into expected_*
  if (ap) r['expected_adapter_path'] = codeCell(ap);
  if (gp) r['expected_gate_path'] = codeCell(gp);

  // planned must not have real paths
  r['adapter_path'] = '';
  r['gate_path'] = '';
  r['seal_tag'] = '-';

  // code-format cells
  r['engine_key'] = codeCell(r['engine_key']);
  r['job_type'] = codeCell(r['job_type']);

  // asserts: planned adapter/gate empty, expected can be file name or root-rel; we enforce contains '/' if already fixed
  const eap = stripTicks(r['expected_adapter_path'] || '');
  const egp = stripTicks(r['expected_gate_path'] || '');
  if (eap && eap.includes('/'))
    assertRootRelative(r['expected_adapter_path'], 'expected_adapter_path');
  if (egp && egp.includes('/')) assertRootRelative(r['expected_gate_path'], 'expected_gate_path');

  if (r['expected_adapter_path'] === undefined) r['expected_adapter_path'] = '';
  if (r['expected_gate_path'] === undefined) r['expected_gate_path'] = '';
}

const src = fs.readFileSync(SSOT, 'utf8');

const SEALED = sliceBetween(
  src,
  '<!-- SSOT_TABLE:SEALED_BEGIN -->',
  '<!-- SSOT_TABLE:SEALED_END -->'
);
const INP = sliceBetween(
  src,
  '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->',
  '<!-- SSOT_TABLE:INPROGRESS_END -->'
);
const PLAN = sliceBetween(
  src,
  '<!-- SSOT_TABLE:PLANNED_BEGIN -->',
  '<!-- SSOT_TABLE:PLANNED_END -->'
);

const tSealed = parseTable(SEALED.block);
const tInp = parseTable(INP.block);
const tPlan = parseTable(PLAN.block);

// Rename headers
tSealed.header = renameHeader(tSealed.header);
tInp.header = renameHeader(tInp.header);
tPlan.header = renameHeader(tPlan.header);

// Ensure planned expected columns
for (const c of ['expected_adapter_path', 'expected_gate_path']) {
  if (!tPlan.header.includes(c)) tPlan.header.push(c);
}

// Normalize rows
for (const r of tSealed.rows) normalizeSealedOrInprogressRow(r);
for (const r of tInp.rows) normalizeSealedOrInprogressRow(r);
for (const r of tPlan.rows) normalizePlannedRow(r);

// Re-render blocks
const sealedNew = '\n' + renderTable(tSealed.header, tSealed.rows) + '\n';
const inpNew = '\n' + renderTable(tInp.header, tInp.rows) + '\n';
const planNew = '\n' + renderTable(tPlan.header, tPlan.rows) + '\n';

// Replace in order, recalculating indices after each replacement
let out = src;

// Replace SEALED first
const sealedBegin = '<!-- SSOT_TABLE:SEALED_BEGIN -->';
const sealedEnd = '<!-- SSOT_TABLE:SEALED_END -->';
let sbi = out.indexOf(sealedBegin);
let sei = out.indexOf(sealedEnd);
out = out.slice(0, sbi + sealedBegin.length) + sealedNew + out.slice(sei);

// Recalculate for INP
const inpBegin = '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->';
const inpEnd = '<!-- SSOT_TABLE:INPROGRESS_END -->';
let ibi = out.indexOf(inpBegin);
let iei = out.indexOf(inpEnd);
out = out.slice(0, ibi + inpBegin.length) + inpNew + out.slice(iei);

// Recalculate for PLAN
const planBegin = '<!-- SSOT_TABLE:PLANNED_BEGIN -->';
const planEnd = '<!-- SSOT_TABLE:PLANNED_END -->';
let pbi = out.indexOf(planBegin);
let pei = out.indexOf(planEnd);
out = out.slice(0, pbi + planBegin.length) + planNew + out.slice(pei);

fs.writeFileSync(SSOT, out, 'utf8');
console.log(`[OK] SSOT fixed (v2 no-drop parser): ${SSOT}`);
