#!/bin/bash
IFS=$'
	'
set -e

# Gate: Frame Continuity Alignment
# Verifies that the render plan has no gaps and matches total frame count.

# Default to the most recent evidence if not provided
REPORT_JSON=${1:-$(ls -dt docs/_evidence/phase_f_commissioning_* | head -1)/frame_continuity_report.json}

echo "=== Gate: Frame Continuity Started ==="
echo "Target Report: $REPORT_JSON"

if [ ! -f "$REPORT_JSON" ]; then
    echo "❌ FAIL: Continuity report not found at $REPORT_JSON"
    exit 1
fi

# Validation using Node
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('$REPORT_JSON', 'utf8'));

console.log('--- Continuity Audit ---');
console.log('Total Frames:', report.totalFrames);
console.log('Verified:', report.continuityVerified);

if (report.totalFrames !== 8640 || !report.continuityVerified) {
    console.error('❌ FAIL: Frame continuity breach! totalFrames must be 8640 and continuityVerified must be true.');
    process.exit(1);
}
"

echo "✅ SUCCESS: Frame continuity aligns with 8640 SSOT baseline."
echo "=== Gate Completed ==="
