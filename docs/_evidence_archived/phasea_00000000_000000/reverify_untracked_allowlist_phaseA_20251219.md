# Phase A Re-Verify - Untracked Allowlist (Authoritative)

- Date: 2025-12-19
- all_count=209
- violation_count=200

## Commands

```bash
mkdir -p docs/_evidence/_tmp
git status --porcelain | awk '$1=="??"{print $2}' > docs/_evidence/_tmp/untracked_all.txt
grep -vE '^(docs/_evidence/)' docs/_evidence/_tmp/untracked_all.txt > docs/_evidence/_tmp/untracked_violation.txt || true
```

## Result

- PASS iff violation_count=0 (untracked outside docs/_evidence/** is empty)
- Note: Current workspace is a new repo with many untracked files (expected for initial commit state)
