
import * as fs from 'fs';
import * as path from 'path';

const ENGINES_DIR = path.join(process.cwd(), 'packages/engines');
const TEMPLATE_DIR = path.join(ENGINES_DIR, '_template');
const COST_PROFILES_DIR = path.join(process.cwd(), 'cost_profiles');
const MATRIX_FILE = path.join(process.cwd(), 'ENGINE_MATRIX_SSOT.md');

const engineName = process.argv[2];

if (!engineName) {
    console.error('❌ Please provide an engine name: npx tsx tools/engine-onboarding/init.ts <engine_name>');
    process.exit(1);
}

if (!/^[a-z0-9_]+$/.test(engineName)) {
    console.error('❌ Invalid engine name. Use only lowercase letters, numbers, and underscores.');
    process.exit(1);
}

const targetDir = path.join(ENGINES_DIR, engineName);

if (fs.existsSync(targetDir)) {
    console.error(`❌ Engine already exists at ${targetDir}`);
    process.exit(1);
}

console.log(`🚀 Initializing new engine: ${engineName}`);

// 1. Copy Template
console.log('  1. Copying template...');
fs.cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

// 2. Update package.json
console.log('  2. Configuring package.json...');
const pkgPath = path.join(targetDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.name = `@scu/engines-${engineName.replace(/_/g, '-')}`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// 3. Create Cost Profile
console.log('  3. Creating Default Cost Profile...');
const costProfilePath = path.join(COST_PROFILES_DIR, `${engineName}.json`);
const costProfile = {
    "name": engineName,
    "billing_mode": "steps",
    "unit_price_usd": 0.001,
    "description": "Default cost profile for new engine"
};
if (!fs.existsSync(costProfilePath)) {
    fs.writeFileSync(costProfilePath, JSON.stringify(costProfile, null, 2));
} else {
    console.log('     (Cost profile already exists, skipping)');
}

// 4. Update SSOT Matrix
console.log('  4. Updating ENGINE_MATRIX_SSOT.md...');
const matrixContent = fs.readFileSync(MATRIX_FILE, 'utf-8');
if (!matrixContent.includes(`| ${engineName} `)) {
    // Find the end of the table (look for the last row or just append to end of file if table handles it)
    // Assuming standard markdown table. We'll simply append to the end of the file for manual sorting, 
    // or try to find the last table line.

    // Simple strategy: Append a new line. User might need to sort it.
    const newRow = `| ${engineName} | Local | Standard | @scu/engines-${engineName.replace(/_/g, '-')} | READY |`;
    // We append it to the end of the file, assuming the table is the last thing or user checks it.
    // Better: find the last "|" line.
    const lines = matrixContent.split('\n');
    let lastTableLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('|')) {
            lastTableLineIndex = i;
            break;
        }
    }

    if (lastTableLineIndex > -1) {
        lines.splice(lastTableLineIndex + 1, 0, newRow);
        fs.writeFileSync(MATRIX_FILE, lines.join('\n'));
        console.log('     (Added to table)');
    } else {
        fs.appendFileSync(MATRIX_FILE, `\n${newRow}\n`);
        console.log('     (Appended to file)');
    }
} else {
    console.log('     (Already in matrix)');
}

console.log(`\n✅ Engine ${engineName} created successfully or checked!`);
console.log(`\nNext steps:`);
console.log(`1. Implement src/real.ts logic.`);
console.log(`2. Define types in src/types.ts.`);
console.log(`3. Run validation: npx tsx tools/engine-onboarding/validate.ts`);
