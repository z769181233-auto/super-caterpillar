
import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const projectId = args.find(a => a.startsWith('--projectId='))?.split('=')[1];
    const outDir = args.find(a => a.startsWith('--out='))?.split('=')[1] || './';

    if (!projectId) {
        console.error('Missing --projectId');
        process.exit(1);
    }

    console.log(`[L3 Sampler] Auditing Project: ${projectId}`);

    // 1. Get all chunks/jobs for this project
    const jobs = await prisma.shotJob.findMany({
        where: { projectId, type: 'NOVEL_CHUNK_PARSE', status: 'SUCCEEDED' },
        select: { id: true, traceId: true }
    });

    if (jobs.length === 0) {
        console.error('No successful chunks found for project');
        process.exit(1);
    }

    // 2. Sample 1% (at least 1)
    const sampleSize = Math.max(1, Math.floor(jobs.length * 0.01));
    const shuffled = jobs.sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, sampleSize);

    console.log(`[L3 Sampler] Sampling ${sampleSize} / ${jobs.length} chunks...`);

    const results: any[] = [];

    for (const sample of samples) {
        const traceId = sample.traceId;

        // Audit Asset
        const asset = await prisma.asset.findFirst({
            where: { createdByJobId: sample.id }
        });

        // Audit CostLedger
        const ledger = await prisma.costLedger.findFirst({
            where: { jobId: sample.id }
        });

        results.push({
            jobId: sample.id,
            traceId,
            asset_found: !!asset,
            asset_details: asset ? {
                storageKey: asset.storageKey,
                sha256: asset.checksum,
                type: asset.type
            } : null,
            cost_ledger_found: !!ledger,
            cost_details: ledger ? {
                costAmount: ledger.costAmount,
                orgId: ledger.orgId
            } : null
        });
    }

    const auditReport = {
        projectId,
        total_chunks: jobs.length,
        sample_size: sampleSize,
        asset_persistence_rate: results.filter(r => r.asset_found).length / sampleSize,
        cost_coverage_rate: results.filter(r => r.cost_ledger_found).length / sampleSize,
        samples: results
    };

    fs.writeFileSync(path.join(outDir, 'l3_audit_report.json'), JSON.stringify(auditReport, null, 2));

    console.log(`[L3 Sampler] Audit Complete. Persistence Rate: ${(auditReport.asset_persistence_rate * 100).toFixed(2)}%`);

    if (auditReport.asset_persistence_rate < 1.0 || auditReport.cost_coverage_rate < 1.0) {
        console.error('❌ L3 Audit Failed: Incomplete persistence or coverage.');
        process.exit(1);
    }

    console.log('✅ L3 Audit Passed.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
