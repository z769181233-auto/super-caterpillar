#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SSOT_PATH = process.argv[2] || 'ENGINE_MATRIX_SSOT.md';
let s = fs.readFileSync(SSOT_PATH, 'utf8');

// Find PLANNED section
const plannedBegin = '<!-- SSOT_TABLE:PLANNED_BEGIN -->';
const plannedEnd = '<!-- SSOT_TABLE:PLANNED_END -->';

const bi = s.indexOf(plannedBegin);
const ei = s.indexOf(plannedEnd);

if (bi < 0 || ei < 0) {
    console.error('[FATAL] PLANNED markers not found');
    process.exit(1);
}

// Check if ce14 already exists
if (s.includes('ce14_narrative_climax')) {
    console.log('[OK] ce14_narrative_climax already exists in SSOT');
    process.exit(0);
}

// Extract current PLANNED block
const blockStart = s.indexOf('\n', bi) + 1;
const block = s.slice(blockStart, ei);

// Check if PLANNED table is empty (only has header)
const lines = block.trim().split('\n');
const tableLines = lines.filter(l => l.trim().startsWith('|'));

// If only header + separator, need to add ce14 row
if (tableLines.length <= 2) {
    // Create ce14 row with proper format
    const ce14Row = '| `ce14_narrative_climax` | `NOVEL_ANALYSIS` | PLAN | YES | CE14 | - | - | - | 高潮与反转识别 | `apps/api/src/engines/adapters/ce14_narrative_climax.adapter.ts` | `tools/gate/gates/gate_ce14_climax.sh` |';

    // Ensure header has expected_adapter_path and expected_gate_path columns
    let newBlock = block.trim();
    if (!newBlock.includes('expected_adapter_path')) {
        // Need to add columns to header
        const headerLine = tableLines[0];
        const sepLine = tableLines[1];
        const newHeader = headerLine.replace(' |', ' | expected_adapter_path | expected_gate_path |');
        const newSep = sepLine.replace(' |', ' | :--- | :--- |');
        newBlock = newHeader + '\n' + newSep + '\n' + ce14Row + '\n';
    } else {
        newBlock = newBlock + '\n' + ce14Row + '\n';
    }

    s = s.slice(0, blockStart) + newBlock + '\n' + s.slice(ei);

    fs.writeFileSync(SSOT_PATH, s, 'utf8');
    console.log('[OK] ce14_narrative_climax restored to PLANNED section');
} else {
    console.log('[INFO] PLANNED section not empty, check manually');
    console.log('Table lines:', tableLines.length);
}
