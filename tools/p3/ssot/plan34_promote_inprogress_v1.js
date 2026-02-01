#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function exec(cmd, opts = {}) {
    return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString('utf8');
}
function execAllow(cmd) {
    try { return exec(cmd).trim(); } catch { return ''; }
}
function nowTsCompact() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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
        if (raw.includes('SSOT_TABLE')) continue;

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

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function sha256OfFile(fpath) {
    // mac: shasum, linux: sha256sum
    const cmd = process.platform === 'darwin'
        ? `shasum -a 256 "${fpath}"`
        : `sha256sum "${fpath}"`;
    const out = exec(cmd).trim();
    return out.split(/\s+/)[0];
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

function bashSyntaxOk(gatePath, outFile) {
    try {
        exec(`bash -n "${gatePath}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
        fs.writeFileSync(outFile, '[OK] bash -n passed\n');
        return { ok: true, err: '' };
    } catch (e) {
        const msg = (e.stderr ? e.stderr.toString('utf8') : '') || (e.message || String(e));
        fs.writeFileSync(outFile, `[FAIL] bash -n failed\n${msg}\n`);
        return { ok: false, err: msg };
    }
}

function runGateTwiceTolerant(gatePath, logDir) {
    const base = path.basename(gatePath).replace(/[^\w.-]+/g, '_');
    const pre = path.join(logDir, `${base}.syntax.log`);
    const log1 = path.join(logDir, `${base}.run1.log`);
    const log2 = path.join(logDir, `${base}.run2.log`);

    const syntax = bashSyntaxOk(gatePath, pre);
    if (!syntax.ok) {
        fs.writeFileSync(log1, `[SKIP] Gate skipped due to syntax error\n`);
        fs.writeFileSync(log2, `[SKIP] Gate skipped due to syntax error\n`);
        return { gatePath, syntax_ok: false, run1_ok: false, run2_ok: false, success: false, error: `SYNTAX_ERROR: ${syntax.err}`, pre, log1, log2 };
    }

    let run1Ok = false;
    let run2Ok = false;
    let errMsg = '';

    try {
        exec(`bash "${gatePath}" > "${log1}" 2>&1`);
        run1Ok = true;
    } catch (e) {
        errMsg = (e.stderr ? e.stderr.toString('utf8') : '') || (e.message || String(e));
        fs.appendFileSync(log1, `\n[FAIL] run1 failed\n${errMsg}\n`);
        fs.writeFileSync(log2, `[SKIP] run2 skipped because run1 failed\n`);
        return { gatePath, syntax_ok: true, run1_ok: false, run2_ok: false, success: false, error: `RUN1_FAIL: ${errMsg}`, pre, log1, log2 };
    }

    try {
        exec(`bash "${gatePath}" > "${log2}" 2>&1`);
        run2Ok = true;
    } catch (e) {
        errMsg = (e.stderr ? e.stderr.toString('utf8') : '') || (e.message || String(e));
        fs.appendFileSync(log2, `\n[FAIL] run2 failed\n${errMsg}\n`);
        return { gatePath, syntax_ok: true, run1_ok: true, run2_ok: false, success: false, error: `RUN2_FAIL: ${errMsg}`, pre, log1, log2 };
    }

    return { gatePath, syntax_ok: true, run1_ok: run1Ok, run2_ok: run2Ok, success: run1Ok && run2Ok, error: '', pre, log1, log2 };
}

// --- main ---
ensureDir(EVI_DIR);
const logsDir = path.join(EVI_DIR, 'logs');
ensureDir(logsDir);

const src = fs.readFileSync(SSOT, 'utf8');

const SEALED = sliceBetween(src, '<!-- SSOT_TABLE:SEALED_BEGIN -->', '<!-- SSOT_TABLE:SEALED_END -->');
const INP = sliceBetween(src, '<!-- SSOT_TABLE:INPROGRESS_BEGIN -->', '<!-- SSOT_TABLE:INPROGRESS_END -->');
const PLAN = sliceBetween(src, '<!-- SSOT_TABLE:PLANNED_BEGIN -->', '<!-- SSOT_TABLE:PLANNED_END -->');

const tSealed = parseTable(SEALED.block);
const tInp = parseTable(INP.block);
const tPlan = parseTable(PLAN.block);

// tolerate legacy column name: billing -> ledger_required
function normalizeLedgerColumn(t) {
    if (!t.header.includes('ledger_required') && t.header.includes('billing')) {
        t.header = t.header.map(h => h === 'billing' ? 'ledger_required' : h);
        for (const r of t.rows) {
            r.ledger_required = r.billing;
            delete r.billing;
        }
    }
}
normalizeLedgerColumn(tSealed);
normalizeLedgerColumn(tInp);
normalizeLedgerColumn(tPlan);

if (!tSealed.header.includes('ledger_required')) throw new Error('SEALED missing ledger_required');
if (!tInp.header.includes('ledger_required')) throw new Error('INPROGRESS missing ledger_required');

const inRows = tInp.rows.map(r => {
    const ek = stripTicks(r.engine_key);
    const gp = stripTicks(r.gate_path);
    const ap = stripTicks(r.adapter_path);
    return { ek, gp, ap, raw: r };
}).filter(x => x.ek);

if (inRows.length === 0) {
    fs.writeFileSync(path.join(EVI_DIR, 'PROMOTION_INDEX.json'), JSON.stringify({ ts: new Date().toISOString(), note: 'no inprogress rows' }, null, 2));
    console.log('[OK] No IN-PROGRESS rows. Nothing to promote.');
    process.exit(0);
}

const uniqueGates = [...new Set(inRows.map(x => x.gp).filter(Boolean))];

// gate run (tolerant)
const gateRuns = [];
for (const gp of uniqueGates) {
    gateRuns.push(runGateTwiceTolerant(gp, logsDir));
}

// checksums for logs
const sums = [];
for (const gr of gateRuns) {
    for (const f of [gr.pre, gr.log1, gr.log2]) {
        sums.push({ file: path.relative(EVI_DIR, f), sha256: sha256OfFile(f) });
    }
}
fs.writeFileSync(path.join(EVI_DIR, 'SHA256SUMS.json'), JSON.stringify(sums, null, 2));

// map gate -> success
const gateSuccess = new Map(gateRuns.map(g => [g.gatePath, !!g.success]));

// promote only engines whose gate succeeded
const promotable = [];
const skipped = [];

for (const row of inRows) {
    const ok = gateSuccess.get(row.gp) === true;
    if (ok) promotable.push(row);
    else skipped.push({ engine_key: row.ek, gate_path: row.gp, reason: 'GATE_FAIL_OR_SYNTAX' });
}

const failedGates = gateRuns.filter(g => !g.success).map(g => ({
    gate_path: g.gatePath,
    syntax_ok: g.syntax_ok,
    run1_ok: g.run1_ok,
    run2_ok: g.run2_ok,
    error: g.error,
    logs: {
        syntax: path.relative(EVI_DIR, g.pre),
        run1: path.relative(EVI_DIR, g.log1),
        run2: path.relative(EVI_DIR, g.log2),
    }
}));

fs.writeFileSync(path.join(EVI_DIR, 'FAILED_GATES.json'), JSON.stringify(failedGates, null, 2));
fs.writeFileSync(path.join(EVI_DIR, 'SKIPPED_ENGINES.json'), JSON.stringify(skipped, null, 2));

// if nothing promotable, keep SSOT unchanged
if (promotable.length === 0) {
    fs.writeFileSync(path.join(EVI_DIR, 'PROMOTED_ENGINES.json'), JSON.stringify([], null, 2));
    fs.writeFileSync(path.join(EVI_DIR, 'PROMOTION_INDEX.json'), JSON.stringify({
        ts: new Date().toISOString(),
        note: 'no promotable engines; all gates failed',
        inprogress_total: inRows.length,
        promotable: 0,
        skipped: skipped.length,
        unique_gates: uniqueGates.length,
        failed_gates: failedGates.length
    }, null, 2));
    console.log('[WARN] No promotable engines. SSOT not changed.');
    process.exit(0);
}

// bucket tags (only for buckets that actually promote >=1 engine)
const tagSuffix = path.basename(EVI_DIR).replace(/^p3_4_promote_inprogress_/, 'p3_4_promote_');
const bucketTags = {};
const engineTag = {};

for (const row of promotable) {
    const b = bucketOf(row.ek);
    if (!bucketTags[b]) bucketTags[b] = `seal/${tagSuffix}_${b}`; // unique per evidence run
    engineTag[row.ek] = bucketTags[b];
}

fs.writeFileSync(path.join(EVI_DIR, 'PROMOTED_ENGINES.json'), JSON.stringify(promotable.map(x => ({ engine_key: x.ek, gate_path: x.gp, seal_tag: engineTag[x.ek] })), null, 2));

// move rows: INPROGRESS -> SEALED, set seal_tag to planned bucket tag (created later by wrapper)
const sealedKeySet = new Set(tSealed.rows.map(r => stripTicks(r.engine_key)));

for (const r of tInp.rows) {
    const ek = stripTicks(r.engine_key);
    if (!ek) continue;
    if (!engineTag[ek]) continue;

    // normalize cells
    r.engine_key = codeCell(ek);
    r.job_type = codeCell(stripTicks(r.job_type));
    r.audit_prefix = stripTicks(r.audit_prefix) ? stripTicks(r.audit_prefix) : r.audit_prefix;
    r.adapter_path = codeCell(stripTicks(r.adapter_path));
    r.gate_path = codeCell(stripTicks(r.gate_path));
    r.seal_tag = codeCell(engineTag[ek]);

    // ensure ledger_required is preserved as-is
    r.ledger_required = stripTicks(r.ledger_required) ? stripTicks(r.ledger_required) : r.ledger_required;

    if (!sealedKeySet.has(ek)) {
        tSealed.rows.push(r);
        sealedKeySet.add(ek);
    }
}

// filter INPROGRESS to keep only non-promoted
tInp.rows = tInp.rows.filter(r => {
    const ek = stripTicks(r.engine_key);
    return !engineTag[ek];
});

// render new ssot blocks
const sealedNew = '\n' + renderTable(tSealed.header, tSealed.rows) + '\n';
const inpNew = '\n' + renderTable(tInp.header, tInp.rows) + '\n';
const planNew = '\n' + renderTable(tPlan.header, tPlan.rows) + '\n';

let out = src;
out = out.slice(0, SEALED.bi + SEALED.begin.length) + sealedNew + out.slice(SEALED.ei);
out = out.slice(0, INP.bi + INP.begin.length) + inpNew + out.slice(INP.ei);
out = out.slice(0, PLAN.bi + PLAN.begin.length) + planNew + out.slice(PLAN.ei);

fs.writeFileSync(SSOT, out, 'utf8');

const index = {
    ts: new Date().toISOString(),
    evi_dir: EVI_DIR,
    inprogress_total_before: inRows.length,
    promotable: promotable.length,
    skipped: skipped.length,
    unique_gates: uniqueGates.length,
    failed_gates: failedGates.length,
    bucket_tags: bucketTags,
    engine_tag: engineTag
};
fs.writeFileSync(path.join(EVI_DIR, 'PROMOTION_INDEX.json'), JSON.stringify(index, null, 2));

console.log('[OK] Promotion completed (tolerant).');
console.log(`[EVI] ${EVI_DIR}`);
console.log(`[PROMOTED] ${promotable.length} engines`);
console.log(`[SKIPPED] ${skipped.length} engines (see SKIPPED_ENGINES.json)`);
console.log(`[FAILED_GATES] ${failedGates.length} (see FAILED_GATES.json)`);
