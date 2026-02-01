#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function sh(cmd) {
    return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}
function shAllow(cmd) {
    try { return sh(cmd); } catch { return ''; }
}

const SSOT = process.argv[2];
const EVI_DIR = process.argv[3];
if (!SSOT || !EVI_DIR) {
    console.error('Usage: plan34_promote_inprogress_v1.js <SSOT_PATH> <EVI_DIR>');
    process.exit(2);
}

function stripTicks(s) { return String(s ?? '').trim().replace(/^`+/, '').replace(/`+$/, '').trim(); }
function codeCell(s) { const v = stripTicks(s); return v ? `\`${v}\`` : ''; }

function sliceBetween(src, begin, end) {
    const bi = src.indexOf(begin);
    const ei = src.indexOf(end);
    if (bi < 0 || ei < 0 || ei <= bi) throw new Error(`Missing anchors ${begin}..${end}`);
    return { bi, ei, block: src.slice(bi + begin.length, ei), begin, end };
}

function splitRow(line) {
    const t = line.trim();
    const parts = t.split('|');
    parts.shift(); parts.pop();
    return parts.map(s => s.trim());
}

function parseTable(block) {
    const lines = block.split('\n');
    const tableLines = lines.filter(l => l.trim().startsWith('|'));
    if (tableLines.length < 2) throw new Error('Table not found / too short');
    const header = splitRow(tableLines[0]).map(s => s.trim());
    const rows = [];
    for (let i = 2; i < tableLines.length; i++) {
        const raw = tableLines[i];
        if (!raw.trim().startsWith('|')) continue;
        const cols0 = splitRow(raw);
        const cols = cols0.slice();

        // no-drop: pad/merge
        if (cols.length < header.length) while (cols.length < header.length) cols.push('');
        if (cols.length > header.length) {
            const head = cols.slice(0, header.length - 1);
            const tail = cols.slice(header.length - 1).join(' | ');
            cols.length = 0;
            cols.push(...head, tail);
        }

        const row = {};
        header.forEach((h, idx) => row[h] = cols[idx] ?? '');
        rows.push(row);
    }
    return { header, rows };
}

function renderTable(header, rows) {
    const head = '| ' + header.join(' | ') + ' |';
    const sep = '| ' + header.map(() => ':---').join(' | ') + ' |';
    const body = rows.map(r => '| ' + header.map(h => (r[h] ?? '')).join(' | ') + ' |');
    return [head, sep, ...body].join('\n');
}

