# Gate 4 Change Partition Audit

## 1. Categorization Methodology
Following the principle of "Fixing only the first fault," I have partitioned the current local fixes into three distinct layers to ensure auditable and minimal closure of Phase 12.

### A. First-Fault Fixes (Phase 12 Core)
*Crucial to crossing the `No engine available for job type: VIDEO_RENDER` barrier.*

- **File**: `tools/smoke/init_api_key.ts`
  - **Action**: Replaced `default_video_render` with `video_merge`.
  - **Reason**: Direct fix for the 400 error. Without this, the job creation fails immediately.
  - **Status**: **MANDATORY for Phase 12 Closure.**

### B. Post-First-Fault Issues (Phase 13 Candidate)
*Issues exposed only after the 400 engine missing error was cleared.*

- **File**: `tools/smoke/helpers/hmac_request.ts`
  - **Action**: Aligned signature concatenation with API's V1.1 logic.
  - **Reason**: Fixes 401 Unauthorized. This was the "second fault" encountered after clearing the 400 error.
- **File**: `DB Injection (Organization Table)`
  - **Action**: Injected credits via Prisma.
  - **Reason**: Fixes 403 Payment Required. This was the "third fault."
- **File**: `apps/workers/src/gate/gate-worker-app.ts` & `video-render.processor.ts`
  - **Action**: Structuring result payload to include `videoKey`.
  - **Reason**: Fixes parsing failure in the E2E script. This was the "final fault" in the polling stage.
- **File**: `tools/smoke/run_video_e2e.sh`
  - **Action**: Corrected `jq` path from `.payload.result` to `.result`.
  - **Reason**: Necessity for final result verification.

### C. Tooling Hardening (Out of Scope for RCA)
- **File**: `tools/smoke/start_api.sh`
  - **Action**: Added circuit breakers and pre-checks.
  - **Reason**: General stability, not specific to Gate 4 business logic.
- **File**: `tools/smoke/init_api_key.ts` (Guardrail part)
  - **Action**: Added SSOT post-seed assertion.
  - **Reason**: Preventive measure for future drift.

## 2. Minimal Patch Set for Phase 12
To close Phase 12 (First-Fault Fix), the minimal submission SHOULD only include:
- `tools/smoke/init_api_key.ts` (Engine replacement logic)

> [!IMPORTANT]
> Submitting ONLY the engine replacement will cause Gate 4 to fail with a **401 Unauthorized** in the remote CI, which is the CORRECT outcome for single-fault closure. The 401 should then be addressed in the next Phase/Step.

## 3. Implementation Recommendation
1.  **Phase 12 Commit**: Only include the `video_merge` seeding in `init_api_key.ts`.
2.  **Phase 13+ Commits**: Handle the HMAC, Credits, and Payload parsing as subsequent, isolated fixes.
