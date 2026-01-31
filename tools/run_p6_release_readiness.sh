#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

source tools/p6/_lib.sh
need git
need shasum
need node

TS="${TS_OVERRIDE:-$(date +%Y%m%d_%H%M%S)}"
EVI="${EVI_OVERRIDE:-docs/_evidence/p6_release_readiness_${TS}}"
mkdir -p "$EVI"

log "[P6] evidence dir: $EVI"

# env snapshot (minimal, no secrets)
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "GIT_STATUS_PORCELAIN=$(git status --porcelain | wc -l | tr -d ' ')"
  echo "NODE=$(node -v)"
  echo "PNPM=$(pnpm -v 2>/dev/null || echo 'n/a')"
  echo "OS=$(uname -a)"
} > "$EVI/env_snapshot.txt"

# run gates sequentially (fail-fast)
bash tools/p6/gate_p6_0_config_secrets.sh "$EVI"
bash tools/p6/gate_p6_1_db_migration_safety.sh "$EVI"
bash tools/p6/gate_p6_2_observability_required.sh "$EVI"
bash tools/p6/gate_p6_3_rollback_drill.sh "$EVI"
bash tools/p6/gate_p6_4_cost_guardrails.sh "$EVI"

# checksums for evidence dir
find "$EVI" -maxdepth 1 -type f -print0 | sort -z | xargs -0 shasum -a 256 > "$EVI/SHA256SUMS.txt"

# evidence index json
node - <<'NODE' "$EVI"
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const sums = fs.readFileSync(path.join(dir, "SHA256SUMS.txt"), "utf8")
  .trim().split("\n").filter(Boolean)
  .map(line => {
    const [sha, file] = line.trim().split(/\s+/);
    return { file: file.replace(dir + "/", ""), sha256: sha };
  });

const index = {
  phase: "6",
  name: "release readiness",
  status: "PASS",
  evidence_dir: dir,
  generated_at: new Date().toISOString(),
  artifacts: sums,
};
fs.writeFileSync(path.join(dir, "EVIDENCE_INDEX.json"), JSON.stringify(index, null, 2) + "\n");
NODE

log "[P6] PASS: Release Readiness gates completed"
log "[P6] EVIDENCE_INDEX: $EVI/EVIDENCE_INDEX.json"

# generate independent checksum for the index itself
shasum -a 256 "$EVI/EVIDENCE_INDEX.json" > "$EVI/EVIDENCE_INDEX.sha256"
# Index checksum is safe to append to SHA256SUMS.txt (not self-referential to the index content)
cat "$EVI/EVIDENCE_INDEX.sha256" >> "$EVI/SHA256SUMS.txt"
