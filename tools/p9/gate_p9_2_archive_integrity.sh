#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p9_2_archive_integrity.sh <evidence_dir>}"
mkdir -p "$EVI"

need node
need tar
need git

SHA="$(sha_tool)"

REPORT_TXT="$EVI/p9_2_archive_report.txt"
: > "$REPORT_TXT"

# Verify evidence dirs that have EVIDENCE_INDEX.json (strict closed-loop)
ROOT_EVI="docs/_evidence"
test -d "$ROOT_EVI" || die "missing $ROOT_EVI"

STRICT_OK=0
STRICT_FAIL=0
LEGACY=0

while IFS= read -r dir; do
  # normalize
  [ -d "$dir" ] || continue
  if [ -f "$dir/EVIDENCE_INDEX.json" ]; then
    if [ ! -f "$dir/SHA256SUMS.txt" ] || [ ! -f "$dir/EVIDENCE_INDEX.sha256" ]; then
      echo "FAIL missing integrity files: $dir" >> "$REPORT_TXT"
      STRICT_FAIL=$((STRICT_FAIL+1))
      continue
    fi
    # verify sums
    pushd "$dir" >/dev/null
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c SHA256SUMS.txt >/dev/null 2>&1 || { popd >/dev/null; echo "FAIL sha256sum -c: $dir" >> "$REPORT_TXT"; STRICT_FAIL=$((STRICT_FAIL+1)) && true; continue; }
      sha256sum -c EVIDENCE_INDEX.sha256 >/dev/null 2>&1 || { popd >/dev/null; echo "FAIL index sha256: $dir" >> "$REPORT_TXT"; STRICT_FAIL=$((STRICT_FAIL+1)) && true; continue; }
    else
      shasum -a 256 -c SHA256SUMS.txt >/dev/null 2>&1 || { popd >/dev/null; echo "FAIL shasum -c: $dir" >> "$REPORT_TXT"; STRICT_FAIL=$((STRICT_FAIL+1)) && true; continue; }
      shasum -a 256 -c EVIDENCE_INDEX.sha256 >/dev/null 2>&1 || { popd >/dev/null; echo "FAIL index shasum: $dir" >> "$REPORT_TXT"; STRICT_FAIL=$((STRICT_FAIL+1)) && true; continue; }
    fi
    popd >/dev/null
    echo "OK  $dir" >> "$REPORT_TXT"
    STRICT_OK=$((STRICT_OK+1))
  else
    # legacy evidence dir (no index)
    LEGACY=$((LEGACY+1))
  fi
done < <(find "$ROOT_EVI" -maxdepth 1 -type d -name "p*" | sort)

# Mirror drill: bundle only integrity-critical files from indexed evidence dirs (small & portable)
MIRROR_DIR="$EVI/p9_2_mirror_staging"
mkdir -p "$MIRROR_DIR"

while IFS= read -r dir; do
  [ -f "$dir/EVIDENCE_INDEX.json" ] || continue
  bn="$(basename "$dir")"
  mkdir -p "$MIRROR_DIR/$bn"
  cp -f "$dir/EVIDENCE_INDEX.json" "$dir/EVIDENCE_INDEX.sha256" "$dir/SHA256SUMS.txt" "$MIRROR_DIR/$bn/"
done < <(find "$ROOT_EVI" -maxdepth 1 -type d -name "p*" | sort)

tar -czf "$EVI/p9_2_evidence_mirror_bundle.tgz" -C "$MIRROR_DIR" .
$SHA "$EVI/p9_2_evidence_mirror_bundle.tgz" > "$EVI/p9_2_evidence_mirror_bundle.sha256"

cat > "$EVI/p9_2_archive_integrity.json" <<JSON
{
  "gate": "P9-2",
  "name": "evidence archive integrity + mirror drill",
  "status": "$([ "$STRICT_FAIL" = "0" ] && echo PASS || echo FAIL)",
  "counts": {
    "indexed_evidence_ok": $STRICT_OK,
    "indexed_evidence_fail": $STRICT_FAIL,
    "legacy_evidence_dirs": $LEGACY
  },
  "artifacts": {
    "report": "p9_2_archive_report.txt",
    "mirror_bundle": "p9_2_evidence_mirror_bundle.tgz",
    "mirror_bundle_sha256": "p9_2_evidence_mirror_bundle.sha256"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

[ "$STRICT_FAIL" = "0" ] || die "P9-2 FAIL: integrity verification failed (see $REPORT_TXT)"
log "[P9-2] PASS"
