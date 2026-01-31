#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p6_3_rollback_drill.sh <evidence_dir>}"
mkdir -p "$EVI"

need git

TAG="sealed_p5_commercial_ready_1afd38ab6c45"

git rev-parse --verify "$TAG" >/dev/null 2>&1 || die "Required rollback tag not found: $TAG"
# Allow tmp_pgvector to be dirty as it is a submodule/build artifact
CLEAN_STATUS="$(git status --porcelain | grep -v 'tmp_pgvector' || true)"
[ -z "$CLEAN_STATUS" ] || die "Working tree not clean; commit/stash first: $CLEAN_STATUS"

CUR_SHA="$(git rev-parse HEAD)"
echo "CURRENT_SHA=$CUR_SHA" > "$EVI/p6_3_rollback_inputs.txt"
echo "ROLLBACK_TAG=$TAG" >> "$EVI/p6_3_rollback_inputs.txt"

log "[P6-3] running rollback drill: checkout tag -> run P5 gate -> return -> run P5 gate"
{
  echo "[P6-3] checkout $TAG"
  git checkout -q "$TAG"
  echo "[P6-3] run tools/run_p5_final_review.sh (tag)"
  bash tools/run_p5_final_review.sh

  echo "[P6-3] checkout $CUR_SHA"
  git checkout -q "$CUR_SHA"
  echo "[P6-3] run tools/run_p5_final_review.sh (head)"
  bash tools/run_p5_final_review.sh

  echo "[P6-3] DONE"
} 2>&1 | tee "$EVI/p6_3_rollback_drill.log"

REPORT="$EVI/p6_3_rollback_audit.json"
json_write "$REPORT" "$(node - <<'NODE'
const out = {
  gate: "P6-3",
  name: "rollback drill (to sealed P5 tag)",
  status: "PASS",
  artifacts: {
    inputs: "p6_3_rollback_inputs.txt",
    drill_log: "p6_3_rollback_drill.log",
  },
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
NODE
)"
