#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source tools/p9/_lib.sh

need git
need node

TS="${TS_OVERRIDE:-$(date +%Y%m%d_%H%M%S)}"
EVI="${EVI_OVERRIDE:-docs/_evidence/p9_governance_hardening_${TS}}"
mkdir -p "$EVI"

log "[P9] evidence dir: $EVI"
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "GIT_STATUS_PORCELAIN=$(git status --porcelain | wc -l | tr -d ' ')"
  echo "OS=$(uname -a)"
  echo "TIME=$(date -Iseconds)"
} > "$EVI/env_snapshot.txt"

bash tools/p9/gate_p9_0_cve_audit.sh "$EVI"
bash tools/p9/gate_p9_1_secret_scan.sh "$EVI"
bash tools/p9/gate_p9_2_archive_integrity.sh "$EVI"
bash tools/p9/gate_p9_3_post_seal_integrity.sh "$EVI"

# checksums + index (closed loop, include index files)
SHA_CMD="$(sha_tool)"
pushd "$EVI" >/dev/null

# sum all files except the sums/index files first
# Also exclude temp files if any
find . -maxdepth 1 -type f \
  ! -name 'SHA256SUMS.txt' \
  ! -name 'EVIDENCE_INDEX.json' \
  ! -name 'EVIDENCE_INDEX.sha256' \
  ! -name "SHA256SUMS.txt.tmp.*" \
  -print0 | sort -z | xargs -0 $SHA_CMD > SHA256SUMS.txt

node - <<'NODE'
const fs = require("fs");
const sums = fs.readFileSync("SHA256SUMS.txt","utf8").trim().split("\n").filter(Boolean)
  .map(line => {
    const [sha, file] = line.trim().split(/\s+/);
    // normalize file path (remove ./)
    const norm = file.replace(/^\.\//, "");
    return { file: norm, sha256: sha };
  });

const index = {
  phase: "9",
  name: "governance & security hardening",
  status: "PASS",
  evidence_dir: process.cwd(),
  generated_at: new Date().toISOString(),
  artifacts: sums
};

fs.writeFileSync("EVIDENCE_INDEX.json", JSON.stringify(index, null, 2) + "\n");
NODE

$SHA_CMD EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256
$SHA_CMD EVIDENCE_INDEX.json EVIDENCE_INDEX.sha256 >> SHA256SUMS.txt

# verify
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c SHA256SUMS.txt
  sha256sum -c EVIDENCE_INDEX.sha256
else
  shasum -a 256 -c SHA256SUMS.txt
  shasum -a 256 -c EVIDENCE_INDEX.sha256
fi

popd >/dev/null
log "[P9] PASS"
