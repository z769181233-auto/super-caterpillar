# Amendment / Evidence Patch - Deprecation Cleanup Phase A (Whitelist Normalization)

**Patch Type**: Evidence Amendment (text-only normalization)  
**Scope**: docs/_evidence only (NO code changes)  
**Date**: 2025-12-19 09:29:59  
**Author**: Cursor (Exec)  

## 1) Why this amendment is needed

Phase A evidence files originally documented an untracked whitelist that included `/tmp/`.

However, `git status --porcelain` outputs relative paths, so `/tmp/` is not a valid whitelist target and can cause audit disputes.

To remove ambiguity and improve cross-environment reproducibility, whitelist is normalized to only allow `docs/_evidence/`,
and temporary files are redirected to `docs/_evidence/_tmp/`.

## 2) What changed (text-only)

### 2.1 Whitelist policy text

- Before: allowed paths = `docs/_evidence/` and `/tmp/`
- After: allowed paths = `docs/_evidence/` only

### 2.2 Example commands

- Before: writes to `/tmp/untracked_*.txt`, regex `^(docs/_evidence/|/tmp/)`
- After: writes to `docs/_evidence/_tmp/untracked_*.txt`, regex `^(docs/_evidence/)`

## 3) Files amended

- docs/_evidence/automation_verification_deprecation_phaseA_20251219_080136.md
- docs/_evidence/manual_verification_deprecation_phaseA_20251219_080136.md

## 4) Verification (post-amendment hard checks)

### 4.1 No legacy whitelist text remains

```bash
! grep -RIn "docs/_evidence/、/tmp/|docs/_evidence/ 或 /tmp/|允许路径.*/tmp/" docs
```

### 4.2 Regex aligned and no /tmp in whitelist regex

```bash
grep -RIn "grep -vE.*docs/_evidence" docs/_evidence/*.md | grep -v "/tmp/"
```

### 4.3 Temporary file paths updated to repo-local

```bash
grep -c "docs/_evidence/_tmp/untracked" docs/_evidence/*.md
```

### 4.4 Temporary directory exists

```bash
test -d docs/_evidence/_tmp
```

## 5) Conclusion

This amendment does not change Phase A verification outcomes (PASS/violation_count=0) because it is a documentation/command reproducibility fix.

Evidence chain is strengthened: whitelist policy is now unambiguous and reproducible across environments.

**Final**: ✅ Amendment applied; Phase A Close remains ✅ VALID.

## 6) Reproducibility Check (repo-local tmp paths)

```bash
mkdir -p docs/_evidence/_tmp

git status --porcelain | awk '$1=="??"{print $2}' > docs/_evidence/_tmp/untracked_all.txt
grep -vE '^(docs/_evidence/)' docs/_evidence/_tmp/untracked_all.txt > docs/_evidence/_tmp/untracked_violation.txt || true

ALL_COUNT=$(wc -l < docs/_evidence/_tmp/untracked_all.txt | tr -d ' ')
VIOLATION_COUNT=$(wc -l < docs/_evidence/_tmp/untracked_violation.txt | tr -d ' ')

echo "[untracked] all_count=$ALL_COUNT"
echo "[untracked] violation_count=$VIOLATION_COUNT"

if [ -s docs/_evidence/_tmp/untracked_violation.txt ]; then
  echo "FAIL: untracked files outside allowed paths:"
  cat docs/_evidence/_tmp/untracked_violation.txt
  exit 1
else
  echo "PASS: all untracked files are within allowed paths (docs/_evidence/)"
fi
```

---

## NOTE (Outcome Correction / Superseded)

This amendment only normalizes whitelist policy text and example commands.

It MUST NOT be used to infer Close outcome.

### Authoritative Close Status

- Phase A Close: **NOT CLOSE / BLOCKED**
- Reason: verification cannot PASS in a workspace with mass untracked files outside `docs/_evidence/**`.
- See:
  - docs/_evidence/phaseA/close_report_deprecation_phaseA_20251219.md
  - docs/_evidence/phaseA/phaseA_verification_environment_blocker_20251219.md
  - docs/_evidence/phaseA/reverify_untracked_allowlist_phaseA_20251219.md
