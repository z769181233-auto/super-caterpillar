#!/usr/bin/env bash
set -euo pipefail

# gate_p3_ce_batch_v2.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_ce_batch_v2_20260201}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: CE Batch V2 (Narrative/Conflict/Arc/Theme/Pacing) ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
} > "$EVI/env_snapshot.txt"

# Run All CE P3 Runners
RUNNERS=("ce01_narrative_structure" "ce05_conflict_detector" "ce08_character_arc" "ce12_theme_extractor" "ce13_pacing_analyzer")

for r in "${RUNNERS[@]}"; do
    echo "Running $r..." | tee -a "$EVI/gate.log"
    # Mapping runner file names
    FILE="tools/p3/run_$r.ts"
    if [ ! -f "$FILE" ]; then 
        # Special cases for older naming
        if [[ "$r" == "ce01_narrative_structure" ]]; then FILE="tools/p3/run_ce01_narrative_structure.ts"; fi
        if [[ "$r" == "ce05_conflict_detector" ]]; then FILE="tools/p3/run_ce05_conflict_detector.ts"; fi
    fi

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
  "gate": "gate_p3_ce_batch_v2.sh",
  "status": "PASS",
  "engines": ["CE01", "CE05", "CE08", "CE12", "CE13"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "------------------------------------------------"
echo "✅ Gate PASS" | tee -a gate.log
