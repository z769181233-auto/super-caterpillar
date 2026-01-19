# Phase A Verification Blocker - Invalid Workspace State

- Date: 2025-12-19
- Scope: docs-only

## Observed

- Re-verify reports: violation_count>0 (e.g., 200)
- Workspace described as "new repo state" with many untracked files

## Why this blocks Close

Phase A untracked allowlist rule is:

- allowlist = docs/\_evidence/\*\* only
- PASS requires violation_count == 0

If the workspace has大量 untracked outside docs/\_evidence/\*\*, the verification must FAIL by definition.

## Hard Preconditions (must be true before running Close verification)

1. Repository is a valid canonical workspace:
   - `git rev-parse --is-inside-work-tree` = true
   - `git ls-files | wc -l` > 0

2. Workspace is not "all-untracked":
   - `git status --porcelain` must not show mass `??` outside docs/\_evidence/\*\*

## Conclusion

Phase A Close is BLOCKED in this workspace.

Re-run verification in a canonical repo workspace before attempting Close.

## Canonical Workspace Gate (Executable)

```bash
bash docs/_evidence/_tools/check_canonical_workspace.sh
```
