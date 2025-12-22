# CLOSE DECISION (Authoritative Entry)

This repository's CLOSE decision for Deprecation Cleanup is ONLY based on the following authoritative files:

## Authoritative Close Reports

- Phase A Close: docs/_evidence/phaseA/close_report_deprecation_phaseA_20251219.md
- Phase B Close: docs/_evidence/phaseB/close_report_deprecation_phaseB_20251219.md

## Authoritative Verification Runs (Canonical Workspace Only)

- Phase A Run: docs/_evidence/phaseA/phaseA_verification_run20251219_110515.md
- Phase B Run: docs/_evidence/phaseB/phaseB_verification_run20251219_110323.md

## Authoritative Close Index

- docs/_evidence/deprecation_close_index_20251219.md

## Hard Policy

- Canonical workspace gate MUST PASS before generating any verification/close evidence:
  - bash docs/_evidence/_tools/check_canonical_workspace.sh

- untracked allowlist = docs/_evidence/** only
- repo-local tmp paths = docs/_evidence/_tmp/**

Any other report that contains FAIL/BLOCKED/violation_count outputs is historical and MUST be treated as SUPERSEDED for CLOSE decision.

---

## Canonical-only Runbook (Authoritative)

All verification / close evidence generation MUST start from canonical workspace and MUST use the unified entry:

```bash
bash docs/_evidence/_tools/verify_entry.sh
```

Then run the phase plan commands (which already include require_canonical_or_exit.sh as hard prerequisite).
