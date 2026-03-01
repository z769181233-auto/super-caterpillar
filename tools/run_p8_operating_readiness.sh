#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }

need git
need node

TS="${TS_OVERRIDE:-$(date +%Y%m%d_%H%M%S)}"
EVI="${EVI_OVERRIDE:-docs/_evidence/p8_operating_readiness_${TS}}"
mkdir -p "$EVI"

log "[P8] evidence dir: $EVI"
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "GIT_STATUS_PORCELAIN=$(git status --porcelain | wc -l | tr -d ' ')"
  echo "OS=$(uname -a)"
  echo "TIME=$(date -Iseconds)"
} > "$EVI/env_snapshot.txt"

# gates
bash tools/p8/gate_p8_0_release_audit.sh "$EVI"
bash tools/p8/gate_p8_1_monitoring_ssot.sh "$EVI"
bash tools/p8/gate_p8_2_incident_drill.sh "$EVI"
bash tools/p8/gate_p8_3_cost_cb.sh "$EVI"

# checksum tool
SHA_CMD=()
SHA_CHECK=()
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD=(sha256sum)
  SHA_CHECK=(sha256sum -c)
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD=(shasum -a 256)
  SHA_CHECK=(shasum -a 256 -c)
else
  die "Missing checksum tool: sha256sum or shasum"
fi

pushd "$EVI" >/dev/null

# build sums excluding self first
SUMS_TMP="$(mktemp SHA256SUMS.txt.tmp.XXXXXX)"
find . -maxdepth 1 -type f \
  ! -name 'SHA256SUMS.txt' \
  ! -name 'EVIDENCE_INDEX.json' \
  ! -name 'EVIDENCE_INDEX.sha256' \
  ! -name "SHA256SUMS.txt.tmp.*" \
  -print0 | sort -z | xargs -0 "${SHA_CMD[@]}" > "$SUMS_TMP"
mv "$SUMS_TMP" SHA256SUMS.txt

# build index from sums
node - <<'NODE'
const fs = require("fs");
const sums = fs.readFileSync("SHA256SUMS.txt","utf8").trim().split("\n").filter(Boolean)
  .map(line => {
    const [sha, file] = line.trim().split(/\s+/);
    return { file: file.replace(/^\.\//,""), sha256: sha };
  });

const index = {
  phase: "8",
  name: "production operating readiness",
  status: "PASS",
  evidence_dir: process.cwd(),
  generated_at: new Date().toISOString(),
  artifacts: sums
};

fs.writeFileSync("EVIDENCE_INDEX.json", JSON.stringify(index, null, 2) + "\n");
NODE

"${SHA_CMD[@]}" EVIDENCE_INDEX.json > EVIDENCE_INDEX.sha256
"${SHA_CMD[@]}" EVIDENCE_INDEX.json EVIDENCE_INDEX.sha256 >> SHA256SUMS.txt

# verify
"${SHA_CHECK[@]}" SHA256SUMS.txt
"${SHA_CHECK[@]}" EVIDENCE_INDEX.sha256

popd >/dev/null

log "[P8] PASS"
