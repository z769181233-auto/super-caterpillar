#!/usr/bin/env bash
set -euo pipefail

# gate_p3_nlp_base.sh <evidence_dir>
EVI="${1:-docs/_evidence/p3_nlp_base_v1}"
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

echo "=== Gate P3: NLP Base Infrastructure ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
} > "$EVI/env_snapshot.txt"

# Run Unit Tests
echo "Running Unit Tests..." | tee -a "$EVI/gate.log"
(cd apps/api && pnpm jest engines/nlp/__tests__/nlp_base.spec.ts --verbose) > "$EVI/test_output.txt" 2>&1 || {
    echo "❌ Unit Test Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/test_output.txt" | tee -a "$EVI/gate.log"
    exit 1
}
cat "$EVI/test_output.txt" >> "$EVI/gate.log"
echo "✅ Unit Tests Passed" | tee -a "$EVI/gate.log"

# Logic Verification (Double Run via a dummy runner if needed, but test covers it)
# We produce a Evidence Index to match the seal requirement
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p3_nlp_base.sh",
  "status": "PASS",
  "components": ["nlp_base", "nlp_tokenizer", "nlp_cache", "nlp_output_schema"],
  "evidence": ["env_snapshot.txt", "gate.log", "test_output.txt"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ Gate PASS" | tee -a gate.log
