import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * P1 Audit: Storage Key Pollution Scanner (SEALED VERSION)
 * 扫描 assets 表，识别并统计绝对路径污染（技术债）
 * 注意：为防止路径二次泄露，细节报表仅记录 SHA-256 指纹。
 */

function hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

async function main() {
    const prisma = new PrismaClient();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const evidDir = path.resolve(process.cwd(), `docs/_evidence/audit_storage_keys_${ts}`);

    if (!fs.existsSync(evidDir)) {
        fs.mkdirSync(evidDir, { recursive: true });
    }

    console.log(`[Audit] Scanning assets for storageKey pollution (Fingerprint Mode)...`);

    const allAssets = await prisma.asset.findMany({
        select: {
            id: true,
            storageKey: true,
            projectId: true,
            type: true,
            createdAt: true
        }
    });

    const total = allAssets.length;
    let pollutedCount = 0;

    const buckets: Record<string, any[]> = {
        'file_scheme': [], // file://
        'users_dir': [],   // /Users/ or /home/
        'win_drive': [],   // C:\
        'root_slash': [],  // 以 / 开头但不是 users_dir
        'other_abs': []    // 其它绝对路径判定
    };

    for (const asset of allAssets) {
        const key = asset.storageKey || '';
        let polluted = false;

        const info = {
            id: asset.id,
            projectId: asset.projectId,
            type: asset.type,
            createdAt: asset.createdAt,
            keyFingerprint: hashKey(key)
        };

        if (key.startsWith('file://')) {
            buckets.file_scheme.push(info);
            polluted = true;
        } else if (key.includes('/Users/') || key.includes('/home/')) {
            buckets.users_dir.push(info);
            polluted = true;
        } else if (/^[A-Za-z]:\\/.test(key)) {
            buckets.win_drive.push(info);
            polluted = true;
        } else if (key.startsWith('/')) {
            buckets.root_slash.push(info);
            polluted = true;
        } else if (path.isAbsolute(key)) {
            buckets.other_abs.push(info);
            polluted = true;
        }

        if (polluted) {
            pollutedCount++;
        }
    }

    const report = {
        summary: {
            scanTimestamp: new Date().toISOString(),
            totalAssets: total,
            pollutedAssets: pollutedCount,
            pollutionRate: total > 0 ? (pollutedCount / total * 100).toFixed(2) + '%' : '0%',
            buckets: {
                file_scheme: buckets.file_scheme.length,
                users_dir: buckets.users_dir.length,
                win_drive: buckets.win_drive.length,
                root_slash: buckets.root_slash.length,
                other_abs: buckets.other_abs.length
            }
        },
        fingerprints: buckets
    };

    // 1. Output JSON
    const jsonPath = path.join(evidDir, 'fingerprint_report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // 2. Output Text Report
    const txtPath = path.join(evidDir, 'report.txt');
    const lines = [
        `STORAGE KEY POLLUTION AUDIT REPORT (FINGERPRINTED)`,
        `==================================================`,
        `Timestamp: ${report.summary.scanTimestamp}`,
        `Total Assets: ${report.summary.totalAssets}`,
        `Polluted Assets: ${report.summary.pollutedAssets}`,
        `Pollution Rate: ${report.summary.pollutionRate}`,
        ``,
        `BUCKET STATISTICS:`,
        `- file:// scheme:  ${report.summary.buckets.file_scheme}`,
        `- /Users/ or /home/: ${report.summary.buckets.users_dir}`,
        `- Windows Drive:     ${report.summary.buckets.win_drive}`,
        `- Root Slash (/):    ${report.summary.buckets.root_slash}`,
        `- Other Absolute:    ${report.summary.buckets.other_abs}`,
        ``,
        `DETAILED FINGERPRINTS (Top 10 Polluted):`,
    ];

    const allPolluted = Object.values(buckets).flat();
    allPolluted.slice(0, 10).forEach(a => {
        lines.push(`- [${a.type}] project=${a.projectId} id=${a.id} sha256=${a.keyFingerprint}`);
    });

    if (allPolluted.length > 10) {
        lines.push(`... and ${allPolluted.length - 10} more. See fingerprint_report.json for full list.`);
    }

    fs.writeFileSync(txtPath, lines.join('\n'));

    console.log(`[Audit] Report generated in: ${evidDir}`);
    console.log(`[Audit] Polluted: ${pollutedCount} / ${total}`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
