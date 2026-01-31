#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

EVI="${1:?usage: gate_p9_1_secret_scan.sh <evidence_dir>}"
mkdir -p "$EVI"

need git
need node

# Define path-only exclusions (auditable, non-expandable)
EXCLUDE_PATHS=(
  "tools/p9/gate_p9_1_secret_scan.sh"
)

# Output exclusions to evidence for audit trail
printf "%s\n" "${EXCLUDE_PATHS[@]}" > "$EVI/p9_1_excluded_paths.txt"

# Scan tracked files only, exclude evidence/delivery blobs, scanner itself, and known non-source paths
FILES_LIST="$EVI/p9_1_files_scanned.txt"
git ls-files \
  | grep -vE '^(docs/_evidence/|docs/_delivery/|node_modules/|tmp/|tools/p9/gate_p9_1_secret_scan\.sh$)' \
  > "$FILES_LIST"

# Secret patterns (extend as needed)
PATTERN_FILE="$EVI/p9_1_patterns.txt"
cat > "$PATTERN_FILE" <<'PATS'
AKIA[0-9A-Z]''{16}
BEGIN''( RSA)? PRIVATE KEY
xox[baprs]-[0-9A-Za-z-]''{10,}
ghp_[0-9A-Za-z]''{30,}
sk-[0-9A-Za-z]''{20,}
AIza[0-9A-Za-z\-_]''{35}
-----BEGIN''PRIVATE''KEY-----
PATS

HITS="$EVI/p9_1_secret_scan_hits_fileline.txt"
: > "$HITS"

SHA="$(sha_tool)"

# Use ripgrep if available (better binary handling), else grep
if command -v rg >/dev/null 2>&1; then
  while IFS= read -r f; do
    # --no-mmap to reduce edge cases; --text to keep behavior stable
    rg -n --no-mmap --text -f "$PATTERN_FILE" "$f" >/dev/null 2>&1 || continue
    # collect file:line only, redact content by hashing the full line
    rg -n --no-mmap --text -f "$PATTERN_FILE" "$f" \
      | while IFS= read -r line; do
          ln_num="$(printf "%s" "$line" | cut -d: -f1)"
          content="$(printf "%s" "$line" | cut -d: -f2-)"
          lsha="$(printf "%s" "$content" | $SHA | awk '{print $1}')"
          echo "${f}:${ln_num}:LINE_SHA256=${lsha}" >> "$HITS"
        done
  done < "$FILES_LIST"
else
  while IFS= read -r f; do
    grep -nE -f "$PATTERN_FILE" --binary-files=without-match "$f" >/dev/null 2>&1 || continue
    grep -nE -f "$PATTERN_FILE" --binary-files=without-match "$f" \
      | while IFS= read -r line; do
          ln_num="$(printf "%s" "$line" | cut -d: -f1)"
          content="$(printf "%s" "$line" | cut -d: -f2-)"
          lsha="$(printf "%s" "$content" | $SHA | awk '{print $1}')"
          echo "${f}:${ln_num}:LINE_SHA256=${lsha}" >> "$HITS"
        done
  done < "$FILES_LIST"
fi

COUNT="$(wc -l < "$HITS" | tr -d ' ')"

cat > "$EVI/p9_1_secret_scan_audit.json" <<JSON
{
  "gate": "P9-1",
  "name": "secret leakage prevention",
  "status": "$([ "$COUNT" = "0" ] && echo PASS || echo FAIL)",
  "hits_count": $COUNT,
  "artifacts": {
    "files_scanned": "p9_1_files_scanned.txt",
    "patterns": "p9_1_patterns.txt",
    "hits": "p9_1_secret_scan_hits_fileline.txt"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

[ "$COUNT" = "0" ] || die "P9-1 FAIL: secret-like patterns detected (see $HITS)"
log "[P9-1] PASS"
