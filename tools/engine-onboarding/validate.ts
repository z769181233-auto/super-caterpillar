import * as fs from 'fs';
import * as path from 'path';

const ENGINES_DIR = path.join(process.cwd(), 'packages/engines');
const COST_PROFILES_DIR = path.join(process.cwd(), 'cost_profiles');
const MATRIX_FILE = path.join(process.cwd(), 'ENGINE_MATRIX_SSOT.md');

function validate() {
  console.log('🔍 Starting Engine Onboarding Validation...');

  if (!fs.existsSync(ENGINES_DIR)) {
    console.error(`❌ Engines directory not found: ${ENGINES_DIR}`);
    process.exit(1);
  }

  const engines = fs.readdirSync(ENGINES_DIR).filter((f) => {
    return (
      fs.statSync(path.join(ENGINES_DIR, f)).isDirectory() &&
      f !== '_template' &&
      !f.startsWith('.')
    );
  });

  const matrixContent = fs.readFileSync(MATRIX_FILE, 'utf-8');
  let hasError = false;

  for (const engine of engines) {
    console.log(`\nChecking engine: ${engine}`);
    const enginePath = path.join(ENGINES_DIR, engine);

    // 1. Structure Check
    const requiredFiles = ['package.json', 'src/index.ts', 'src/types.ts', 'src/real.ts'];

    let structureOk = true;
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(enginePath, file))) {
        console.error(`  ❌ Missing file: ${file}`);
        structureOk = false;
        hasError = true;
      }
    }
    if (structureOk) console.log('  ✅ Directory Structure OK');

    // 2. SSOT Check
    // We expect the engine name to appear in the matrix table
    if (!matrixContent.includes(`| ${engine} `) && !matrixContent.includes(`|${engine}|`)) {
      // Relaxed check: just check if the string exists in a likely table row, allowing for backticks
      const regex = new RegExp(`\\|\\s*\`?${engine}\`?\\s*\\|`);
      if (!regex.test(matrixContent)) {
        console.error(`  ❌ Missing from ENGINE_MATRIX_SSOT.md`);
        hasError = true;
      } else {
        console.log('  ✅ SSOT Registration OK');
      }
    } else {
      console.log('  ✅ SSOT Registration OK');
    }

    // 3. Cost Profile Check
    const costProfilePath = path.join(COST_PROFILES_DIR, `${engine}.json`);
    if (!fs.existsSync(costProfilePath)) {
      console.error(`  ❌ Missing cost profile: cost_profiles/${engine}.json`);
      hasError = true;
    } else {
      console.log('  ✅ Cost Profile OK');
    }
  }

  if (hasError) {
    console.error('\n❌ Validation FAILED. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ All engines validated successfully!');
    process.exit(0);
  }
}

validate();
