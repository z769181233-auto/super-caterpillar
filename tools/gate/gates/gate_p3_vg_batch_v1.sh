#!/usr/bin/env bash
set -euo pipefail

# gate_p3_vg_batch_v1.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_vg_batch_v1_20260201}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: VG Batch V1 (Background/Char/Lighting/Path/VFX) ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
} > "$EVI/env_snapshot.txt"

# Run All VG Runners
RUNNERS=("vg01_background_render" "vg02_character_render" "vg03_lighting_engine" "vg04_camera_path" "vg05_vfx_compositor")

for r in "${RUNNERS[@]}"; do
    echo "Running $r..." | tee -a "$EVI/gate.log"
    FILE="tools/engine/run_$r.ts"
    
    npx ts-node -r tsconfig-paths/register "$FILE" > "$EVI/runner_$r.txt" 2>&1 || {
        echo "❌ $r Failed" | tee -a "$EVI/gate.log"
        cat "$EVI/runner_$r.txt" | tee -a "$EVI/gate.log"
        exit 1
    }
    echo "✅ $r Passed" | tee -a "$EVI/gate.log"
done

# Evidence Generation
echo "Generating Evidence Index..." | tee -a "$EVI/gate.log"
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p3_vg_batch_v1.sh",
  "status": "PASS",
  "engines": ["VG01", "VG02", "VG03", "VG04", "VG05"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "------------------------------------------------"
echo "✅ VG Batch PASS" | tee -a gate.log
