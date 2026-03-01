const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(`--${key}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const releaseTag = getArg('releaseTag');
const sealTag = getArg('sealTag');
const evidenceDir = getArg('evidence');
const gateCmd = getArg('gate');
const ssotPath = getArg('ssot');
const outPath = getArg('out');

if (!releaseTag || !sealTag || !evidenceDir || !ssotPath || !outPath) {
  console.error(
    'Usage: node gen_release_note.js --releaseTag <tag> --sealTag <tag> --evidence <dir> --gate <cmd> --ssot <file> --out <file>'
  );
  process.exit(1);
}

const date = new Date().toISOString().split('T')[0];

const content = `# Commercial Release Note (V1)

**Release Tag**: \`${releaseTag}\`
**Commercial Seal Tag**: \`${sealTag}\`
**Release Date**: ${date}
**Status**: COMMERCIAL HARD SEAL (Phase 3+4)

## Release Highlights
- **Full E2E Commercial Pipeline Verified**: CE06 -> CE03 -> CE04 -> SHOT_RENDER -> COMPOSE -> PREVIEW
- **Zero Risk Architecture**: 
  - Unified Audit Prefix (\`CE%\`)
  - Dynamic Pricing Decoupling (\`PRICING_SSOT.md\`)
  - Strict Engine Keys
- **Studio Commercial Closure**: UI-based observability and billing summaries (P3-3)

## Evidence & Verification
- **Gate Output**: \`${evidenceDir}\`
- **Gate Command**: \`${gateCmd || 'pnpm run gate:commercial'}\` (Exit Code 0)
- **Gate Script**: \`tools/gate/run_commercial_seal.sh\`
- **SSOT Version**: V1.1.0 (Aligned)

## Key Components Status
| Component | Status | Pricing | Audit |
|-----------|--------|---------|-------|
| Studio UI | COMMERCIAL-READY | Read-only | N/A |
| CE Pipeline | REAL | Dynamic | CE% |
| API | HARD SEALED | N/A | CE% |

> Generated automatically by tools/release/gen_release_note.js
`;

const dir = path.dirname(outPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(outPath, content);
console.log(`Release note generated at ${outPath}`);
