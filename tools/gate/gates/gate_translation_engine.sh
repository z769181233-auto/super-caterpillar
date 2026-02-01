#!/usr/bin/env bash
set -euo pipefail

# gate_translation_engine.sh <evidence_dir>
EVI="${1:?usage: gate.sh <evidence_dir>}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/engine/run_translation.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

echo "=== Gate Translation Engine: Pluggable & No-Key Fail ===" | tee "$EVI/gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..."
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed"
    cat "$EVI/runner_output.txt"
    exit 1
}

# Verify Output Content
if grep -q "Translation Logic Verified" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified"
else
    echo "❌ Logic Check Failed"
    cat "$EVI/runner_output.txt"
    exit 1
fi

if grep -q "FAIL:" "$EVI/runner_output.txt"; then
    echo "❌ Internal Failures Detected"
    cat "$EVI/runner_output.txt"
    exit 1
fi

# Generate Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_translation_engine.sh",
  "status": "PASS",
  "runner": "run_translation.ts",
  "features": ["Provider Pluggable", "Cache (Hash)", "No-Key Fail"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ Gate PASS"
