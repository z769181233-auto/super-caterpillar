#!/usr/bin/env bash
set -euo pipefail

# gate_p2_minloop_scene_to_preview.sh <evidence_dir>
EVI="${1:-docs/_evidence/p2_minloop_scene_to_preview_$(date +%Y%m%d_%H%M%S)}"
# Ensure absolute path
EVI=$(mkdir -p "$EVI" && cd "$EVI" && pwd)

RUNNER="tools/p2/run_p2_minloop_scene_to_preview.ts"
# Root dir
cd "$(dirname "$0")/../../.."

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/scu"
fi

echo "=== Gate P2 Minloop: Char -> Scene -> Preview ===" | tee "$EVI/p2_minloop.log"

# Env Snapshot
{
  echo "TIME=$(date)"
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "NODE_VERSION=$(node -v)"
  echo "FFMPEG_VERSION=$(ffmpeg -version | head -n 1)"
  echo "REDIS_PING=$(redis-cli ping)"
} > "$EVI/env_snapshot.txt"

# Run Logic Verification
echo "Executing Runner..." | tee -a "$EVI/p2_minloop.log"
npx ts-node -r tsconfig-paths/register "$RUNNER" > "$EVI/runner_output.txt" 2>&1 || {
    echo "❌ Runner Failed" | tee -a "$EVI/p2_minloop.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/p2_minloop.log"
    exit 1
}

# Dump runner output to main log
cat "$EVI/runner_output.txt" >> "$EVI/p2_minloop.log"

# Verify Output Content
if grep -q "P2 Minloop Logic Verified" "$EVI/runner_output.txt"; then
    echo "✅ Logic Verified" | tee -a "$EVI/p2_minloop.log"
else
    echo "❌ Logic Check Failed" | tee -a "$EVI/p2_minloop.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/p2_minloop.log"
    exit 1
fi

if grep -q "FAIL:" "$EVI/runner_output.txt"; then
    echo "❌ Internal Failures Detected" | tee -a "$EVI/p2_minloop.log"
    cat "$EVI/runner_output.txt" | tee -a "$EVI/p2_minloop.log"
    exit 1
fi

# Generate Evidence Index
cat <<EOF > "$EVI/EVIDENCE_INDEX.json"
{
  "gate": "gate_p2_minloop_scene_to_preview.sh",
  "status": "PASS",
  "runner": "run_p2_minloop_scene_to_preview.ts",
  "evidence": ["env_snapshot.txt", "p2_minloop.log", "runner_output.txt"],
  "chain": ["character_gen", "scene_composition", "shot_preview"],
  "timestamp": "$(date -Iseconds)"
}
EOF

# Checksums
cd "$EVI"
if command -v sha256sum >/dev/null; then SHA=sha256sum; else SHA="shasum -a 256"; fi
find . -type f -not -name "SHA256SUMS.txt" -not -name "EVIDENCE_INDEX.sha256" -not -name "p2_minloop.log" -print0 | xargs -0 $SHA > SHA256SUMS.txt
$SHA EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256

# Verify Checksums
echo "Verifying Checksums..." | tee -a p2_minloop.log
$SHA -c SHA256SUMS.txt >> p2_minloop.log 2>&1 || { echo "❌ Checksum Verification Failed"; exit 1; }
$SHA -c EVIDENCE_INDEX.sha256 >> p2_minloop.log 2>&1 || { echo "❌ Index Verification Failed"; exit 1; }

echo "✅ Gate PASS" | tee -a p2_minloop.log
