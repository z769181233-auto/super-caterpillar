#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===


# gate_translation_engine.sh <evidence_dir>
EVI="${1:-$ROOT/docs/_evidence/gate_translation_engine_$(date +%Y%m%d_%H%M%S)}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/engine/run_translation.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

echo "=== Gate Translation Engine: Pluggable & No-Key Fail ===" | tee "$EVI/translation_gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..." | tee -a "$EVI/translation_gate.log"
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed" | tee -a "$EVI/translation_gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/translation_gate.log"
    exit 1
}

# Dump runner output to main log
cat "$EVI/runner_output.txt" >> "$EVI/translation_gate.log"

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
  "evidence": ["env_snapshot.txt", "translation_gate.log", "runner_output.txt"],
  "features": ["Provider Pluggable", "Cache (Hash)", "No-Key Fail"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "translation_gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

# Verify Checksums
echo "Verifying Checksums..." | tee -a translation_gate.log
$SHA -c SHA256SUMS.txt >> translation_gate.log 2>&1 || { echo "❌ Checksum Verification Failed"; exit 1; }
$SHA -c EVIDENCE_INDEX.sha256 >> translation_gate.log 2>&1 || { echo "❌ Index Verification Failed"; exit 1; }

echo "✅ Gate PASS" | tee -a translation_gate.log
