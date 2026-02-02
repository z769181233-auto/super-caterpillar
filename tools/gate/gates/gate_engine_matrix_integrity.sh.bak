#!/bin/bash
set -e

echo "=== [GATE] Engine Matrix Integrity Verification (3-State Semantics) ==="

SSOT_FILE="ENGINE_MATRIX_SSOT.md"

if [ ! -f "$SSOT_FILE" ]; then
    echo "❌ SSOT file missing: $SSOT_FILE"
    exit 1
fi

echo "🔹 Step 1: Parsing SSOT 3-State Tables..."
SSOT_JSON=$(node tools/ssot/parse_engine_matrix_ssot.js)

SEALED_COUNT=$(echo "$SSOT_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).counts.sealed)")
INPROGRESS_COUNT=$(echo "$SSOT_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).counts.inprogress)")
PLANNED_COUNT=$(echo "$SSOT_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).counts.planned)")

echo "   SEALED: $SEALED_COUNT"
echo "   IN-PROGRESS: $INPROGRESS_COUNT"
echo "   PLANNED: $PLANNED_COUNT"

# Extract rows for detailed validation
SEALED_ROWS=$(echo "$SSOT_JSON" | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0)).rows.sealed))")
INPROGRESS_ROWS=$(echo "$SSOT_JSON" | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0)).rows.inprogress))")
PLANNED_ROWS=$(echo "$SSOT_JSON" | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0)).rows.planned))")

VIOLATIONS=0

echo "🔹 Step 2: Validating SEALED Engines..."
# SEALED must have: gate script exists, seal tag exists, adapter exists
echo "$SEALED_ROWS" | node -e "
const rows = JSON.parse(require('fs').readFileSync(0));
const fs = require('fs');
let violations = 0;
for (const row of rows) {
    const key = row.engine_key;
    const gate = row.gate_path;
    const tag = row.seal_tag;
    const adapter = row.adapter_path;
    
    // Paths are now root-relative, use directly
    if (!gate) {
        console.error('   ❌ SEALED [' + key + ']: Gate path empty');
        violations++;
    } else if (!fs.existsSync(gate)) {
        console.error('   ❌ SEALED [' + key + ']: Gate script missing: ' + gate);
        violations++;
    }
    
    // Check seal tag (simple check, real check needs git tag)
    if (!tag || tag === '-' || tag === '') {
        console.error('   ❌ SEALED [' + key + ']: Seal tag empty or invalid');
        violations++;
    }
    
    // Check adapter
    if (!adapter) {
        console.error('   ❌ SEALED [' + key + ']: Adapter path empty');
        violations++;
    } else if (!fs.existsSync(adapter)) {
        console.error('   ❌ SEALED [' + key + ']: Adapter missing: ' + adapter);
        violations++;
    }
}
process.exit(violations);
" || VIOLATIONS=$((VIOLATIONS + $?))

echo "🔹 Step 3: Validating IN-PROGRESS Engines..."
# IN-PROGRESS must have: gate script exists, adapter exists, seal tag MUST be empty or '-'
echo "$INPROGRESS_ROWS" | node -e "
const rows = JSON.parse(require('fs').readFileSync(0));
const fs = require('fs');
let violations = 0;
for (const row of rows) {
    const key = row.engine_key;
    const gate = row.gate_path;
    const tag = row.seal_tag;
    const adapter = row.adapter_path;
    
    // Check gate script (root-relative path)
    if (!gate) {
        console.error('   ❌ IN-PROGRESS [' + key + ']: Gate path empty');
        violations++;
    } else if (!fs.existsSync(gate)) {
        console.error('   ❌ IN-PROGRESS [' + key + ']: Gate script missing: ' + gate);
        violations++;
    }
    
    // Check seal tag MUST be empty
    if (tag && tag !== '-' && tag !== '') {
        console.error('   ❌ IN-PROGRESS [' + key + ']: Seal tag MUST be empty, found: ' + tag);
        violations++;
    }
    
    // Check adapter (root-relative path)
    if (!adapter) {
        console.error('   ❌ IN-PROGRESS [' + key + ']: Adapter path empty');
        violations++;
    } else if (!fs.existsSync(adapter)) {
        console.error('   ❌ IN-PROGRESS [' + key + ']: Adapter missing: ' + adapter);
        violations++;
    }
}
process.exit(violations);
" || VIOLATIONS=$((VIOLATIONS + $?))

echo "🔹 Step 4: Validating PLANNED Engines..."
# PLANNED must have: adapter MUST NOT exist, gate MUST NOT exist, seal tag MUST be empty
echo "$PLANNED_ROWS" | node -e "
const rows = JSON.parse(require('fs').readFileSync(0));
const fs = require('fs');
let violations = 0;
for (const row of rows) {
    const key = row.engine_key;
    const gate = row.gate_path;
    const tag = row.seal_tag;
    const adapter = row.adapter_path;
    
    // PLANNED adapter_path and gate_path should be empty
    if (adapter && adapter !== '' && adapter !== '-') {
        console.error('   ❌ PLANNED [' + key + ']: Adapter path MUST be empty, found: ' + adapter);
        violations++;
        // Also check if it exists
        if (fs.existsSync(adapter)) {
            console.error('   ❌ PLANNED [' + key + ']: Adapter ILLEGALLY exists: ' + adapter);
            violations++;
        }
    }
    
    // Check gate MUST NOT exist
    if (gate && gate !== '' && gate !== '-') {
        console.error('   ❌ PLANNED [' + key + ']: Gate path MUST be empty, found: ' + gate);
        violations++;
        if (fs.existsSync(gate)) {
            console.error('   ❌ PLANNED [' + key + ']: Gate script ILLEGALLY exists: ' + gate);
            violations++;
        }
    }
    
    // Check seal tag MUST be empty or '-'
    if (tag && tag !== '-' && tag !== '') {
        console.error('   ❌ PLANNED [' + key + ']: Seal tag MUST be empty or -, found: ' + tag);
        violations++;
    }
}
process.exit(violations);
" || VIOLATIONS=$((VIOLATIONS + $?))

echo "🔹 Step 5: Registry 3-State Integrity Check..."
export STORAGE_ROOT=.runtime
export NODE_ENV=test
npx ts-node -T tools/verify_registry_completeness.ts || VIOLATIONS=$((VIOLATIONS + 1))

if [ "$VIOLATIONS" -gt 0 ]; then
    echo "❌ [GATE FAILED] Total violations: $VIOLATIONS"
    exit 1
fi

echo "✅ [GATE PASS] Engine Matrix Integrity (3-State Semantics) Verified."
echo "   - SEALED: All have gate/tag/adapter"
echo "   - IN-PROGRESS: All have gate/adapter, no seal tag"
echo "   - PLANNED: None have adapter/gate/tag"
echo "   - Registry: == SEALED ∪ IN-PROGRESS, ∩ PLANNED == ∅"
