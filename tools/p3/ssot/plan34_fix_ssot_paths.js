#!/usr/bin/env node
'use strict';

const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const SSOT = process.argv[2];
if (!SSOT) {
  console.error('Usage: plan34_fix_ssot_paths.js <SSOT_PATH>');
  process.exit(2);
}

const WHITELIST_ADAPTER_PREFIX = ['apps/', 'packages/', 'tools/'];
const WHITELIST_GATE_PREFIX = ['tools/', '.githooks/', '.husky/', 'apps/'];

function sh(cmd) {
  return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}
function gitFiles() {
  return sh('git ls-files')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
const FILES = gitFiles();

function findUniqueByBasename(basename, preferContains) {
  const hits = FILES.filter((f) => f.endsWith('/' + basename) || f === basename);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];

  // prefer path containing preferContains (first match)
  for (const pref of preferContains) {
    const p = hits.find((h) => h.includes(pref));
    if (p) return p;
  }
  // ambiguous
  throw new Error(`AMBIGUOUS basename=${basename} hits=${hits.join(',')}`);
}

function assertPrefix(p, whitelist, field) {
  if (!p.includes('/')) throw new Error(`${field}_NOT_ROOT_RELATIVE: ${p}`);
  if (!whitelist.some((w) => p.startsWith(w))) throw new Error(`${field}_PREFIX_DENY: ${p}`);
}

function sliceBetween(src, begin, end) {
  const bi = src.indexOf(begin);
  const ei = src.indexOf(end);
  if (bi < 0 || ei < 0 || ei <= bi) throw new Error(`Missing anchors ${begin}..${end}`);
  return { bi, ei, block: src.slice(bi + begin.length, ei) };
}

function parseMarkdownTable(block) {
  const lines = block.split('\n').map((l) => l.trimEnd());
  const tableLines = lines.filter((l) => l.trim().startsWith('|'));
  if (tableLines.length < 2) return null;

  const header = tableLines[0]
    .split('|')
    .slice(1, -1)
    .map((s) => s.trim());
  const rows = [];
  for (let i = 2; i < tableLines.length; i++) {
    // Don't strip backticks or trim whitespace from column values yet - keep original values
    const cols = tableLines[i].split('|').slice(1, -1);
    if (cols.length !== header.length) continue;
    const row = {};
    header.forEach((h, idx) => (row[h] = cols[idx]));
    rows.push(row);
  }
  return { header, rows, rawLines: tableLines };
}

function renderTable(header, rows) {
  const head = '| ' + header.join(' | ') + ' |';
  const sep = '| ' + header.map(() => ':---').join(' | ') + ' |';
  const body = rows.map(
    (r) =>
      '| ' +
      header
        .map((h) => {
          const val = r[h];
          // Preserve backticks for engine_key and other fields that originally had them
          if (h === 'engine_key' && val && !val.startsWith('`')) return `\`${val}\``;
          return val !== undefined && val !== null ? val : '';
        })
        .join(' | ') +
      ' |'
  );
  return [head, sep, ...body].join('\n');
}

