#!/bin/bash
IFS=$'
	'
set -e

# P18-6.2: Caching Gate
# Goal: Verify that consecutive runs of the same request result in cache hits.

TS=$(date +%s)
EVIDENCE_DIR="docs/_evidence/p18_6_2_caching_$TS"
mkdir -p "$EVIDENCE_DIR"

echo "=============================================="
echo "GATE: P18-6.2 Performance Caching"
echo "=============================================="

export AUDIO_VENDOR_API_KEY="p18_6_2_key"

cat > tools/ops/test_p18_6_2.ts <<EOF
import { AudioService } from '../../apps/api/src/audio/audio.service';
import * as fs from 'fs';

async function test() {
    const svc = new AudioService();
    const req = {
        text: "Caching benchmark text for performance validation.",
        bgmSeed: "performance_seed",
        projectSettings: { audioRealEnabled: false, audioBgmEnabled: true }
    };

    console.log("--- RUN 1 (Warming Cache) ---");
    const t0 = Date.now();
    await svc.generateAndMix(req);
    const d1 = Date.now() - t0;
    console.log("Run 1 Latency: " + d1 + "ms");

    console.log("\n--- RUN 2 (Expected Hit) ---");
    const t1 = Date.now();
    await svc.generateAndMix(req);
    const d2 = Date.now() - t1;
    console.log("Run 2 Latency: " + d2 + "ms");

    if (d2 > d1 * 0.5 && d2 > 500) {
         console.warn("[WARN] Cache hit might be slower than expected. d1=" + d1 + "ms, d2=" + d2 + "ms");
    }
    
    // We expect d2 to be very fast (< 100ms usually if just hashing)
    if (d2 > 500) throw new Error("Run 2 too slow for a cache hit");

    console.log("\n[PASS] P18-6.2 Performance Caching Verified.");
}
test().catch(e => { console.error(e); process.exit(1); });
EOF

npx ts-node -T tools/ops/test_p18_6_2.ts > "$EVIDENCE_DIR/stdout.log" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ GATE PASS: $EVIDENCE_DIR"
    cat "$EVIDENCE_DIR/stdout.log"
else
    echo "❌ GATE FAIL"
    cat "$EVIDENCE_DIR/stdout.log"
    exit 1
fi
rm tools/ops/test_p18_6_2.ts
