
import { AudioService } from '../../apps/api/src/audio/audio.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock Metrics to capture internal state for verification
// In a real probe, this might query /api/ops/metrics via HTTP
class MockMetricsProbe {
    public metrics = {
        vendorCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        previews: 0
    };

    incrementAudioVendorCall() { this.metrics.vendorCalls++; }
    incrementAudioCacheHit() { this.metrics.cacheHits++; }
    incrementAudioCacheMiss() { this.metrics.cacheMisses++; }
    incrementAudioPreview() { this.metrics.previews++; }
}

async function probe() {
    const evidenceDir = process.env.EVIDENCE_DIR || './tmp/probe_evidence';
    fs.mkdirSync(evidenceDir, { recursive: true });

    // 1. Setup Service with Probe Instrumentation
    const metrics = new MockMetricsProbe();
    const svc = new AudioService(metrics as any);

    console.log("--- P20-0: Audio Health Probe Start ---");
    const t0 = Date.now();

    // 2. Execute Probe Action (Preview Mode)
    const res = await svc.generateAndMix({
        text: "Audio Health Probe - Production Runtime Guardrail Check",
        preview: true,
        previewCapMs: 3000,
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    });

    const latency = Date.now() - t0;
    console.log(`Probe Latency: ${latency}ms`);

    // 2.1 Copy Mixed Audio for Evidence
    if (res.mixed && res.mixed.absPath) {
        const filename = path.basename(res.mixed.absPath);
        const dest = path.join(evidenceDir, filename);
        fs.copyFileSync(res.mixed.absPath, dest);
        fs.writeFileSync(path.join(evidenceDir, 'SHA256SUMS.txt'), `${res.mixed.sha256}  ${filename}\n`);
        console.log(`Evidence saved: ${filename}`);
    }

    // 3. Verify Signals
    const signals = res.signals;
    const checks = [
        { label: "Is Preview", pass: signals.audio_preview === true },
        { label: "Cap Correct", pass: signals.preview_cap_ms === 3000 },
        { label: "Library Source", pass: !!signals.bgm_library_id_source },
        { label: "Latency < 2000ms", pass: latency < 2000 }
    ];

    // 4. Verify Metrics
    const metricChecks = [
        { label: "Metric: Preview Counted", pass: metrics.metrics.previews === 1 },
        { label: "Metric: Vendor Calls=0 (Stub)", pass: metrics.metrics.vendorCalls === 0 }
    ];

    // 5. Output Result
    const success = checks.every(c => c.pass) && metricChecks.every(c => c.pass);
    const result = {
        timestamp: new Date().toISOString(),
        latency_ms: latency,
        success,
        signals_snapshot: {
            audio_preview: signals.audio_preview,
            preview_cap_ms: signals.preview_cap_ms,
            bgm_source: signals.bgm_library_id_source
        },
        metrics_snapshot: metrics.metrics,
        checks: [...checks, ...metricChecks]
    };

    fs.writeFileSync(path.join(evidenceDir, 'probe_result.json'), JSON.stringify(result, null, 2));

    if (!success) {
        console.error("Probe Failed:", JSON.stringify(result.checks, null, 2));
        process.exit(1);
    }

    console.log("Probe Success. Metrics & Signals Verified.");
}

probe().catch(e => {
    console.error(e);
    process.exit(1);
});
