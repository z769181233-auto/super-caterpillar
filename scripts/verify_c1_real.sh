#!/bin/bash
set -euo pipefail

mkdir -p docs/_evidence/p9_2b/c1
HEALTH_URL="https://api-production-4e28.up.railway.app/api/health"

echo "[Probe] Fetching health from $HEALTH_URL ..."

# Write headers and body separately (portable, no sed splitting)
curl -sS -D docs/_evidence/p9_2b/c1/health_headers.txt \
  "$HEALTH_URL" \
  -o docs/_evidence/p9_2b/c1/health_real.json

echo "[Probe] Analyzing response ..."
node -e '
const fs=require("fs");
const path="docs/_evidence/p9_2b/c1/health_real.json";
if (!fs.existsSync(path)) { console.error("Missing health_real.json"); process.exit(1); }
let j;
try { j=JSON.parse(fs.readFileSync(path,"utf8")); }
catch(e){ console.error("Invalid JSON body"); process.exit(4); }

const mode=j.mode ?? j.api_mode ?? "unknown";
const stub=j.stub ?? ((mode==="stub" || j.api_mode==="stub") ? 1 : 0);
const missing=j.missing_envs ?? j.missingEnvs ?? j.missing ?? [];
const missingLen = Array.isArray(missing) ? missing.length : 0;

const result = { mode, stub, missing_len: missingLen, status: j.status ?? null };
console.log(JSON.stringify(result, null, 2));

if (mode === "stub" || j.api_mode === "stub" || stub === 1 || stub === "1") {
  console.error("FAIL: System still in stub mode");
  process.exit(2);
}
if (missingLen > 0) {
  console.error("FAIL: Missing envs: " + missing.join(", "));
  process.exit(3);
}
console.log("SUCCESS: Real Mode Verified");
process.exit(0);
' > docs/_evidence/p9_2b/c1/health_verdict.txt

echo "OK" > docs/_evidence/p9_2b/c1/health_probe_ok.txt
echo "[Probe] Done. Verdict saved to docs/_evidence/p9_2b/c1/health_verdict.txt"
