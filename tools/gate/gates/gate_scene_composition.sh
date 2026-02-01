#!/usr/bin/env bash
set -euo pipefail

# === PATCH: enforce repo-root gate semantics ===
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then echo "[FATAL] cannot resolve repo root"; exit 1; fi
cd "$ROOT"
source "$ROOT/tools/gate/lib/gate_bootstrap.sh"
# === END PATCH ===


# gate_scene_composition.sh <evidence_dir>
EVI="${1:?usage: gate.sh <evidence_dir>}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/engine/run_scene_composition.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
fi

echo "=== Gate Scene Composition: FFmpeg Overlay & Layering ===" | tee "$EVI/scene_gate.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
  echo "FFMPEG_VERSION=$(ffmpeg -version | head -n 1)"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..." | tee -a "$EVI/scene_gate.log"
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed" | tee -a "$EVI/scene_gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/scene_gate.log"
    exit 1
}

# Dump runner output to main log
cat "$EVI/runner_output.txt" >> "$EVI/scene_gate.log"

# Verify Output Content
if grep -q "Scene Composition Logic Verified" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified" | tee -a "$EVI/scene_gate.log"
else
    echo "❌ Logic Check Failed" | tee -a "$EVI/scene_gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/scene_gate.log"
    exit 1
fi

if grep -q "FAIL:" "$EVI/runner_output.txt"; then
    echo "❌ Internal Failures Detected" | tee -a "$EVI/scene_gate.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/scene_gate.log"
    exit 1
fi

# Generate Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_scene_composition.sh",
  "status": "PASS",
  "runner": "run_scene_composition.ts",
  "evidence": ["env_snapshot.txt", "scene_gate.log", "runner_output.txt"],
  "features": ["FFmpeg Overlay", "Cache (Redis)"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "scene_gate.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

# Verify Checksums
echo "Verifying Checksums..." | tee -a scene_gate.log
$SHA -c SHA256SUMS.txt >> scene_gate.log 2>&1 || { echo "❌ Checksum Verification Failed"; exit 1; }
$SHA -c EVIDENCE_INDEX.sha256 >> scene_gate.log 2>&1 || { echo "❌ Index Verification Failed"; exit 1; }

echo "✅ Gate PASS" | tee -a scene_gate.log
