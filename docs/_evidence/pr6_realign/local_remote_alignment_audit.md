# Local-Remote Alignment Audit

## 1. Verified Local Modification Inventory
*These files contain changes that differ from the current remote origin but have been verified locally.*

| File Path | Purpose | Wave Category | Action |
| :--- | :--- | :--- | :--- |
| `tools/smoke/init_api_key.ts` | **SSOT Engine Mapping**: Replaced usage of `default_video_render` with `video_merge`. | **Wave 1** | **Retain** |
| `tools/smoke/helpers/hmac_request.ts` | **Auth Fix**: Aligned HMAC V1.1 signature logic with API. | **Wave 1** | **Retain** |
| `apps/workers/src/gate/gate-worker-app.ts` | **Payload Fix**: Added `videoKey` to top-level mock result. | **Wave 1** | **Retain** |
| `apps/workers/src/processors/video-render.processor.ts` | **Structure Fix**: Aligned HUB processor result with `videoKey`. | **Wave 1** | **Retain** |
| `tools/smoke/run_video_e2e.sh` | **Parsing Fix**: Corrected `jq` path to `.result.videoKey`. | **Wave 1** | **Retain** |
| `tools/smoke/start_api.sh` | **Stability**: Added startup pre-checks and port logic. | **Wave 1** | **Retain** |
| `docs/...` | Evidence and Audit documentation. | **Wave 1** | **Retain** |

## 2. Categorization Reference
- **Category A (Launch Gates Required)**: Directly impacts Gate 4 pass/fail status.
- **Category B (E2E Logic)**: Necessary for a successful local-to-remote functional loop.
- **Category C (Tooling/Governance)**: Stability and CI improvements.
- **Category D (Excluded)**: CodeQL/Dependabot (Not in current local set).

## 3. Alignment Conclusion
All currently modified local files are **verified assets** for the E2E chain. 
They should NOT be rolled back. They are the target baseline for **Wave 1 Synchronization**.
