import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Configuration
const ROOT_DIR = process.cwd();
const OUTPUT_DIR_ARG = process.argv[2];
const OUTPUT_DIR = OUTPUT_DIR_ARG ? path.resolve(ROOT_DIR, OUTPUT_DIR_ARG) : path.join(ROOT_DIR, 'docs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ESLINT_OVERRIDE_AUDIT.md');
const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**'];
const SEARCH_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

// Risk Definition
interface RiskItem {
    file: string;
    line: number;
    type: string; // 'DISABLE' | 'ANY'
    content: string;
    riskLevel: 'HIGH' | 'MED' | 'LOW';
}

async function audit() {
    console.log('🔍 Starting ESLint Override Audit...');

    const files = await glob(SEARCH_PATTERNS, {
        cwd: ROOT_DIR,
        ignore: IGNORE_PATTERNS,
        absolute: true
    });

    const risks: RiskItem[] = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(ROOT_DIR, file);

        lines.forEach((lineContent, index) => {
            const lineNum = index + 1;

            // Check for eslint-disable
            if (lineContent.includes('eslint-disable') || lineContent.includes('eslint-disable-next-line')) {
                risks.push({
                    file: relativePath,
                    line: lineNum,
                    type: 'DISABLE',
                    content: lineContent.trim(),
                    riskLevel: 'MED'
                });
            }

            // Check for explicit 'any' usage (heuristic, simpler than AST)
            // Look for ': any' or 'as any' or '<any>'
            if (/\bany\b/.test(lineContent) && !lineContent.includes('//') && !lineContent.includes('console.log')) {
                // Simple filter to avoid false positives in strings, but not perfect without AST
                if (lineContent.includes(': any') || lineContent.includes('as any') || lineContent.includes('<any>')) {
                    risks.push({
                        file: relativePath,
                        line: lineNum,
                        type: 'ANY',
                        content: lineContent.trim(),
                        riskLevel: 'HIGH'
                    });
                }
            }
        });
    }

    generateReport(risks);
}

function generateReport(risks: RiskItem[]) {
    const highRisks = risks.filter(r => r.riskLevel === 'HIGH');
    const medRisks = risks.filter(r => r.riskLevel === 'MED');

    let md = `# ESLint Override & Technical Debt Audit\n\n`;
    md += `**Generated At:** ${new Date().toISOString()}\n`;
    md += `**Total Files Scanned:** (Dynamic)\n`; // Simplified
    md += `**Total Issues:** ${risks.length}\n`;
    md += `**High Risk (any):** ${highRisks.length}\n`;
    md += `**Med Risk (disable):** ${medRisks.length}\n\n`;

    md += `## 🚨 High Risk Items (Explicit 'any')\n\n`;
    if (highRisks.length === 0) {
        md += `✅ No explicit 'any' found (based on heuristic scan).\n\n`;
    } else {
        md += `| File | Line | Content | Strategy |\n`;
        md += `|------|------|---------|----------|\n`;
        highRisks.forEach(r => {
            md += `| \`${r.file}\` | ${r.line} | \`${escapeMd(r.content)}\` | Refactor to strict type |\n`;
        });
        md += `\n`;
    }

    md += `## ⚠️ Medium Risk Items (eslint-disable)\n\n`;
    if (medRisks.length === 0) {
        md += `✅ No eslint-disable patterns found.\n\n`;
    } else {
        md += `| File | Line | Content | Strategy |\n`;
        md += `|------|------|---------|----------|\n`;
        medRisks.forEach(r => {
            md += `| \`${r.file}\` | ${r.line} | \`${escapeMd(r.content)}\` | Remove or justify |\n`;
        });
        md += `\n`;
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        totalIssues: risks.length,
        highRiskCount: highRisks.length,
        medRiskCount: medRisks.length,
        topFiles: getTopFiles(risks)
    };

    fs.writeFileSync(OUTPUT_FILE.replace('.md', '.summary.json'), JSON.stringify(summary, null, 2));

    fs.writeFileSync(OUTPUT_FILE, md);
    console.log(`✅ Audit Report generated at: ${OUTPUT_FILE}`);
}

function getTopFiles(risks: RiskItem[]) {
    const counts: Record<string, number> = {};
    risks.forEach(r => {
        counts[r.file] = (counts[r.file] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

function escapeMd(str: string) {
    return str.replace(/\|/g, '\\|').substring(0, 100); // Truncate and escape table pipe
}

audit().catch(err => {
    console.error(err);
    process.exit(1);
});
