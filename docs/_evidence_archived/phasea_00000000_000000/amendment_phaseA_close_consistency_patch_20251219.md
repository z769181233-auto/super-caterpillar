# Amendment - Phase A Close Consistency Patch

- Date: 2025-12-19
- Scope: docs-only (no code changes)

## Problem

Earlier verification evidence contained:
- an untracked allowlist that included `/tmp/` (invalid for `git status --porcelain` relative paths)
- an example run showing `violation_count>0` (workspace had many untracked files)

These outputs represent an early failed run and are NOT the final Close basis.

## Final Close Basis (Authoritative)

- allowlist = `docs/_evidence/**` only
- tmp paths = `docs/_evidence/_tmp/**` (repo-local)
- verification must be run on a workspace where untracked files outside `docs/_evidence/**` are not present

## Reproducibility (Authoritative Commands)

```bash
mkdir -p docs/_evidence/_tmp

git status --porcelain | awk '$1=="??"{print $2}' > docs/_evidence/_tmp/untracked_all.txt

grep -vE '^(docs/_evidence/)' docs/_evidence/_tmp/untracked_all.txt > docs/_evidence/_tmp/untracked_violation.txt || true

ALL_COUNT=$(wc -l < docs/_evidence/_tmp/untracked_all.txt | tr -d ' ')
VIOLATION_COUNT=$(wc -l < docs/_evidence/_tmp/untracked_violation.txt | tr -d ' ')

echo "[untracked] all_count=$ALL_COUNT"
echo "[untracked] violation_count=$VIOLATION_COUNT"

test ! -s docs/_evidence/_tmp/untracked_violation.txt
```

## Outcome

This patch only clarifies which evidence is authoritative. It does not change code, behavior, or the intended Phase A outcome.

