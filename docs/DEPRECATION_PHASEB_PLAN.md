# Deprecation Cleanup - Phase B Plan (Index + Snapshot Only)

## Goal

- Keep history docs in place (NO moves)
- Create a stable index for Stage1-4 historical docs
- Optionally create snapshot copies under docs/_archive_snapshots/ (COPY ONLY)

## Non-Goals

- No deletion
- No relocation of original history docs
- No code changes

## Steps

1) Generate a table of historical docs (Stage1-4) with:
   - file path
   - short description (1 line)
   - referenced-by (if any)

2) Snapshot policy (optional):
   - copy selected docs to docs/_archive_snapshots/stageX/YYYYMMDD/
   - keep original files untouched

3) Verify:
   - links remain valid
   - untracked stays inside docs/_evidence/

## Phase B Outputs (Hard)

- Index (authoritative): docs/DEPRECATION_HISTORY_INDEX_STAGE1_4.md
- Optional snapshots root: docs/_archive_snapshots/stageX/YYYYMMDD/ (COPY ONLY)
- Evidence for Phase B runs: docs/_evidence/phaseB/**

## Phase B Verification (Hard)

- allowlist = docs/_evidence/** only
- tmp paths = docs/_evidence/_tmp/** (repo-local)

## Phase B Status (Hard)

- Artifacts: GENERATED (index created)
- Verification: PENDING (must run in canonical repo workspace; otherwise allowlist gate will fail by definition)

## Canonical Workspace Gate (Hard)

Before running Phase B verification, MUST pass:

```bash
bash docs/_evidence/_tools/check_canonical_workspace.sh
```

