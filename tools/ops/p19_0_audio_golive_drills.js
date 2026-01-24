
const { AudioService } = require('../../apps/api/src/audio/audio.service');
const fs = require('fs');
const path = require('path');

async function runDrills(outPath) {
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
    const svc = new AudioService();
    const results = [];
    const accessLog = [];

    // Mock vendor logging
    const originalSynthesize = svc.realProvider.synthesize.bind(svc.realProvider);
    svc.realProvider.synthesize = async (input) => {
        accessLog.push(`REAL_CALL: ${input.text.slice(0, 20)}`);
        return originalSynthesize(input);
    };

    const commonReq = {
        text: "P19-0 Drill Voice Track: Standardizing production audits and cache safety for the audio engine go-live milestone.",
        bgmSeed: "p19_drill_seed",
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    };

    console.log("--- Case K1: Kill Switch ON ---");
    process.env.AUDIO_REAL_FORCE_DISABLE = '1';
    const rK1 = await svc.generateAndMix({ ...commonReq, projectSettings: { audioRealEnabled: true, audioBgmEnabled: true } });
    results.push({ id: 'K1', signals: rK1.signals });

    console.log("--- Case W1: Whitelist OFF ---");
    process.env.AUDIO_REAL_FORCE_DISABLE = '0';
    const rW1 = await svc.generateAndMix({ ...commonReq, projectSettings: { audioRealEnabled: false, audioBgmEnabled: true } });
    results.push({ id: 'W1', signals: rW1.signals });

    console.log("--- Case W2: Whitelist ON ---");
    const rW2 = await svc.generateAndMix({ ...commonReq, projectSettings: { audioRealEnabled: true, audioBgmEnabled: true } });
    results.push({ id: 'W2', signals: rW2.signals });

    console.log("--- Case C1: Cache Safety ---");
    const rC1a = await svc.generateAndMix({ ...commonReq, preview: false });
    const rC1b = await svc.generateAndMix({ ...commonReq, preview: true, previewCapMs: 3000 });
    const rC1c = await svc.generateAndMix({ ...commonReq, preview: false, projectSettings: { ...commonReq.projectSettings, audioBgmLibraryId: 'bgm_lib_v2_com' } });
    results.push({ id: 'C1a', sha: rC1a.mixed.sha256 });
    results.push({ id: 'C1b', sha: rC1b.mixed.sha256 });
    results.push({ id: 'C1c', sha: rC1c.mixed.sha256 });

    console.log("--- Case P1: Preview Auditing ---");
    const rP1 = await svc.generateAndMix({ ...commonReq, preview: true, previewCapMs: 3000 });
    results.push({ id: 'P1', signals: rP1.signals });

    // Save logs and results
    fs.writeFileSync(path.join(outPath, 'results_raw.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(outPath, 'mock_vendor_access.log'), accessLog.join('\n'));

    // Sanitized version for comparison
    const sanitized = results.map(r => {
        const s = JSON.stringify(r);
        return JSON.parse(s, (key, value) => {
            if (['audio_vendor_latency_ms', 'latency', 'absPath', 'vendorRequestId', 'vendorLatencyMs'].includes(key)) return undefined;
            return value;
        });
    });
    fs.writeFileSync(path.join(outPath, 'results_sanitized.json'), JSON.stringify(sanitized, null, 2));

    // SHA256SUMS for audio files in results
    const shas = [];
    [rK1, rW1, rW2, rC1a, rC1b, rC1c, rP1].forEach(r => {
        if (r.mixed) {
            const filename = path.basename(r.mixed.absPath);
            fs.copyFileSync(r.mixed.absPath, path.join(outPath, filename));
            shas.push(`${r.mixed.sha256}  ${filename}`);
        }
    });
    fs.writeFileSync(path.join(outPath, 'SHA256SUMS.txt'), shas.join('\n'));
}

const args = process.argv.slice(2);
const out = args[args.indexOf('--out') + 1] || './tmp/drill_results';
runDrills(out).catch(console.error);
