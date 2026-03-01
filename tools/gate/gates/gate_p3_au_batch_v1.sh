#!/usr/bin/env bash
set -euo pipefail

# gate_p3_au_batch_v1.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_au_batch_v1_20260201}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: AU Batch V1 (TTS/BGM/SFX/Mix) ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
} > "$EVI/env_snapshot.txt"

# Run Batch Runner
echo "Running AU Batch Runner..." | tee -a "$EVI/gate.log"
npx ts-node -r tsconfig-paths/register tools/p3/run_au_batch.ts > "$EVI/run_au_batch.log" 2>&1 || {
    echo "❌ AU Batch Runner Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/run_au_batch.log" | tee -a "$EVI/gate.log"
    exit 1
}
echo "✅ AU Batch Runner Passed" | tee -a "$EVI/gate.log"

# Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p3_au_batch_v1.sh",
  "status": "PASS",
  "timestamp": "$(date -Iseconds)"
}
EOF

cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ AU Batch V1 SEALED"
