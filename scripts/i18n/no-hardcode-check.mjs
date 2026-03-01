import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const TARGET_DIR = path.resolve(ROOT_DIR, 'apps/web/src');

// Excluded directories/files (unmigrated legacy & future phase P6/P7 zones)
const EXCLUDES = [
  'messages',
  '__tests__',
  '.snap',
  '.css',
  '/components/_legacy',
  '/app/[locale]/tasks',
  '/app/[locale]/studio',
  '/components/engines',
  '/components/project',
  '/views/',
  '/features/studio',
  '/app/[locale]/builds',
  '/app/[locale]/dev',
  '/app/[locale]/monitor',
  '/app/[locale]/solutions',
  '/app/[locale]/projects/[projectId]/import',
  '/app/[locale]/projects/[projectId]/page-old.tsx',
  '/app/[locale]/projects/[projectId]/pipeline',
  '/app/[locale]/layout.tsx',
  'dict.ts', // bypass the dictionary itself
];

// Whitelists (Allowed terms)
const ALLOWED_TERMS = [
  'Super Caterpillar Studio',
  'Super Caterpillar',
  '毛毛虫宇宙',
  '毛毛虫宇宙 Studio',
  'NEXT_LOCALE',
  'zh',
  'en',
  'vi',
];

// Regex for Chinese characters & specific English keywords
const CHINESE_REGEX = /[\u4e00-\u9fa5]/;
const ENGLISH_KEYWORDS = /\b(Login|Enter Workbench|Export|Evidence|Projects|Build)\b/i;

let hasViolation = false;

// Basic AST-less heuristics to find visible text in JSX/TSX
const SUSPICIOUS_PATTERNS = [
  />([^<]+)</g, // text nodes
  /placeholder=["']([^"']+)["']/g, // placeholder
  /title=["']([^"']+)["']/g, // title
  /['"]([^'"]*[\u4e00-\u9fa5]+[^'"]*)['"]/g, // any string literal with Chinese
];

function isWhitelisted(text) {
  return ALLOWED_TERMS.some((term) => text.includes(term));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Strip single line comments to avoid false positives in code comments
    const code = line.split('//')[0];
    if (!code.trim()) return;

    // Check suspicious patterns
    SUSPICIOUS_PATTERNS.forEach((regex) => {
      // Re-initialize regex
      const r = new RegExp(regex);
      let match;
      while ((match = r.exec(code)) !== null) {
        const text = match[1].trim();

        // Skip empty strings, brackets/variables (like {xyz}), numbers, or single letters
        if (!text || text.match(/^\{.*\}$/) || text.match(/^[\d\s\W]+$/) || text.length <= 1) {
          continue;
        }

        if (isWhitelisted(text)) {
          continue;
        }

        if (CHINESE_REGEX.test(text) || ENGLISH_KEYWORDS.test(text)) {
          console.error(
            `\x1b[31m[Hardcode Detected]\x1b[0m ${path.relative(ROOT_DIR, filePath)}:${idx + 1}`
          );
          console.error(`  Line: ${line.trim()}`);
          console.error(`  Text: "${text}"\n`);
          hasViolation = true;
        }
      }
    });
  });
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Ignore paths containing any of the excluded strings
    if (EXCLUDES.some((ex) => fullPath.includes(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && /\.(tsx|jsx|ts|js)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

console.log('🔍 Scanning for hardcoded strings (i18n check)...');
scanDirectory(TARGET_DIR);

if (hasViolation) {
  console.error('❌ CI i18n Gate Failed: Hardcoded strings detected in source files.');
  console.error('👉 Please replace them with useTranslations() or dynamic references.');
  process.exit(1);
} else {
  console.log('✅ CI i18n Gate Passed: No illegal hardcoded text found.');
  process.exit(0);
}
