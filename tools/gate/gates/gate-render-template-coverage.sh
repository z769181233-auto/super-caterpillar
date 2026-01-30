#!/bin/bash
set -e

# Gate: Render Template Coverage (Phase G)
# Enforces 100% template hit rate and 0 stubs for production readiness.
# Usage: ./gate-render-template-coverage.sh <resolve_report.json>

REPORT_JSON=${1:-"docs/_evidence/phase_f_commissioning_20260127_224500/resolve_report.json"}

echo "=== Gate: Render Template Coverage Started ==="
echo "Target Report: $REPORT_JSON"

if [ ! -f "$REPORT_JSON" ]; then
    echo "❌ FAIL: Resolve report not found at $REPORT_JSON"
    exit 1
fi

node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('$REPORT_JSON', 'utf8'));

console.log('--- Coverage Audit ---');
console.log('Template Hit Rate:', (report.templateHitRate * 100).toFixed(1) + '%');
console.log('Stub Count:', report.passed ? 0 : 'N/A'); // resolving 'passed' derived from stubCount=0

if (report.templateHitRate !== 1.0) {
    console.error('❌ FAIL: Template Hit Rate must be 100%. Current:', report.templateHitRate);
    process.exit(1);
}

// In resolve_report.json, 'passed' implies stubCount === 0.
// But valid reports might check stubCount explicitly if available.
// If resolve_report doesn't explicit stubCount, check 'passed' field.
if (!report.passed) {
     console.error('❌ FAIL: Render Plan Resolve Failed (Stub detected or Continuity Error).');
     process.exit(1);
}
"

echo "✅ SUCCESS: 100% Template Coverage Verified."
echo "=== Gate Completed ==="
