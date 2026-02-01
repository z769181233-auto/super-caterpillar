#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

echo "=== [GATE] PLAN-3.4.1 Promote IN-PROGRESS -> SEALED (Tolerant Batch) ==="

test -z "$(git status --porcelain)" || (echo "WORKTREE DIRTY"; git status --porcelain; exit 1)

SSOT_PATH="$(git ls-files | grep -E '(^|/)ENGINE_MATRIX_SSOT\.md$' | head -n1)"
test -n "${SSOT_PATH:-}" || (echo "ENGINE_MATRIX_SSOT.md not found"; exit 1)

TS="$(date +%Y%m%d_%H%M%S)"
EVI_DIR="docs/_evidence/p3_4_promote_inprogress_${TS}"
mkdir -p "$EVI_DIR"

echo "[1] Run promoter (syntax preflight + gate double-run tolerant + SSOT migration + evidence)..."
node tools/p3/ssot/plan34_promote_inprogress_v1.js "$SSOT_PATH" "$EVI_DIR"

echo "[2] Stage changes (SSOT + evidence + scripts)..."
git add "$SSOT_PATH" "$EVI_DIR" tools/p3/ssot/plan34_promote_inprogress_v1.js tools/gate/gates/gate_promote_inprogress_buckets.sh

# If nothing changed (0 promoted), still keep evidence
if git diff --cached --quiet; then
  echo "[WARN] No changes staged. (Likely no promotable engines.)"
else
  echo "[3] Commit promotion..."
  git commit -m "p3.4.1: promote inprogress -> sealed (tolerant batch, evidence: $(basename "$EVI_DIR"))"
fi

echo "[4] Create bucket tags for promoted engines..."
if [ -f "$EVI_DIR/PROMOTION_INDEX.json" ]; then
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const tags=Object.values(j.bucket_tags||{}); for(const t of tags) console.log(t);" "$EVI_DIR/PROMOTION_INDEX.json" > "$EVI_DIR/_bucket_tags.txt" || true
  while read -r tag; do
    [ -n "${tag:-}" ] || continue
    if git rev-parse "$tag" >/dev/null 2>&1; then
      echo "TAG EXISTS: $tag (skip)"
      continue
    fi
    git tag -a "$tag" -m "p3.4.1 bucket promotion to SEALED"
  done < "$EVI_DIR/_bucket_tags.txt"
fi

echo "[5] Final integrity gate (double-run)..."
bash tools/gate/gates/gate_engine_matrix_integrity.sh | tee "$EVI_DIR/integrity_run1.log"
bash tools/gate/gates/gate_engine_matrix_integrity.sh | tee "$EVI_DIR/integrity_run2.log"

echo "[6] Evidence SHA256 (self-check)..."
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$EVI_DIR" && find . -type f | sort | xargs -I{} sha256sum "{}" > SHA256SUMS.txt)
  (cd "$EVI_DIR" && sha256sum -c SHA256SUMS.txt >/dev/null)
else
  (cd "$EVI_DIR" && find . -type f | sort | xargs -I{} shasum -a 256 "{}" > SHA256SUMS.txt)
  (cd "$EVI_DIR" && shasum -a 256 -c SHA256SUMS.txt >/dev/null)
fi

echo "✅ [GATE PASS] Promotion finished. Evidence: $EVI_DIR"
echo "   - Failed gates list: $EVI_DIR/FAILED_GATES.json"
echo "   - Skipped engines list: $EVI_DIR/SKIPPED_ENGINES.json"
