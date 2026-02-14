#!/usr/bin/env node
/**
 * Patch gate scripts to ensure repo-root semantics:
 * - ROOT := git rev-parse --show-toplevel
 * - cd "$ROOT"
 * - source tools/gate/lib/gate_bootstrap.sh
 * Also neutralize legacy ROOT=... based on BASH_SOURCE/dirname that miscomputes under tools/gate/gates.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LIST = process.argv[2];
if (!LIST) {
  console.error('Usage: node tools/p3/gates/patch_gate_root_v1.js <unique_gates.txt>');
  process.exit(1);
}

function patchOne(p) {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  if (!fs.existsSync(abs)) throw new Error(`MISSING: ${p}`);

  const orig = fs.readFileSync(abs, 'utf8').split('\n');

  // Find shebang
  let idxShebang = orig[0].startsWith('#!') ? 0 : -1;

  // Skip if already patched
  if (orig.join('\n').includes('tools/gate/lib/gate_bootstrap.sh')) {
    return { p, changed: false, reason: 'already_patched' };
  }

  // Neutralize legacy ROOT lines that use BASH_SOURCE/dirname
  const lines = orig.map((ln) => {
    if (/^\s*ROOT\s*=/.test(ln) && /(BASH_SOURCE|dirname|\.\.\/\.\.)/.test(ln)) {
      return `# [PATCHED_OLD_ROOT] ${ln}`;
    }
    return ln;
  });

  // Insert bootstrap right after first "set -euo pipefail" if present; else after shebang
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('set -euo pipefail')) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === 0) insertAt = idxShebang === 0 ? 1 : 0;

  const inject = [
    '',
    '# === PATCH: enforce repo-root gate semantics ===',
    'ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"',
    'if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi',
    'cd "$ROOT"',
    'source "$ROOT/tools/gate/lib/gate_bootstrap.sh"',
    '# === END PATCH ===',
    '',
  ];

  const out = [...lines.slice(0, insertAt), ...inject, ...lines.slice(insertAt)];
  fs.writeFileSync(abs, out.join('\n'), 'utf8');
  return { p, changed: true, reason: 'patched' };
}

const gates = fs
  .readFileSync(LIST, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
const results = [];
for (const gp of gates) {
  try {
    results.push(patchOne(gp));
  } catch (e) {
    results.push({ p: gp, changed: false, reason: 'error', error: e.message });
  }
}

const outPath = path.join(ROOT, 'docs/_evidence/p3_4_2_patch_gate_root_results.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log('[OK] patched gates:', results.filter((r) => r.changed).length, '/', results.length);
console.log('Results saved to:', outPath);
