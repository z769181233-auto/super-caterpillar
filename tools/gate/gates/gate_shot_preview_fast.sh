#!/usr/bin/env bash
set -euo pipefail
set -x
# gate_shot_preview_fast.sh <evidence_dir>

EVI="${1:?usage: gate.sh <evidence_dir>}"
# Ensure absolute path for EVI
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/engine/run_preview.ts"

# Ensure we act from root
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

echo "=== Gate Shot Preview: Fast Cache Check ==="  | tee "$EVI/gate.log"

# Env snapshot
{
  echo "TIME=$(date)"
  node -v || true
  pnpm -v || true
} > "$EVI/env_snapshot.txt"

# Run
echo "Executing Runner..."
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed"
    cat "$EVI/runner_output.txt"
    exit 1
}

# Verify output
cat "$EVI/runner_output.txt"
if grep -q "Runner Logic Verification Passed" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified"
else
    echo "❌ Logic Failed"
    exit 1
fi

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -print0 | xargs -0 $SHA > SHA256SUMS.txt

echo "✅ Gate PASS"
