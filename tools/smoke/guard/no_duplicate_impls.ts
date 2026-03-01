/**
 * Guard: 防止重复实现 (Refactored)
 * 检查关键文件是否出现重复的函数定义或关键入口锚点
 * Config: tools/smoke/guard/no_duplicate_impls.rules.json
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..', '..');

interface Rule {
  file: string;
  pattern: string;
  expected: number;
  owner: string;
  reason: string;
  fix: string;
}

function loadRules(): Rule[] {
  const configPath = join(__dirname, 'no_duplicate_impls.rules.json');
  if (!existsSync(configPath)) {
    console.error(`[GUARD] ❌ Configuration missing: ${configPath}`);
    process.exit(1);
  }
  const raw = readFileSync(configPath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[GUARD] ❌ Invalid JSON config: ${configPath}`, e);
    process.exit(1);
  }
}

function runGuard() {
  const rules = loadRules();
  const showExplain = process.argv.includes('--explain');
  let errors = 0;

  console.log(`[GUARD] Verifying ${rules.length} rules...`);

  for (const rule of rules) {
    const fullPath = join(rootDir, rule.file);

    // Check file existence
    if (!existsSync(fullPath)) {
      console.error(`[GUARD] ❌ File not found: ${rule.file}`);
      errors++;
      continue;
    }

    // Check pattern
    const content = readFileSync(fullPath, 'utf-8');
    const regex = new RegExp(rule.pattern, 'g');
    const matches = content.match(regex);
    const count = matches ? matches.length : 0;

    if (count !== rule.expected) {
      console.error(`[GUARD] ❌ Violation in ${rule.file}`);
      console.error(`   - FullPath: ${fullPath}`);
      console.error(`   - Owner: ${rule.owner}`);
      console.error(`   - Reason: ${rule.reason}`);
      console.error(`   - Count: Expected ${rule.expected}, Found ${count}`);
      console.error(`   - Pattern: ${rule.pattern}`);

      if (showExplain || count !== rule.expected) {
        console.error(`   - 🛠  FIX: ${rule.fix}`);
      }
      console.error(''); // spacer
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`[GUARD] FAILED with ${errors} violation(s).`);
    console.error(`[GUARD] Run with --explain for more details (already shown above on failure).`);
    process.exit(1);
  } else {
    console.log(`[GUARD] ✅ PASS: All ${rules.length} rules verified.`);
  }
}

runGuard();
