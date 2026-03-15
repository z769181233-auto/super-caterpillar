# Phase 11 & Gate 3: `STORAGE_ROOT` Usage Audit

## Background
To fix tracking for Gate 3 (Range 404), a proposal was made to remap the global default `STORAGE_ROOT` in `packages/config/src/env.ts` from `.runtime` to `.data/storage`. As mandated by Adam's guardrail, we must first audit the codebase to ensure `.runtime` isn't an active Single Source of Truth (SSOT) explicitly relied upon by other architectural layers.

## Audit Findings

### 1. Where does `.runtime` appear?
The `grep` sweep exclusively reveals `.runtime` being utilized in two primary capacities:
- **As a legacy fallback string**:
  - `apps/api/src/engines/adapters/audio-bgm.local.adapter.ts`: `process.env.STORAGE_ROOT || '.runtime'`
  - `apps/api/src/engines/adapters/audio-tts.local.adapter.ts`: `process.env.STORAGE_ROOT || '.runtime'`
  - `apps/api/src/engines/adapters/ce23_identity_lock.adapter.ts`: `process.env.STORAGE_ROOT || '.runtime'`
  - `packages/config/src/env.ts`: `process.env.STORAGE_ROOT || '.runtime'`
- **As a path-stripping utility or specific explicit override**:
  - `apps/workers/src/processors/video-render.processor.ts`: `replace(/^.*\.runtime\//, '')` 
  - `tools/gate/gates/gate_fullchain_minloop.sh`: `export STORAGE_ROOT=".runtime"` (This explicit export will safely override any global fallback change).

### 2. Where does `.data/storage` appear?
`.data/storage` dominates the codebase as the **active, production-aligned SSOT** for physical artifacts:
- **Gate & CI Toolchain** (Over 10 active scripts):
  - `tools/smoke/seed_storage_key.sh`
  - `tools/gate/gates/gate_e2e_full_video_generation.sh`
  - `tools/gate/gates/gate-step1_novel_to_prod_video_real.sh`
  - `tools/gate/gates/gate-ce23-real-threshold-calib.sh`
- **API/Production Configs**:
  - `apps/api/src/engines/adapters/shot-render.local.adapter.ts`: `process.env.STORAGE_ROOT || '.data/storage'`
  - `apps/api/src/storage/storage.controller.ts`: `process.env.STORAGE_ROOT || path.resolve(process.cwd(), '.data/storage')`
  - `tools/production/safe_restart_pilot.sh`: `export STORAGE_ROOT="$(pwd)/.data/storage"`

## Conclusion & Verdict
**VERDICT: SAFE TO PROCEED GLOBALLY**

`.runtime` is purely a historical fallback configuration logic. The entire testing toolchain (`bash/smoke/gate`) and production deployment scripts actively explicitly set or default to `.data/storage`. Re-aligning `packages/config/src/env.ts` to fallback to `.data/storage` rectifies the schism between the backend's default view and the CI script's writes. It acts as a robust unification of the codebase rather than a dangerous swap.

**Next Action**: Implement the `env.ts` alignment and proceed to API endpoint patching as instructed in Step 1.
