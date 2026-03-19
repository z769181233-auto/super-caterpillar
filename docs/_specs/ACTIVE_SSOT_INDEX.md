# Active SSOT Index

This file defines which documents in `docs/_specs` should be treated as the current engineering
source of truth for implementation and verification.

## Rules

- Prefer Markdown / JSON SSOT files in this index over historical PDF documents.
- Treat versioned PDFs as historical context only. Historical PDFs / Word documents have been moved
  out of `docs/_specs` root into `docs/_specs_archived/historical_source_docs_20260319/`.
- When code behavior and a historical PDF disagree, implementation work should align to the SSOT
  files listed below.

## Current Engineering SSOT

### Launch / Runtime

- `GO_LIVE_CHECKLIST_SSOT.md`
- `RELEASE_POLICY_SSOT.md`
- `REQUIRED_RULES.md`
- `CE_CORE_RUNTIME_VERIFY_SPEC.md`

### Engines / Jobs / Contracts

- `ENGINE_MATRIX_SSOT.md`
- `V3_JOB_STATE_SSOT.md`
- `V3_CONTRACT_MAPPING_SSOT.md`
- `CE23_REAL_SSOT.md`

### Quality / Observability

- `QUALITY_SCORE_SSOT.md`
- `OBSERVABILITY_SPEC.md`
- `MONITORING_SSOT.json`
- `G5_QUALITY_GATE_SSOT.md`
- `G5_ASSET_GRADE_SSOT.md`
- `G5_DELIVERY_TIER_SSOT.md`

### Billing / Governance

- `BILLING_LEDGER_SSOT.md`
- `PRICING_SSOT.md`
- `P10_GOVERNANCE_CONSTITUTION.md`

### Novel / Shot Schema

- `NOVEL_TO_SHOT_SCHEMA_SSOT.md`
- `NOVEL_SOURCE_INDEX.md`
- `NOVEL_INPUT_FREEZE.json`
- `PHASE2_INPUT_FREEZE.json`
- `CANON_FREEZE.json`

## Historical Reference Only

The following classes of files are not the primary execution SSOT anymore:

- `*_V1.0.pdf`
- `*_V1.1.pdf`
- `*_V3.0_正式版.pdf`
- `BOOK.docx`
- ad-hoc sample payloads unless referenced by a listed SSOT

These files may still be useful for business or historical context, but they should not override
the current SSOT documents above during implementation or verification. Historical documents should
be reviewed from `docs/_specs_archived/historical_source_docs_20260319/`, not from `docs/_specs`
root.
