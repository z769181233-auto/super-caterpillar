#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p9_3_post_seal_integrity.sh <evidence_dir>}"
mkdir -p "$EVI"
# Resolve to absolute path before any git checkout operations
EVI="$(cd "$EVI" && pwd)"
need git
SHA="$(sha_tool)"

# Store current branch to return later
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Collect sealed tags
git tag -l "sealed_*" | sort > "$EVI/p9_3_sealed_tags.txt"

# For each tag, checkout and verify any referenced evidence dirs that have EVIDENCE_INDEX.json
FAIL=0
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  echo "== $tag ==" >> "$EVI/p9_3_post_seal_check.log"
  git checkout -q "$tag"
  for dir in docs/_evidence/p*; do
    [ -d "$dir" ] || continue
    [ -f "$dir/EVIDENCE_INDEX.json" ] || continue
    if [ -f "$dir/SHA256SUMS.txt" ] && [ -f "$dir/EVIDENCE_INDEX.sha256" ]; then
      pushd "$dir" >/dev/null
      if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c SHA256SUMS.txt >> "$EVI/p9_3_post_seal_check.log" 2>&1 || FAIL=1
        sha256sum -c EVIDENCE_INDEX.sha256 >> "$EVI/p9_3_post_seal_check.log" 2>&1 || FAIL=1
      else
        shasum -a 256 -c SHA256SUMS.txt >> "$EVI/p9_3_post_seal_check.log" 2>&1 || FAIL=1
        shasum -a 256 -c EVIDENCE_INDEX.sha256 >> "$EVI/p9_3_post_seal_check.log" 2>&1 || FAIL=1
      fi
      popd >/dev/null
    fi
  done
done < "$EVI/p9_3_sealed_tags.txt"


# Return to original branch
git checkout -q "$CURRENT_BRANCH"

cat > "$EVI/p9_3_post_seal_integrity.json" <<JSON
{
  "gate": "P9-3",
  "name": "post-seal integrity (tag replay verification)",
  "status": "$( [ "$FAIL" = "0" ] && echo PASS || echo FAIL )",
  "artifacts": {
    "tags": "p9_3_sealed_tags.txt",
    "log": "p9_3_post_seal_check.log"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

[ "$FAIL" = "0" ] || die "P9-3 FAIL: some sealed tags cannot replay-verify evidence checksums"
log "[P9-3] PASS"
