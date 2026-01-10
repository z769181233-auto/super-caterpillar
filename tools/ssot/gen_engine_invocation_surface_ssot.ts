/* CE-ARCH-GUARD-02: Engine Invocation Surface SSOT Generator
 * Deterministic output:
 * - No timestamps / host info / statistics in JSON or MD
 * - Sorted + de-duplicated arrays
 * - Stable JSON stringify (2 spaces)
 *
 * NOTE: Volatile info must be written by gate evidence log, not here.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

type CallSite = {
    file: string;
    function: string;
    lineRange: string; // e.g. "45-45" or "45-60"
    type: string;
    engineKey: string; // "dynamic" if not statically resolvable
    endpoint?: string;
    notes?: string;
};

type EngineSurfaceItem = {
    engineKey: string;
    version: string;
    mode: string; // "local" | "http" | "unknown"
    adapterToken?: string;
    httpConfig?: { baseUrl: string; path: string };
    registeredIn: string;
};

type SecurityAuditSurface = {
    hmacProtected: string[];
    auditActions: string[];
    metricsUsageProducers: string[];
};

const SCAN_RANGES = ['apps/api/src', 'apps/workers/src'] as const;

// ❌ Forbidden non-deterministic fields (must never appear in SSOT JSON)
const FORBIDDEN_FIELDS = [
    'generatedAt',
    'timestamp',
    'scanTimestamp',
    'createdAt',
    'updatedAt',
    'hostMachine',
    'hostname',
    'userName',
    'statistics',
    'totalCallSites',
    'totalEngineKeys',
    'duration',
    'scanDuration',
] as const;

// Technical debt allowlist hard cap (MUST match exactly; expansion is prohibited)
const TECHNICAL_DEBT_ALLOWLIST = [
    'apps/workers/src/engine-adapter-client.ts',
    'apps/workers/src/novel-analysis-processor.ts',
    'apps/workers/src/adapters/visual-density.adapter.ts',
    'apps/workers/src/adapters/visual-enrichment.adapter.ts',
    'apps/workers/src/billing/cost-ledger.service.ts',
] as const;

function die(msg: string): never {
    // eslint-disable-next-line no-console
    console.error(msg);
    process.exit(1);
}

function norm(p: string): string {
    return p.replace(/\\/g, '/');
}

function ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
}

function writeFileAtomic(filePath: string, content: string) {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    const tmp = path.join(dir, `.tmp_${path.basename(filePath)}_${process.pid}_${Date.now()}`);
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, filePath);
}

function stableSort<T>(arr: T[], keyFn: (x: T) => string): T[] {
    return [...arr].sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
}

function uniqBy<T>(arr: T[], keyFn: (x: T) => string): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of arr) {
        const k = keyFn(item);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(item);
        }
    }
    return out;
}

function runRg(pattern: string, cwd: string): string {
    // Use ripgrep if available in repo environment; fail loudly otherwise.
    try {
        // Use cwd option instead of passing path as argument to avoid quote issues
        return execSync(`rg --no-heading --line-number --fixed-strings ${shellQuote(pattern)}`, {
            cwd: cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
            maxBuffer: 50 * 1024 * 1024,
        });
    } catch (e: any) {
        // rg returns exit code 1 when no matches; treat as empty.
        if (typeof e?.status === 'number' && e.status === 1) return '';
        die(`[FAIL] rg execution failed for pattern=${pattern}: ${String(e?.message || e)}`);
    }
}

function shellQuote(s: string): string {
    // minimal safe single-quote
    return `'${s.replace(/'/g, `'\\''`)}'`;
}

function readLines(filePath: string): string[] {
    const txt = fs.readFileSync(filePath, 'utf8');
    return txt.split(/\r?\n/);
}

function findEnclosingFunctionName(filePath: string, lineNo1: number): string {
    // Best-effort lightweight parse: look upward for class method or function declaration.
    // Deterministic: fixed lookback window.
    const lines = readLines(filePath);
    const idx = Math.max(0, Math.min(lines.length - 1, lineNo1 - 1));
    const start = Math.max(0, idx - 80);

    // Patterns (priority order)
    const methodRe = /^\s*(public|private|protected)?\s*(async\s+)?([A-Za-z0-9_$]+)\s*\(/;
    const funcRe = /^\s*(export\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
    const classRe = /^\s*export\s+class\s+([A-Za-z0-9_$]+)/;

    let nearestClass: string | null = null;
    for (let i = idx; i >= start; i--) {
        const line = lines[i] || '';
        const mFunc = line.match(funcRe);
        if (mFunc) return mFunc[3];

        const mMethod = line.match(methodRe);
        if (mMethod && nearestClass) return `${nearestClass}.${mMethod[3]}`;

        const mClass = line.match(classRe);
        if (mClass) nearestClass = mClass[1];
    }
    return 'UNKNOWN';
}

function parseRgOutputToMatches(out: string): Array<{ file: string; line: number; text: string }> {
    // rg output lines: path:line:text
    const matches: Array<{ file: string; line: number; text: string }> = [];
    const lines = out.split(/\r?\n/).filter(Boolean);
    for (const l of lines) {
        const first = l.indexOf(':');
        const second = first >= 0 ? l.indexOf(':', first + 1) : -1;
        if (first < 0 || second < 0) continue;
        const file = norm(l.slice(0, first));
        const lineStr = l.slice(first + 1, second);
        const line = Number(lineStr);
        if (!Number.isFinite(line)) continue;
        const text = l.slice(second + 1);
        matches.push({ file, line, text });
    }
    return matches;
}

function collectCallSites(repoRoot: string): CallSite[] {
    const patterns: Array<{ pattern: string; type: string; notes?: string; endpoint?: string }> = [
        { pattern: 'engineClient.invoke', type: 'remote_hub_invoke', notes: 'Engine client invocation' },
        { pattern: 'EngineHubClient', type: 'remote_hub_invoke', notes: 'Engine hub client usage' },
        { pattern: '/_internal/engine/invoke', type: 'internal_endpoint_invoke', endpoint: '/_internal/engine/invoke' },
        { pattern: 'EngineInvokerHubService', type: 'invoker_service_usage' },
    ];

    const all: CallSite[] = [];

    for (const p of patterns) {
        // Search only within scan ranges
        for (const range of SCAN_RANGES) {
            const abs = path.join(repoRoot, range);
            if (!fs.existsSync(abs)) continue;

            const out = runRg(p.pattern, abs);
            const matches = parseRgOutputToMatches(out);

            for (const m of matches) {
                const fileAbs = path.join(repoRoot, m.file);
                if (!fs.existsSync(fileAbs)) continue;

                const fn = findEnclosingFunctionName(fileAbs, m.line);
                const lineRange = `${m.line}-${m.line}`;
                all.push({
                    file: m.file,
                    function: fn,
                    lineRange,
                    type: p.type,
                    engineKey: 'dynamic',
                    endpoint: p.endpoint,
                    notes: p.notes,
                });
            }
        }
    }

    // Normalize + stable sort + de-dup
    const normed = all.map((x) => ({
        ...x,
        file: norm(x.file),
        function: x.function || 'UNKNOWN',
    }));

    const uniq = uniqBy(normed, (x) => `${x.file}|${x.function}|${x.lineRange}|${x.type}|${x.endpoint || ''}`);
    return stableSort(uniq, (x) => `${x.file}|${x.function}|${x.lineRange}|${x.type}|${x.endpoint || ''}`);
}

function collectEngineSurface(repoRoot: string): EngineSurfaceItem[] {
    // Minimal closed-loop: parse engine registry hub service file for engineKey occurrences.
    const registryRel = 'apps/api/src/engine-hub/engine-registry-hub.service.ts';
    const registryAbs = path.join(repoRoot, registryRel);
    if (!fs.existsSync(registryAbs)) {
        // If file missing, output empty but deterministic.
        return [];
    }

    const txt = fs.readFileSync(registryAbs, 'utf8');
    const items: EngineSurfaceItem[] = [];

    // Robust Block-Level Parsing
    // 1. Iterate through file to find all object literals starting with '{'
    // 2. Extract balanced block
    // 3. If block contains 'engineKey', parse fields STRICTLY within that block

    for (let i = 0; i < txt.length; i++) {
        if (txt[i] === '{') {
            const block = extractBalancedBlock(txt, i);
            if (block) {
                const parsed = parseEngineBlock(block, registryRel);
                if (parsed) {
                    items.push(parsed);
                }
                // Skip ahead to avoid re-parsing inside the block (though engine objects shouldn't nest engine objects)
                // Actually, just proceeding is fine, but skipping is optimization.
            }
        }
    }

    const uniqItems = uniqBy(items, (x) => `${x.engineKey}|${x.version}|${x.mode}|${x.adapterToken || ''}|${x.httpConfig?.baseUrl || ''}|${x.httpConfig?.path || ''}|${x.registeredIn}`);
    return stableSort(uniqItems, (x) => `${x.engineKey}|${x.version}|${x.mode}|${x.registeredIn}`);
}

function extractBalancedBlock(text: string, startIndex: number): string | null {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    // Safety cap
    const maxLen = 5000;

    for (let i = startIndex; i < Math.min(text.length, startIndex + maxLen); i++) {
        const c = text[i];

        if (inString) {
            if (c === stringChar && text[i - 1] !== '\\') {
                inString = false;
            }
            continue;
        }

        if (c === "'" || c === '"' || c === '`') {
            inString = true;
            stringChar = c;
            continue;
        }

        if (c === '{') {
            braceCount++;
        } else if (c === '}') {
            braceCount--;
            if (braceCount === 0) {
                return text.slice(startIndex, i + 1);
            }
        }
    }
    return null;
}

function parseEngineBlock(block: string, registryRel: string): EngineSurfaceItem | null {
    // Clean comments (// ...) to avoid false positives in commented out code
    // Simple greedy line comment removal
    const cleanBlock = block.replace(/\/\/.*$/gm, '');

    // Check for engineKey (mandatory)
    const mKey = cleanBlock.match(/engineKey\s*:\s*['"]([^'"]+)['"]/);
    if (!mKey) return null; // Not an engine descriptor block

    const engineKey = mKey[1];

    // Version
    const mVer = cleanBlock.match(/version\s*:\s*['"]([^'"]+)['"]/);
    const version = mVer ? mVer[1] : 'default';

    // Mode
    const mMode = cleanBlock.match(/mode\s*:\s*['"]([^'"]+)['"]/);
    let mode = mMode ? mMode[1] : 'unknown';
    // Validate mode against allowed values? No, SSOT should reflect reality, even if unknown.
    // If user deleted mode, we fallback to unknown which flags attention.

    // Adapter Token
    let adapterToken: string | undefined;
    const mToken = cleanBlock.match(/adapterToken\s*:\s*(['"]?)([^'",\s}]+)\1/);
    if (mToken) {
        // If it was quoted, mToken[1] is result. If unquoted (variable/class), still captured.
        // cleanBlock usage: adapterToken: NovelAnalysisLocalAdapter,
        // mToken[2] will be NovelAnalysisLocalAdapter
        // adapterToken: 'ShotRenderLocalAdapter'
        // mToken[2] will be ShotRenderLocalAdapter
        adapterToken = mToken[2];
    }

    // Http Config
    let httpConfig: EngineSurfaceItem['httpConfig'] | undefined;
    // Check if httpConfig object exists
    if (cleanBlock.includes('httpConfig:')) {
        const mBase = cleanBlock.match(/baseUrl\s*:\s*([^,\n}]+)/); // lenient match until comma/newline
        const mPath = cleanBlock.match(/path\s*:\s*['"]([^'"]+)['"]/);

        if (mBase && mPath) {
            let baseUrl = mBase[1].trim();
            // Clean quotes if present
            if ((baseUrl.startsWith("'") && baseUrl.endsWith("'")) || (baseUrl.startsWith('"') && baseUrl.endsWith('"'))) {
                baseUrl = baseUrl.slice(1, -1);
            }
            // Handle process.env fallback logic roughly:
            // process.env.FOO || 'http://...' -> we want the logical representation or a placeholder?
            // User requested: "reflect Registry content".
            // If it's code, we might want to capture the code or text.
            // For SSOT json simplicity, let's capture the raw string if it's simple, or "DYNAMIC" if complex?
            // Actually, for ce05 fix, we expect the value.
            // But JSON shouldn't contain JS code 'process.env...'.
            // Let's settle on: if it looks like process.env, store "ENV_VAR".
            // OR store the exact fallback string?
            // The requirement was: "ce05_example baseUrl 不是字面量 ${...}"
            // The user wants to see "process.env... || 'http...'"? 
            // Or does the user imply the SSOT logic *in the generator* needs to handle this?
            // The current generator previously extracted literal match.
            // If we blindly extract "process.env.X || 'Y'", that's valid string for SSOT field?
            // Yes, let's keep the raw value found in source for full transparency.

            httpConfig = {
                baseUrl: baseUrl,
                path: mPath[1]
            };
        }
    }

    return {
        engineKey,
        version,
        mode,
        adapterToken,
        httpConfig,
        registeredIn: registryRel
    };
}

function collectSecurityAuditSurface(repoRoot: string): SecurityAuditSurface {
    const hmacProtected = new Set<string>();
    const auditActions = new Set<string>();
    const metricsUsageProducers = new Set<string>();

    // HMAC protected endpoint: detect /_internal/engine/invoke usage anywhere (then list it)
    for (const range of SCAN_RANGES) {
        const abs = path.join(repoRoot, range);
        if (!fs.existsSync(abs)) continue;
        const out = runRg('/_internal/engine/invoke', abs);
        if (out.trim()) hmacProtected.add('/_internal/engine/invoke');
    }

    // Audit action: ENGINE_HUB_INVOKE
    for (const range of SCAN_RANGES) {
        const abs = path.join(repoRoot, range);
        if (!fs.existsSync(abs)) continue;
        const out = runRg('ENGINE_HUB_INVOKE', abs);
        if (out.trim()) auditActions.add('ENGINE_HUB_INVOKE');
    }

    // Metrics usage producers: search "metrics" + "usage" in same line, record enclosing function name
    for (const range of SCAN_RANGES) {
        const abs = path.join(repoRoot, range);
        if (!fs.existsSync(abs)) continue;

        const out = execSync(`rg --no-heading --line-number -S ${shellQuote('metrics')} || true`, {
            cwd: abs,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8',
            maxBuffer: 50 * 1024 * 1024,
        });

        const matches = parseRgOutputToMatches(out);
        for (const m of matches) {
            if (!m.text.includes('usage')) continue;
            const fileAbs = path.join(repoRoot, m.file);
            if (!fs.existsSync(fileAbs)) continue;
            const fn = findEnclosingFunctionName(fileAbs, m.line);
            metricsUsageProducers.add(fn);
        }
    }

    const h = stableSort(Array.from(hmacProtected), (x) => x);
    const a = stableSort(Array.from(auditActions), (x) => x);
    const mu = stableSort(Array.from(metricsUsageProducers), (x) => x);

    return { hmacProtected: h, auditActions: a, metricsUsageProducers: mu };
}

function assertNoForbiddenFieldsInJson(jsonText: string) {
    for (const f of FORBIDDEN_FIELDS) {
        if (jsonText.includes(`"${f}"`)) {
            die(`[FAIL] SSOT JSON contains forbidden field: ${f}`);
        }
    }
}

function main() {
    const repoRoot = process.cwd();

    const args = process.argv.slice(2);
    const outDirArgIdx = args.indexOf('--output-dir');
    const outputDir = outDirArgIdx >= 0 && args[outDirArgIdx + 1] ? args[outDirArgIdx + 1] : 'docs/ssot';

    const absOutDir = path.isAbsolute(outputDir) ? outputDir : path.join(repoRoot, outputDir);
    ensureDir(absOutDir);

    const callSites = collectCallSites(repoRoot);
    const engineSurface = collectEngineSurface(repoRoot);
    const securityAuditSurface = collectSecurityAuditSurface(repoRoot);

    const ssot = {
        version: '1.0',
        scanRanges: [...SCAN_RANGES],
        callSites,
        engineSurface,
        securityAuditSurface,
        technicalDebt: {
            allowlist: [...TECHNICAL_DEBT_ALLOWLIST],
            constraint: 'MUST_NOT_EXPAND',
            notes: 'Legacy adapters and billing files. Expansion is prohibited.',
        },
    };

    // Deterministic JSON (2 spaces)
    const jsonText = JSON.stringify(ssot, null, 2) + os.EOL;

    // Hard checks
    assertNoForbiddenFieldsInJson(jsonText);

    // Ensure allowlist equals hard-coded set (generator outputs exactly constant list)
    // (Any change must be done by editing constant and re-running; gate will enforce.)
    const jsonPath = path.join(absOutDir, 'engine_invocation_surface_ssot.json');
    writeFileAtomic(jsonPath, jsonText);

    // Format with prettier to match repo standards (always format for consistency)
    try {
        execSync(`pnpm -w prettier --write ${shellQuote(jsonPath)}`, {
            stdio: 'ignore',
            encoding: 'utf8',
        });
    } catch (e) {
        // Prettier formatting is optional; if it fails, continue with unformatted JSON
        // eslint-disable-next-line no-console
        console.warn('[WARN] Prettier formatting failed, continuing with unformatted JSON');
    }

    // Deterministic Markdown (no timestamps/statistics)
    const md = [
        '# Engine Invocation Surface SSOT',
        '',
        '本文件为 CE-ARCH-GUARD-02 的审计可读 SSOT 说明（确定性输出）。',
        '',
        '## 规则',
        '- SSOT JSON 禁止包含易变字段（如 generatedAt/timestamp/statistics/duration/hostMachine 等）。',
        '- 技术债 allowlist 为硬封顶（MUST_NOT_EXPAND）。扩张视为架构退化，门禁必须失败。',
        '',
        '## 扫描范围（固定）',
        ...SCAN_RANGES.map((x) => `-${x}`),
        '',
        '## 产物',
        '- docs/ssot/engine_invocation_surface_ssot.json（机器可读，确定性）',
        '- docs/ssot/ENGINE_INVOCATION_SURFACE_SSOT.md（本文件，确定性）',
        '',
        '## 技术债 Allowlist（硬封顶）',
        ...TECHNICAL_DEBT_ALLOWLIST.map((x) => `- ${x}`),
        '',
        '## Call Sites（由 JSON 为准）',
        '请以 JSON 中 callSites 列表为单一事实源。',
        '',
        '## Engine Surface（由 JSON 为准）',
        '请以 JSON 中 engineSurface 列表为单一事实源。',
        '',
        '## Security Audit Surface（由 JSON 为准）',
        '请以 JSON 中 securityAuditSurface 为单一事实源。',
        '',
    ].join(os.EOL);

    const mdPath = path.join(absOutDir, 'ENGINE_INVOCATION_SURFACE_SSOT.md');
    writeFileAtomic(mdPath, md + os.EOL);

    // eslint-disable-next-line no-console
    console.log(`[OK] SSOT generated: ${norm(path.relative(repoRoot, jsonPath))}`);
    // eslint-disable-next-line no-console
    console.log(`[OK] SSOT doc generated: ${norm(path.relative(repoRoot, mdPath))}`);
}

main();
