#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===


# gate_p3_pp_batch_v1.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_pp_batch_v1_20260201}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: PP Batch V1 (Stitch/Subtitle/Watermark/HLS) ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
} > "$EVI/env_snapshot.txt"

# Run Batch Runner
echo "Running PP Batch Runner..." | tee -a "$EVI/gate.log"
npx ts-node -r tsconfig-paths/register tools/p3/run_pp_batch.ts > "$EVI/run_pp_batch.log" 2>&1 || {
    echo "❌ PP Batch Runner Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/run_pp_batch.log" | tee -a "$EVI/gate.log"
    exit 1
}
echo "✅ PP Batch Runner Passed" | tee -a "$EVI/gate.log"

# Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p3_pp_batch_v1.sh",
  "status": "PASS",
  "timestamp": "$(date -Iseconds)"
}
EOF

cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ PP Batch V1 SEALED"
