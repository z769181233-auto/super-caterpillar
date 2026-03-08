#!/usr/bin/env bash
set -euo pipefail

# gate_p2_text_minloop.sh <evidence_dir>
EVI="${1:-docs/_evidence/p2_text_minloop_dialogue_to_memory_v1}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/p2/run_text_minloop.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu"
fi

echo "=== Gate P2 Check: Text Minloop Integration ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
  echo "REDIS_PING=$(redis-cli ping)"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..." | tee -a "$EVI/gate.log"
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/gate.log"
    exit 1
}

# Dump runner output to main log
cat "$EVI/runner_output.txt" >> "$EVI/gate.log"

# Verify Output Content
if grep -q "Text Minloop verified" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified" | tee -a "$EVI/gate.log"
else
    echo "❌ Logic Check Failed" | tee -a "$EVI/gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/gate.log"
    exit 1
fi

# Generate Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p2_text_minloop.sh",
  "status": "PASS",
  "runner": "run_text_minloop.ts",
  "evidence": ["env_snapshot.txt", "gate.log", "runner_output.txt"],
  "chain": "dialogue->emotion->memory",
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

# Verify Checksums
echo "Verifying Checksums..." | tee -a gate.log
$SHA -c SHA256SUMS.txt >> gate.log 2>&1 || { echo "❌ Checksum Verification Failed"; exit 1; }
$SHA -c EVIDENCE_INDEX.sha256 >> gate.log 2>&1 || { echo "❌ Index Verification Failed"; exit 1; }

echo "✅ Gate PASS" | tee -a gate.log
