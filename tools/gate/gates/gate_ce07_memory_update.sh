#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===

# gate_ce07_memory_update.sh <evidence_dir>

EVI="${1:-$ROOT/docs/_evidence/ce07_memory_update_$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$EVI"

# Ensure DB URL
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu"
fi

RUNNER="tools/engine/run_ce07.ts"
if [ ! -f "$RUNNER" ]; then
  echo "ERROR: Runner not found at $RUNNER"
  exit 1
fi

echo "=== Gate CE07: Memory Update (Real DB) ==="
echo "Evidence Dir: $EVI"

# Environment Snapshot
{
  echo "TIME=$(date -Iseconds)"
  echo "DATABASE_URL=***"
  node -v || true
  pnpm -v || true
} > "$EVI/env_snapshot.txt"

# Run 1
echo "Running ce07 adapter (Attempt 1)..."
# Use npx ts-node -r tsconfig-paths/register because run_ce07 uses relative imports for adapters 
# but adapter imports services which might use imports relative to apps/api or aliases?
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/run1.json" 2>&1 || { 
    echo "❌ Run 1 Failed"
    cat "$EVI/run1.json"
    exit 1 
}

# Inspect run1
if ! grep -q "PASS" "$EVI/run1.json"; then
    echo "❌ Run 1 Verification Output Missing PASS"
    cat "$EVI/run1.json"
    exit 1
fi
if ! grep -q "FOUND" "$EVI/run1.json"; then
     echo "❌ Run 1 Verification Missing FOUND resources"
     cat "$EVI/run1.json"
     exit 1
fi


# Run 2
echo "Running ce07 adapter (Attempt 2)..."
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/run2.json" 2>&1 || { 
    echo "❌ Run 2 Failed"
    cat "$EVI/run2.json"
    exit 1 
}

# Inspect run2
if ! grep -q "PASS" "$EVI/run2.json"; then
    echo "❌ Run 2 Verification Output Missing PASS"
    cat "$EVI/run2.json"
    exit 1
fi

# Generate SHA256
cd "$EVI"
if command -v sha256sum >/dev/null; then
    SHA_CMD="sha256sum"
else
    SHA_CMD="shasum -a 256"
fi
find . -type f -not -name "SHA256SUMS.txt" -print0 | xargs -0 $SHA_CMD > SHA256SUMS.txt

echo "✅ Gate PASS"
