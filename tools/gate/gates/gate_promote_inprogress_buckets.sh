#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "=== [GATE] PLAN-3.4.1 Promote IN-PROGRESS -> SEALED (Bucket Batch) ==="

test -z "$(git status --porcelain)" || (echo "WORKTREE DIRTY"; git status --porcelain; exit 1)

SSOT_PATH="$(git ls-files | grep -E '(^|/)ENGINE_MATRIX_SSOT\.md$' | head -n1)"
test -n "${SSOT_PATH:-}" || (echo "ENGINE_MATRIX_SSOT.md not found"; exit 1)

TS="$(date +%Y%m%d_%H%M%S)"
EVI_DIR="docs/_evidence/p3_4_promote_inprogress_${TS}"
mkdir -p "$EVI_DIR"

echo "[1] Promote script (double-run gates + write SSOT + write evidence)..."
node tools/p3/ssot/plan34_promote_inprogress_v1.js "$SSOT_PATH" "$EVI_DIR"

echo "[2] Engine Matrix Integrity (double-run) ..."
bash tools/gate/gates/gate_engine_matrix_integrity.sh | tee "$EVI_DIR/integrity_run1.log"
bash tools/gate/gates/gate_engine_matrix_integrity.sh | tee "$EVI_DIR/integrity_run2.log"

echo "[3] Evidence checksums ..."
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$EVI_DIR" && find . -type f -maxdepth 2 | sort | xargs -I{} sha256sum "{}" > SHA256SUMS.txt)
  (cd "$EVI_DIR" && sha256sum -c SHA256SUMS.txt >/dev/null)
else
  (cd "$EVI_DIR" && find . -type f -maxdepth 2 | sort | xargs -I{} shasum -a 256 "{}" > SHA256SUMS.txt)
  (cd "$EVI_DIR" && shasum -a 256 -c SHA256SUMS.txt >/dev/null)
fi

echo "✅ [GATE PASS] Promote completed. Evidence: $EVI_DIR"