function renameHeader(header) {
  return header.map((h) => {
    // Strip backticks from header first
    const clean = h.replace(/`/g, '').trim();
    return clean === 'billing' ? 'ledger_required' : clean;
  });
}

function fixRowPaths(row, stateName) {
  // Only enforce for SEALED / IN-PROGRESS
  const a = row['adapter_path'];
  const g = row['gate_path'];

  if (a && !a.includes('/')) {
    const fixed = findUniqueByBasename(stripTicks(a), [
      '/apps/api/src/engines/adapters/',
      '/apps/api/src/engines/',
      '/packages/',
      '/tools/',
    ]);
    if (!fixed) throw new Error(`ADAPTER_NOT_FOUND: ${a} (${stateName})`);
    row['adapter_path'] = fixed;
  } else if (a) {
    row['adapter_path'] = stripTicks(a);
  }

  if (g && !g.includes('/')) {
    const fixed = findUniqueByBasename(stripTicks(g), [
      '/tools/gate/gates/',
      '/tools/p9/',
      '/tools/p3/',
      '/.githooks/',
      '/.husky/',
    ]);
    if (!fixed) throw new Error(`GATE_NOT_FOUND: ${g} (${stateName})`);
    row['gate_path'] = fixed;
  } else if (g) {
    row['gate_path'] = stripTicks(g);
  }

  if (row['adapter_path'])
    assertPrefix(row['adapter_path'], WHITELIST_ADAPTER_PREFIX, 'adapter_path');
  if (row['gate_path']) assertPrefix(row['gate_path'], WHITELIST_GATE_PREFIX, 'gate_path');

  // Alias semantics: if adapter_path equals another engine's adapter, require ALIAS_OF=... in notes (soft add for known case)
  if (row['engine_key'] === 'ce02_identity_lock') {
    const notes = row['notes'] || '';
    if (!notes.includes('ALIAS_OF='))
      row['notes'] = (notes ? notes + '; ' : '') + 'ALIAS_OF=ce23_identity_consistency';
  }
}

function stripTicks(s) {
  return String(s).replace(/`/g, '').trim();
}

const src = fs.readFileSync(SSOT, 'utf8');

// Sections
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

const tSealed = parseMarkdownTable(SEALED.block);
const tInp = parseMarkdownTable(INP.block);
const tPlan = parseMarkdownTable(PLAN.block);

if (!tSealed || !tInp || !tPlan) throw new Error('Failed to parse one or more SSOT tables');

// Rename headers (billing -> ledger_required) (header only)
tSealed.header = renameHeader(tSealed.header);
tInp.header = renameHeader(tInp.header);
tPlan.header = renameHeader(tPlan.header);

// Ensure planned has expected_* columns and adapter/gate empty
function ensurePlannedColumns(t) {
  const need = ['expected_adapter_path', 'expected_gate_path'];
  for (const c of need) if (!t.header.includes(c)) t.header.push(c);
  // Ensure columns exist in rows
  for (const r of t.rows) {
    for (const c of need) if (r[c] === undefined) r[c] = '';
    // Move any existing adapter/gate into expected and clear adapter/gate
    const ap = stripTicks(r['adapter_path'] || '');
    const gp = stripTicks(r['gate_path'] || '');
    if (ap) {
      r['expected_adapter_path'] = ap;
      r['adapter_path'] = '';
    }
    if (gp) {
      r['expected_gate_path'] = gp;
      r['gate_path'] = '';
    }
  }
}
ensurePlannedColumns(tPlan);

// Fix paths for sealed/inprogress
for (const r of tSealed.rows) fixRowPaths(r, 'SEALED');
for (const r of tInp.rows) fixRowPaths(r, 'IN-PROGRESS');

// Re-render blocks
const sealedBlockNew = '\n' + renderTable(tSealed.header, tSealed.rows) + '\n';
const inpBlockNew = '\n' + renderTable(tInp.header, tInp.rows) + '\n';
const planBlockNew = '\n' + renderTable(tPlan.header, tPlan.rows) + '\n';

let out = src;
out =
  out.slice(0, SEALED.bi + '<!-- SSOT_TABLE:SEALED_BEGIN -->'.length) +
  sealedBlockNew +
  out.slice(SEALED.ei);
out =
  out.slice(0, INP.bi + '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->'.length) +
  inpBlockNew +
  out.slice(INP.ei);
out =
  out.slice(0, PLAN.bi + '<!-- SSOT_TABLE:PLANNED_BEGIN -->'.length) +
  planBlockNew +
  out.slice(PLAN.ei);

fs.writeFileSync(SSOT, out, 'utf8');
console.log(`[OK] SSOT path semantics fixed: ${SSOT}`);
