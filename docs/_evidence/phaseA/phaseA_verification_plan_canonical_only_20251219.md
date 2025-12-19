# Phase A Verification Plan (Canonical Workspace Only)

- Date: 2025-12-19
- Prereq: PASS canonical workspace gate
  - bash docs/_evidence/_tools/check_canonical_workspace.sh

## Run

```bash
# 0) canonical workspace gate
bash docs/_evidence/_tools/check_canonical_workspace.sh

# 1) untracked allowlist (authoritative)
mkdir -p docs/_evidence/_tmp
git status --porcelain | awk '$1=="??"{print $2}' > docs/_evidence/_tmp/untracked_all.txt
grep -vE '^(docs/_evidence/)' docs/_evidence/_tmp/untracked_all.txt > docs/_evidence/_tmp/untracked_violation.txt || true
test ! -s docs/_evidence/_tmp/untracked_violation.txt

# 2) doc link spot checks (Phase A scope)
test -f docs/DEPRECATION_CLEANUP_PLAN.md
test -f docs/DEPRECATION_INDEX.md
test -f docs/DB_DEPRECATION_REMOVAL_RFC.md
test -f docs/LAUNCH_STANDARD_V1.1.md
test -f docs/FULL_LAUNCH_GAP_REPORT.md
test -f docs/FULL_LAUNCH_EXECUTION_PLAN.md

grep -RIn "LAUNCH_STANDARD_V1.1|FULL_LAUNCH_GAP_REPORT|FULL_LAUNCH_EXECUTION_PLAN" \
  docs/DEPRECATION_*.md docs/DB_DEPRECATION_REMOVAL_RFC.md >/dev/null

echo "PASS: Phase A canonical-only verification completed"
```

## Output Evidence (to be created when run in canonical workspace)

docs/_evidence/phaseA/phaseA_verification_run<YYYYMMDD_HHMMSS>.md

