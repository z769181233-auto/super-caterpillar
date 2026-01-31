#!/usr/bin/env bash
set -euo pipefail

# HARD SECURITY RULE: No Debug Secrets
export CONFIG_DEBUG=0
unset ALLOW_MOCK_PREVIEW
unset SHOT_RENDER_MOCK_URL

# gate_shot_preview_fast.sh <evidence_dir>
EVI="${1:?usage: gate.sh <evidence_dir>}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/engine/run_preview.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

echo "=== Gate Shot Preview: Real File Gen & Cache ===" | tee "$EVI/gate.log"

# Env Snapshot (Filtered)
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
  echo "REDIS_CHECK=$(redis-cli ping 2>/dev/null || echo 'FAIL')"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..."
# Capturing output
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed"
    cat "$EVI/runner_output.txt"
    exit 1
}

# Verify Output Content
if grep -q "Runner Logic Verification Passed" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified"
else
    echo "❌ Logic Check Failed"
    cat "$EVI/runner_output.txt"
    exit 1
fi

if grep -q "FAIL" "$EVI/runner_output.txt"; then
    echo "❌ Internal Failures Detected"
    cat "$EVI/runner_output.txt"
    exit 1
fi

# Generate Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_shot_preview_fast.sh",
  "status": "PASS",
  "runner": "run_preview.ts",
  "mode": "REAL (File Stub + Redis)",
  "security": "CONFIG_DEBUG=0",
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -print0 | xargs -0 $SHA > SHA256SUMS.txt
# Checksum of index (as requested)
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

echo "✅ Gate PASS"
