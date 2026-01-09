import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const BASELINE_FILE = path.join(ROOT_DIR, 'docs', 'ESLINT_OVERRIDE_AUDIT.summary.json');
const TEMP_DIR = path.join(ROOT_DIR, 'tools', 'ci', 'temp_audit');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log('🔍 Running CI Audit Baseline Check...');

// 1. Run audit tool to generate current stats in temp dir
try {
  execSync(`node tools/dev/audit_eslint_overrides.ts "${path.relative(ROOT_DIR, TEMP_DIR)}"`, {
    stdio: 'inherit',
  });
} catch (error) {
  console.error('❌ Failed to run audit tool');
  process.exit(1);
}

const CURRENT_FILE = path.join(TEMP_DIR, 'ESLINT_OVERRIDE_AUDIT.summary.json');

if (!fs.existsSync(BASELINE_FILE)) {
  console.error('❌ Baseline file not found:', BASELINE_FILE);
  process.exit(1);
}

if (!fs.existsSync(CURRENT_FILE)) {
  console.error('❌ Current audit summary not found:', CURRENT_FILE);
  process.exit(1);
}

// 2. Compare
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
const current = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'));

let failed = false;

console.log('\n📊 Audit Comparison:');
console.log(`\tTotal Issues: ${baseline.totalIssues} -> ${current.totalIssues}`);
console.log(`\tHigh Risk:    ${baseline.highRiskCount} -> ${current.highRiskCount}`);

if (current.totalIssues > baseline.totalIssues) {
  console.error(
    `❌ FAILURE: Total issues increased by ${current.totalIssues - baseline.totalIssues}`
  );
  failed = true;
}

if (current.highRiskCount > baseline.highRiskCount) {
  console.error(
    `❌ FAILURE: High risk issues increased by ${current.highRiskCount - baseline.highRiskCount}`
  );
  failed = true;
}

// Optional: Top Files Check (Simple version)
// If a file is in baseline top files, its count should not increase significantly
// Skipping for now per "Optional" requirement, sticking to global counts which are more robust.

if (failed) {
  console.error(
    '\n🚨 CI Audit Baseline Failed! Please fix introduced lint errors or justification.'
  );
  process.exit(1);
} else {
  console.log('\n✅ CI Audit Baseline Passed');
  // Clean up
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  process.exit(0);
}
