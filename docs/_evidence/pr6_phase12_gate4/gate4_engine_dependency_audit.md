# Gate 4 Engine Dependency Audit

## 1. Failure Analysis
- **Observed Error**: `No engine available for job type: VIDEO_RENDER` (HTTP 400)
- **Trigger Source**: `tools/smoke/trigger_and_poll_video.ts`
- **Root Cause**: 
  - `init_api_key.ts` seeds an engine with key `default_video_render`.
  - `EngineRegistry.getDefaultEngineKeyForJobType('VIDEO_RENDER')` returns `video_merge`.
  - The mismatch results in a 400 error during job creation.

## 2. Dependency Matrix

| Component | Expected Engine Key | Current Seed Key | Status | Action |
| --- | --- | --- | --- | --- |
| **VIDEO_RENDER** | `video_merge` | `default_video_render` | **MISSING** | **MUST FIX** |
| **CE09 Security** | `ce09_security_real` | N/A | MISSING | Optional (Next Stage) |
| **Shot Seed** | N/A | N/A | OK | No Action |

## 3. Minimal Fix Recommendation
Only add `video_merge` to the `engines` array in `init_api_key.ts` to satisfy the immediate requirement of Gate 4. 

## 4. SSOT Guardrail Recommendation
Add a hardcoded assertion in `init_api_key.ts` that maps `VIDEO_RENDER` to its canonical key, ensuring that any future changes to the registry will trigger a visible seeding failure if not aligned.

> [!NOTE]
> Following the "Minimal Fix" principle, we will NOT add the other 10 engines proposed in the previous plan.
