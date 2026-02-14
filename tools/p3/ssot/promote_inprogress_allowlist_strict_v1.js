#!/usr/bin/env node
/**
 * Strict Allowlist Promoter for PLAN-3.4.2-PASS1
 * Promotes only engines in the allowlist from IN-PROGRESS to SEALED.
 * Requires all engines in allowlist to exist in IN-PROGRESS state.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SSOT_PATH = path.join(ROOT, 'ENGINE_MATRIX_SSOT.md');
const ALLOW_PATH = process.argv[2];
const SEAL_VG = process.argv[3];
const SEAL_PP = process.argv[4];
const SEAL_CE = process.argv[5];

if (!ALLOW_PATH || !SEAL_VG || !SEAL_PP || !SEAL_CE) {
  console.error(
    'Usage: node promote_inprogress_allowlist_strict_v1.js <allowlist.txt> <seal_vg> <seal_pp> <seal_ce>'
  );
  process.exit(1);
}

const allowlist = new Set(
  fs
    .readFileSync(ALLOW_PATH, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
);

console.log(`[INFO] Allowlist size: ${allowlist.size}`);
console.log(`[INFO] Seal tags: VG=${SEAL_VG}, PP=${SEAL_PP}, CE=${SEAL_CE}`);

// Parse current SSOT
let ssot = fs.readFileSync(SSOT_PATH, 'utf8');

function sliceBetween(begin, end) {
  const bi = ssot.indexOf(begin);
  const ei = ssot.indexOf(end);
  if (bi < 0 || ei < 0 || ei <= bi) throw new Error(`Missing anchors ${begin}..${end}`);
  return { bi, ei, block: ssot.slice(bi + begin.length, ei) };
}

function parseTable(block) {
  const lines = block.split('\n');
  let header = null;
  const rows = [];

  for (const ln of lines) {
    if (!ln.trim().startsWith('|')) continue;
    if (ln.includes('---')) continue;

    const cols = ln
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!header) {
      header = cols.map((s) => s.replace(/`/g, '').trim());
      continue;
    }

    if (cols.length < header.length) continue;

    const row = {};
    header.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').replace(/`/g, '').trim();
    });

    if (row.engine_key) rows.push(row);
  }

  return { header, rows };
}

const INP_BEGIN = '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->';
const INP_END = '<!-- SSOT_TABLE:INPROGRESS_END -->';
const SEAL_BEGIN = '<!-- SSOT_TABLE:SEALED_BEGIN -->';
const SEAL_END = '<!-- SSOT_TABLE:SEALED_END -->';

const inpSlice = sliceBetween(INP_BEGIN, INP_END);
const sealSlice = sliceBetween(SEAL_BEGIN, SEAL_END);

const inpTable = parseTable(inpSlice.block);
const sealTable = parseTable(sealSlice.block);

// Validate all allowlist keys exist in IN-PROGRESS
const inpKeys = new Set(inpTable.rows.map((r) => r.engine_key));
const missing = [...allowlist].filter((k) => !inpKeys.has(k));
if (missing.length > 0) {
  console.error('[FATAL] Allowlist contains keys not in IN-PROGRESS:', missing);
  process.exit(2);
}

// Determine seal tag per engine
function tagFor(k) {
  if (k.startsWith('vg')) return SEAL_VG;
  if (k.startsWith('pp')) return SEAL_PP;
  return SEAL_CE; // ce08/12/13
}

// Split IN-PROGRESS rows: those to promote vs those to keep
const toPromote = [];
const toKeep = [];

for (const row of inpTable.rows) {
  if (allowlist.has(row.engine_key)) {
    row.seal_tag = tagFor(row.engine_key);
    row.state = 'SEALED';
    toPromote.push(row);
  } else {
    toKeep.push(row);
  }
}

console.log(`[INFO] Promoting ${toPromote.length} engines to SEALED`);
console.log(`[INFO] Keeping ${toKeep.length} engines in IN-PROGRESS`);

// Rebuild tables
function renderTable(header, rows) {
  const head = '| ' + header.join(' | ') + ' |';
  const sep = '| ' + header.map(() => ':---').join(' | ') + ' |';

  function fmtCell(val) {
    if (!val || val === '-') return '';
    return '`' + val + '`';
  }

  const body = rows.map((r) => {
    const cells = header.map((h) => {
      const v = r[h] || '';
      if (
        ['engine_key', 'job_type', 'adapter_path', 'gate_path', 'seal_tag'].includes(h) &&
        v &&
        v !== '-'
      ) {
        return fmtCell(v);
      }
      return v;
    });
    return '| ' + cells.join(' | ') + ' |';
  });

  return [head, sep, ...body].join('\n');
}

// New SEALED table: existing + promoted
const newSealed = [...sealTable.rows, ...toPromote];
const newInprog = toKeep;

const sealedRendered = '\n' + renderTable(sealTable.header, newSealed) + '\n';
const inprogRendered = '\n' + renderTable(inpTable.header, newInprog) + '\n';

// Replace in SSOT
ssot = ssot.slice(0, sealSlice.bi + SEAL_BEGIN.length) + sealedRendered + ssot.slice(sealSlice.ei);

// Re-find IN-PROGRESS anchors after SEALED replacement
const inpSlice2 = sliceBetween(INP_BEGIN, INP_END);
ssot = ssot.slice(0, inpSlice2.bi + INP_BEGIN.length) + inprogRendered + ssot.slice(inpSlice2.ei);

fs.writeFileSync(SSOT_PATH, ssot, 'utf8');
console.log('[OK] SSOT promotion complete');
console.log(`  SEALED: ${sealTable.rows.length} → ${newSealed.length} (+${toPromote.length})`);
console.log(`  IN-PROGRESS: ${inpTable.rows.length} → ${newInprog.length} (-${toPromote.length})`);
