# Commercial Release Note (V1)

**Release Tag**: `release/commercial_v1_20260113`
**Commercial Seal Tag**: `seal/phase3_commercial_e2e_hard_20260113_153210`
**Release Date**: 2026-01-13
**Status**: COMMERCIAL HARD SEAL (Phase 3+4)

## Release Highlights

- **Full E2E Commercial Pipeline Verified**: CE06 -> CE03 -> CE04 -> SHOT_RENDER -> COMPOSE -> PREVIEW
- **Zero Risk Architecture**:
  - Unified Audit Prefix (`CE%`)
  - Dynamic Pricing Decoupling (`PRICING_SSOT.md`)
  - Strict Engine Keys
- **Studio Commercial Closure**: UI-based observability and billing summaries (P3-3)

## Evidence & Verification

- **Gate Output**: `docs/_evidence/GATE_PHASE3_E2E_1768293087`
- **Gate Command**: `pnpm run gate:commercial` (Exit Code 0)
- **Gate Script**: `tools/gate/run_commercial_seal.sh`
- **SSOT Version**: V1.1.0 (Aligned)

## Key Components Status

| Component   | Status           | Pricing   | Audit |
| ----------- | ---------------- | --------- | ----- |
| Studio UI   | COMMERCIAL-READY | Read-only | N/A   |
| CE Pipeline | REAL             | Dynamic   | CE%   |
| API         | HARD SEALED      | N/A       | CE%   |

> Generated automatically by tools/release/gen_release_note.js
