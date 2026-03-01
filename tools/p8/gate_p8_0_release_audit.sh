#!/usr/bin/env bash
set -euo pipefail

log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

EVI="${1:?usage: gate_p8_0_release_audit.sh <evidence_dir>}"
mkdir -p "$EVI"

[ -f VERSION ] || die "VERSION missing"
V="$(cat VERSION | tr -d '[:space:]')"
echo "VERSION=$V" > "$EVI/p8_0_release_inputs.txt"

# SemVer strict
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "VERSION not SemVer: $V"

[ -f docs/_specs/RELEASE_POLICY_SSOT.md ] || die "missing SSOT: docs/_specs/RELEASE_POLICY_SSOT.md"
[ -f "docs/releases/${V}.md" ] || die "missing release note: docs/releases/${V}.md"

# Minimal content assertions (no empty sections)
grep -q '^## Summary' "docs/releases/${V}.md" || die "release note missing Summary section"
grep -q '^## Impact Analysis' "docs/releases/${V}.md" || die "release note missing Impact Analysis section"
grep -q '^## Rollback Plan' "docs/releases/${V}.md" || die "release note missing Rollback Plan section"
grep -q '^## Evidence' "docs/releases/${V}.md" || die "release note missing Evidence section"

# No obvious secret patterns
if grep -RInE '(AKIA[0-9A-Z]{16}|BEGIN( RSA)? PRIVATE KEY|xox[baprs]-|api[_-]?key\s*=\s*[^ ]+)' "docs/releases/${V}.md" >/dev/null 2>&1; then
  die "secret-like pattern found in release note"
fi

cat > "$EVI/p8_0_release_audit.json" <<JSON
{
  "gate": "P8-0",
  "name": "release auditing & versioning",
  "status": "PASS",
  "version": "${V}",
  "artifacts": {
    "inputs": "p8_0_release_inputs.txt",
    "policy": "docs/_specs/RELEASE_POLICY_SSOT.md",
    "release_note": "docs/releases/${V}.md"
  },
  "timestamp": "$(date -Iseconds)"
}
JSON

log "[P8-0] PASS"
