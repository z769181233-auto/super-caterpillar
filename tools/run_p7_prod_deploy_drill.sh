#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source tools/p7/_lib.sh

need git
need node

TS="${TS_OVERRIDE:-$(date +%Y%m%d_%H%M%S)}"
EVI="${EVI_OVERRIDE:-docs/_evidence/p7_prod_deploy_drill_${TS}}"
mkdir -p "$EVI"

log "[P7] evidence dir: $EVI"
{
  echo "GIT_SHA=$(git rev-parse HEAD)"
  echo "BASE_ROLLBACK_TAG=sealed_p5_commercial_ready_1afd38ab6c45"
  echo "TIME=$(date -Iseconds)"
} > "$EVI/env_snapshot.txt"

# Adapter contract (must exist in repo for P7 to PASS)
for f in \
  tools/deploy/p7_deploy_blue.sh \
  tools/deploy/p7_deploy_green.sh \
  tools/deploy/p7_cutover_to_green.sh \
  tools/deploy/p7_rollback_to_blue.sh \
  tools/deploy/p7_healthcheck.sh
do
  [ -f "$f" ] || die "Missing deploy adapter: $f"
  chmod +x "$f" || true
done

log "[P7-1] deploy BLUE"
bash tools/deploy/p7_deploy_blue.sh 2>&1 | tee "$EVI/p7_1_deploy_blue.log"
bash tools/deploy/p7_healthcheck.sh blue 2>&1 | tee "$EVI/p7_1_health_blue.log"

log "[P7-2] deploy GREEN"
bash tools/deploy/p7_deploy_green.sh 2>&1 | tee "$EVI/p7_2_deploy_green.log"
bash tools/deploy/p7_healthcheck.sh green 2>&1 | tee "$EVI/p7_2_health_green.log"

log "[P7-3] CUTOVER -> GREEN"
bash tools/deploy/p7_cutover_to_green.sh 2>&1 | tee "$EVI/p7_3_cutover.log"
bash tools/deploy/p7_healthcheck.sh live 2>&1 | tee "$EVI/p7_3_health_live.log"

log "[P7-4] ROLLBACK -> BLUE"
bash tools/deploy/p7_rollback_to_blue.sh 2>&1 | tee "$EVI/p7_4_rollback.log"
bash tools/deploy/p7_healthcheck.sh live 2>&1 | tee "$EVI/p7_4_health_live.log"

# --- P7 evidence sealing: index + checksums (must include index files) ---

SHA_CMD=""
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD="shasum -a 256"
else
  die "Missing checksum tool: sha256sum or shasum"
fi

# generate evidence index json
node - <<'NODE' "$EVI"
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];

// Collect all top-level evidence files (we will checksum them next)
const files = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());

const index = {
  phase: "7",
  name: "prod deployment drill",
  status: "PASS",
  evidence_dir: dir,
  generated_at: new Date().toISOString(),
  artifacts: files.sort().map(f => ({ file: f, sha256: "<filled_by_SHA256SUMS>" })),
};

fs.writeFileSync(path.join(dir, "EVIDENCE_INDEX.json"), JSON.stringify(index, null, 2) + "\n");
NODE

# independent checksum for the index itself
$SHA_CMD "$EVI/EVIDENCE_INDEX.json" > "$EVI/EVIDENCE_INDEX.sha256"

# checksums for evidence dir (now includes EVIDENCE_INDEX.json + EVIDENCE_INDEX.sha256)
find "$EVI" -maxdepth 1 -type f -print0 | sort -z | xargs -0 $SHA_CMD > "$EVI/SHA256SUMS.txt"

# verify (fail if mismatch)
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c "$EVI/SHA256SUMS.txt"
  sha256sum -c "$EVI/EVIDENCE_INDEX.sha256"
else
  shasum -a 256 -c "$EVI/SHA256SUMS.txt"
  shasum -a 256 -c "$EVI/EVIDENCE_INDEX.sha256"
fi

log "[P7] PASS: production deployment drill completed"