function bucketOf(engineKey) {
    const k = engineKey;
    if (k.startsWith('ce')) return 'ce';
    if (k.startsWith('vg')) return 'vg';
    if (k.startsWith('au')) return 'au';
    if (k.startsWith('pp')) return 'pp';
    if (k.startsWith('qc')) return 'qc';
    if (k.startsWith('g5_') || k.startsWith('g5')) return 'g5';
    if (k.includes('router')) return 'router';
    return 'misc';
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function sha256File(fpath) {
    if (process.platform === 'darwin') {
        return sh(`shasum -a 256 "${fpath}"`).split(/\s+/)[0];
    }
    // linux
    const out = sh(`sha256sum "${fpath}"`);
    return out.split(/\s+/)[0];
}

function runGateTwice(gatePath, logDir) {
    const base = path.basename(gatePath).replace(/[^\w.-]+/g, '_');
    const log1 = path.join(logDir, `${base}.run1.log`);
    const log2 = path.join(logDir, `${base}.run2.log`);

    sh(`bash "${gatePath}" > "${log1}" 2>&1`);
    sh(`bash "${gatePath}" > "${log2}" 2>&1`);

    return { gatePath, log1, log2 };
}

// --- main ---
const src = fs.readFileSync(SSOT, 'utf8');

const SEALED = sliceBetween(src, '<!-- SSOT_TABLE:SEALED_BEGIN -->', '<!-- SSOT_TABLE:SEALED_END -->');
const INP = sliceBetween(src, '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->', '<!-- SSOT_TABLE:INPROGRESS_END -->');
const PLAN = sliceBetween(src, '<!-- SSOT_TABLE:PLANNED_BEGIN -->', '<!-- SSOT_TABLE:PLANNED_END -->');

const tSealed = parseTable(SEALED.block);
const tInp = parseTable(INP.block);
const tPlan = parseTable(PLAN.block);

// sanity: must have ledger_required column already
if (!tSealed.header.includes('ledger_required')) throw new Error('SEALED missing ledger_required');
if (!tInp.header.includes('ledger_required')) throw new Error('INPROGRESS missing ledger_required');

// collect inprogress rows
const inRows = tInp.rows.map(r => {
    const ek = stripTicks(r.engine_key);
    const gp = stripTicks(r.gate_path);
    const ap = stripTicks(r.adapter_path);
    return { ek, gp, ap, raw: r };
});

if (inRows.length === 0) {
    console.log('[OK] No IN-PROGRESS rows. Nothing to promote.');
    process.exit(0);
}

ensureDir(EVI_DIR);
const logsDir = path.join(EVI_DIR, 'logs');
ensureDir(logsDir);

// dedupe gates
const uniqueGates = [...new Set(inRows.map(x => x.gp).filter(Boolean))];

// run each gate twice
const gateRuns = [];
for (const gp of uniqueGates) {
    gateRuns.push(runGateTwice(gp, logsDir));
}

// write checksums
const sums = [];
for (const gr of gateRuns) {
    sums.push({ file: path.relative(EVI_DIR, gr.log1), sha256: sha256File(gr.log1) });
    sums.push({ file: path.relative(EVI_DIR, gr.log2), sha256: sha256File(gr.log2) });
}
fs.writeFileSync(path.join(EVI_DIR, 'SHA256SUMS.json'), JSON.stringify(sums, null, 2));

// build promotion mapping (engine -> seal_tag)
const today = new Date();
const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

const bucketTags = {};
const engineTag = {};

for (const row of inRows) {
    const b = bucketOf(row.ek);
    if (!bucketTags[b]) bucketTags[b] = `seal/p3_4_promote_${b}_${yyyymmdd}`;

    // prefer existing per-engine tag if present
    const existing = shAllow(`git tag -l "seal/${row.ek}_*" | sort | tail -n 1`);
    engineTag[row.ek] = existing ? existing : bucketTags[b];
}

// move rows: INPROGRESS -> SEALED, set seal_tag
const sealedKeySet = new Set(tSealed.rows.map(r => stripTicks(r.engine_key)));
for (const r of tInp.rows) {
    const ek = stripTicks(r.engine_key);
    if (!ek) continue;

    if (engineTag[ek]) {
        // set seal_tag
        r.seal_tag = codeCell(engineTag[ek]);

        // ensure code formatting for key/job_type paths (keep existing tick style stable)
        r.engine_key = codeCell(ek);
        r.job_type = codeCell(stripTicks(r.job_type));
        r.adapter_path = codeCell(stripTicks(r.adapter_path));
        r.gate_path = codeCell(stripTicks(r.gate_path));

        if (!sealedKeySet.has(ek)) {
            tSealed.rows.push(r);
            sealedKeySet.add(ek);
        }
    }
}

// filter INPROGRESS to empty
tInp.rows = tInp.rows.filter(r => {
    const ek = stripTicks(r.engine_key);
    return !engineTag[ek];
});

// render new ssot
const sealedNew = '\n' + renderTable(tSealed.header, tSealed.rows) + '\n';
const inpNew = '\n' + renderTable(tInp.header, tInp.rows) + '\n';
const planNew = '\n' + renderTable(tPlan.header, tPlan.rows) + '\n';

let out = src;
out = out.slice(0, SEALED.bi + SEALED.begin.length) + sealedNew + out.slice(SEALED.ei);
out = out.slice(0, INP.bi + INP.begin.length) + inpNew + out.slice(INP.ei);
out = out.slice(0, PLAN.bi + PLAN.begin.length) + planNew + out.slice(PLAN.ei);

fs.writeFileSync(SSOT, out, 'utf8');

// write promotion index
const index = {
    ts: today.toISOString(),
    counts_before: { sealed: tSealed.rows.length - inRows.length, inprogress: inRows.length, planned: tPlan.rows.length },
    counts_after: { sealed: tSealed.rows.length, inprogress: tInp.rows.length, planned: tPlan.rows.length },
    unique_gates: uniqueGates,
    gate_runs: gateRuns.map(g => ({ gate: g.gatePath, run1: path.relative(EVI_DIR, g.log1), run2: path.relative(EVI_DIR, g.log2) })),
    bucket_tags: bucketTags,
    engine_tag: engineTag
};
fs.writeFileSync(path.join(EVI_DIR, 'PROMOTION_INDEX.json'), JSON.stringify(index, null, 2));

console.log('[OK] Gates double-run completed, SSOT promoted, evidence generated.');
console.log(`[EVI] ${EVI_DIR}`);
