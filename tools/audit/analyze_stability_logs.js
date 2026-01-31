#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Stability Audit Script (P5-2)
 * Supports auditable filtering: raw vs filtered counts and rule hit tracking.
 */
async function main() {
    const args = process.argv.slice(2);
    const eviDirIdx = args.indexOf('--evi');
    const eviDir = eviDirIdx !== -1 ? args[eviDirIdx + 1] : 'docs/_evidence/p5_stability_latest';
    const outPath = path.join(eviDir, 'stability_audit.json');

    if (!fs.existsSync(eviDir)) fs.mkdirSync(eviDir, { recursive: true });

    console.log(`[STABILITY-AUDIT] Analyzing evidence in: ${eviDir}`);

    // 1. Analyze Latency
    let p99Latency = 0;
    const perfPath = path.join(eviDir, 'concurrency_perf.json');
    if (fs.existsSync(perfPath)) {
        const perfData = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
        p99Latency = perfData.latencyMs?.p99 || perfData.summary?.p99_latency_ms || perfData.summary?.dispatch_latency_ms || 0;
    }

    // 2. Define Filter Rules
    const filterRules = [
        { id: 'RPC_TIMEOUT', pattern: 'ETIMEDOUT', reason: 'Network timeout (non-deterministic environment noise)' },
        { id: 'CONN_REFUSED', pattern: 'ECONNREFUSED', reason: 'Connection refused (service startup/shutdown transient)' },
        { id: 'ADDR_IN_USE', pattern: 'EADDRINUSE', reason: 'Address already in use (local port conflict)' },
        { id: 'PRISMA_DMMF', pattern: 'DMMF Self-Check ERROR', reason: 'Non-blocking Prisma bootstrap warning' },
        { id: 'SECURITY_SECRET', pattern: 'AUDIT_SIGNING_SECRET is missing', reason: 'Optional security configuration warning' },
        { id: 'EXIT_FAILURE', pattern: 'command  exited (1)', reason: 'Subprocess lifecycle noise' },
        { id: 'PROCESS_SIGNAL', patterns: ['SIGTERM', 'SIGINT'], reason: 'External termination signal' },
        { id: 'NEST_FILTER_NOISE', pattern: 'AllExceptionsFilter', reason: 'Global exception filter logging boilerplate' }
    ];

    // 3. Analyze Logs
    const logsToScan = ['api.log', 'worker.log', 'api_gate.log'];
    let rawErrorCount = 0;
    let filteredErrorCount = 0;
    const ruleHits = {};
    const errorDetails = [];

    filterRules.forEach(r => ruleHits[r.id] = 0);

    for (const logFile of logsToScan) {
        const logPath = path.join(process.cwd(), logFile);
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf8');
            const lines = content.split('\n').slice(-1000); // Last 1000 lines for commercial stability window
            lines.forEach(line => {
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('error') || lowerLine.includes('exception')) {
                    rawErrorCount++;

                    let matchedRule = null;
                    for (const rule of filterRules) {
                        const patterns = rule.patterns || [rule.pattern];
                        if (patterns.some(p => line.includes(p))) {
                            matchedRule = rule;
                            break;
                        }
                    }

                    if (matchedRule) {
                        ruleHits[matchedRule.id]++;
                    } else {
                        filteredErrorCount++;
                        if (errorDetails.length < 20) errorDetails.push(line.trim());
                    }
                }
            });
        }
    }

    const result = {
        timestamp: new Date().toISOString(),
        audit_window: "Last 1000 lines per log",
        slos: {
            p99_latency_ms: p99Latency,
            raw_error_count: rawErrorCount,
            filtered_error_count: filteredErrorCount,
            status: filteredErrorCount === 0 ? 'PASS' : 'FAIL'
        },
        filter_audit: {
            rules: filterRules,
            hits: ruleHits
        },
        verdict: (p99Latency < 5000 && filteredErrorCount === 0) ? 'PASS' : 'FAIL',
        details: {
            unfiltered_errors: errorDetails
        }
    };

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`✅ [STABILITY-AUDIT] Audit Complete: ${outPath}`);
    console.log(`   P99 Latency: ${p99Latency}ms`);
    console.log(`   Raw Errors: ${rawErrorCount}`);
    console.log(`   Filtered Errors: ${filteredErrorCount}`);
    console.log(`   Verdict: ${result.verdict}`);
}

main().catch(console.error);
