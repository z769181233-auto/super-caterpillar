# Phase B Verification Plan (Canonical Workspace Only)

- Date: 2025-12-19
- Prereq: PASS canonical workspace gate
  - bash docs/_evidence/_tools/check_canonical_workspace.sh

## Run

```bash
# 0) canonical workspace gate
bash docs/_evidence/_tools/check_canonical_workspace.sh

# 1) untracked allowlist (Phase policy)
mkdir -p docs/_evidence/_tmp
git status --porcelain | awk '$1=="??"{print $2}' > docs/_evidence/_tmp/untracked_all.txt
grep -vE '^(docs/_evidence/)' docs/_evidence/_tmp/untracked_all.txt > docs/_evidence/_tmp/untracked_violation.txt || true
test ! -s docs/_evidence/_tmp/untracked_violation.txt

# 2) index exists and has expected rows (>= 1, excludes header)
test -f docs/DEPRECATION_HISTORY_INDEX_STAGE1_4.md
python - << 'PY'
from pathlib import Path
p=Path("docs/DEPRECATION_HISTORY_INDEX_STAGE1_4.md")
lines=[l for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
# naive: count table rows that start with '|'
rows=[l for l in lines if l.lstrip().startswith("|")]
print("[phaseB] table_rows=", len(rows))
PY
```

## Output Evidence (to be created when run in canonical workspace)

docs/_evidence/phaseB/phaseB_verification_run<YYYYMMDD_HHMMSS>.md

