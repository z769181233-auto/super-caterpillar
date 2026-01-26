
import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const projectId = args.find(a => a.startsWith('--projectId='))?.split('=')[1];
    const outDir = args.find(a => a.startsWith('--out='))?.split('=')[1] || './';
    const seed = args.find(a => a.startsWith('--seed='))?.split('=')[1] || 'p25_final_fallback';

    if (!projectId) {
        console.error('Missing --projectId');
        process.exit(1);
    }

    console.log(`[Finalizer] Locking Snapshot for Project: ${projectId}`);

    // 1. Wait for Jobs to clear (Hard wait)
    console.log(`[Finalizer] Waiting for jobs to finish...`);
    while (true) {
        const counts = await prisma.shotJob.groupBy({
            by: ['status'],
            where: { projectId },
            _count: { _all: true }
        });
        const pending = counts.find(c => c.status === 'PENDING')?._count._all || 0;
        const running = counts.find(c => c.status === 'RUNNING')?._count._all || 0;

        if (pending === 0 && running === 0) break;
        console.log(`[Finalizer] Still processing... (Pending: ${pending}, Running: ${running})`);
        await new Promise(r => setTimeout(r, 10000));
    }

    // 2. Export job_summary_final.json
    const allJobs = await prisma.shotJob.findMany({
        where: { projectId },
        select: { id: true, status: true, type: true, createdAt: true, updatedAt: true }
    });

    const jobSummary = {
        total_jobs: allJobs.length,
        succeeded: allJobs.filter(j => j.status === 'SUCCEEDED').length,
        failed: allJobs.filter(j => j.status === 'FAILED').length,
        types: [...new Set(allJobs.map(j => j.type))],
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(outDir, 'job_summary_final.json'), JSON.stringify(jobSummary, null, 2));

    // 3. Export l1_l2_throughput_final.json
    // Calculate P50/P95/P99 for chunks
    const chunks = allJobs.filter(j => j.type === 'NOVEL_CHUNK_PARSE' && j.status === 'SUCCEEDED');
    const durations = chunks.map(j => j.updatedAt.getTime() - j.createdAt.getTime()).sort((a, b) => a - b);

    const throughput = {
        chunk_count: chunks.length,
        p50: durations[Math.floor(durations.length * 0.5)] || 0,
        p95: durations[Math.floor(durations.length * 0.95)] || 0,
        p99: durations[Math.floor(durations.length * 0.99)] || 0
    };
    fs.writeFileSync(path.join(outDir, 'l1_l2_throughput_final.json'), JSON.stringify(throughput, null, 2));

    // 4. L3 Sample Manifest (Fixed Seed)
    // Deterministic shuffle using a simple pseudo-random based on seed string
    const sampleSize = Math.max(1, Math.floor(chunks.length * 0.01));
    const seededSamples = chunks.sort((a, b) => {
        const hashA = a.updatedAt.getTime().toString() + seed;
        const hashB = b.updatedAt.getTime().toString() + seed;
        return hashA.localeCompare(hashB); // Simple deterministic sort
    }).slice(0, sampleSize);

    const l3Manifest = {
        seed,
        sample_size: sampleSize,
        samples: seededSamples.map(s => ({ jobId: (s as any).id, type: s.type }))
    };
    // Note: We need the ID for actual audit, but job object above didn't select ID. Fixing below.

    // 5. Final Audit & Coverage
    const auditResults = [];
    // Re-fetch with IDs for actual audit
    const chunkIds = await prisma.shotJob.findMany({
        where: { projectId, type: 'NOVEL_CHUNK_PARSE', status: 'SUCCEEDED' },
        select: { id: true }
    });

    // Sample from chunkIds using seed
    const sampleIds = chunkIds.sort((a, b) => (a.id + seed).localeCompare(b.id + seed)).slice(0, sampleSize);

    for (const sample of sampleIds) {
        const asset = await prisma.asset.findFirst({ where: { createdByJobId: sample.id } });
        const ledger = await prisma.costLedger.findFirst({ where: { jobId: sample.id } });
        auditResults.push({
            jobId: sample.id,
            asset_exists: !!asset,
            asset_uri: asset?.storageKey,
            ledger_exists: !!ledger
        });
    }

    const auditCoverage = {
        asset_persist_rate: auditResults.filter(r => r.asset_exists).length / sampleSize,
        costledger_coverage_rate: auditResults.filter(r => r.ledger_exists).length / sampleSize,
        failed_jobs: jobSummary.failed
    };

    fs.writeFileSync(path.join(outDir, 'l3_sample_manifest.json'), JSON.stringify({ seed, samples: auditResults }, null, 2));
    fs.writeFileSync(path.join(outDir, 'audit_coverage_final.json'), JSON.stringify(auditCoverage, null, 2));

    console.log(`[Finalizer] Snapshot Sealed. Coverage: ${auditCoverage.asset_persist_rate * 100}%`);

    if (auditCoverage.asset_persist_rate < 1.0 || auditCoverage.costledger_coverage_rate < 1.0 || jobSummary.failed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
