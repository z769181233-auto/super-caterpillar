# Feature Phase Gate Declaration

- Date: 2025-12-19T12:35:01+07:00
- Status: **ACTIVE**

## Declaration

**As of 2025-12-19, the repository enters the "Feature Phase".**

From this point forward, the following rules apply:

### Prohibited

- **No ad-hoc cleanup**: No "incidental cleanup" or "removing legacy code" changes
- **No governance-only changes**: All changes must be part of a functional feature or bug fix
- **No mixing**: Governance changes cannot be mixed with feature changes

### Required

All future changes must:

1. **Belong to a functional Stage**: Changes must be part of a defined Stage (Stage 5, 6, etc.)
2. **Have PRD/Spec**: Must have Product Requirements Document or Technical Specification
3. **Have Evidence**: Must follow the evidence chain requirements (automation + manual verification)

### Deprecation Policy

- Deprecation Cleanup Phases A/B/C are **FROZEN** (see docs/_evidence/deprecation_close_index_20251219.md)
- Any future deprecation requires:
  - New Deprecation RFC
  - Cannot reuse historical evidence
  - Must follow full verification process

## Enforcement

- [DEPRECATION GUARD] PASS: Prevents reintroduction of removed items
- [canonical] PASS: safe to generate authoritative verification evidence
== Canonical workspace check ==
[canonical] tracked_count=19
[canonical] untracked_count=17
PASS: canonical workspace preconditions satisfied: Includes deprecation guard check
- CI Gate: Should include deprecation guard (if CI is configured)

## Notes

This gate ensures that:
- Code quality improvements are intentional and tracked
- Feature development is not mixed with cleanup work
- Evidence chain remains clean and auditable

## Phase D Evidence Index

- See: docs/_evidence/phaseD/INDEX.md
