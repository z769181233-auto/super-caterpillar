#!/usr/bin/env bash
set -euo pipefail

# gate_p3_ce_batch.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_ce_batch_v1}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: CE Batch (Narrative + Conflict) ===" | tee "$EVI/gate.log"

RUNNER_CE01="tools/p3/run_ce01_narrative_structure.ts"
RUNNER_CE05="tools/p3/run_ce05_conflict_detector.ts"

# 1. Run CE01
echo "Running CE01 Narrative Structure..." | tee -a "$EVI/gate.log"
npx ts-node -r tsconfig-paths/register "$RUNNER_CE01" > "$EVI/runner_ce01.txt" 2>&1 || {
    echo "❌ CE01 Failed" | tee -a "$EVI/gate.log"; exit 1;
}
echo "✅ CE01 Passed" | tee -a "$EVI/gate.log"

# 2. Run CE05
echo "Running CE05 Conflict Detector..." | tee -a "$EVI/gate.log"
npx ts-node -r tsconfig-paths/register "$RUNNER_CE05" > "$EVI/runner_ce05.txt" 2>&1 || {
    echo "❌ CE05 Failed" | tee -a "$EVI/gate.log"; exit 1;
}
echo "✅ CE05 Passed" | tee -a "$EVI/gate.log"

# 3. Consolidation & Checksums
cd "$EVI"
echo "Generating Evidence Index..."
cat <<EOF > EVIDENCE_INDEX.json
{
  "gate": "gate_p3_ce_batch.sh",
  "status": "PASS",
  "engines": ["ce01_narrative_structure", "ce05_conflict_detector"],
  "evidence": ["runner_ce01.txt", "runner_ce05.txt", "gate.log"],
  "timestamp": "$(date -Iseconds)"
}
EOF

if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ Gate PASS" | tee -a gate.log
