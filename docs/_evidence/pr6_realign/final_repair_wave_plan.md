# Final Repair Wave Plan

## 1. Synchronization Overview
To transition from the current "Failing Gates" state to a "Clean 基线" state, we will execute synchronization in three logical waves.

### Wave 1: Functional E2E Completion (The "Green Line")
- **Goal**: Clear current `launch-gates-required` blockers (Gate 4).
- **Strategy**: Synchronize all verified local changes required to pass `run_video_e2e.sh`.

#### A. Wave 1 Primary Set (Approved for Sync)
- `tools/smoke/init_api_key.ts`
- `tools/smoke/helpers/hmac_request.ts`
- `apps/workers/src/gate/gate-worker-app.ts`
- `apps/workers/src/processors/video-render.processor.ts`
- `tools/smoke/run_video_e2e.sh`
- 本轮直接相关的分析与审计 docs

#### B. Wave 1 Candidate Set (On Hold)
- `tools/smoke/start_api.sh`
  - *Reasoning*: Deferred unless proven that remote `launch-gates-required` workflows explicitly depend on this specific robust version.
- **Expected Outcome**: Gate 4 turns ✅ on GitHub.

### Wave 2: CI & Development Reliability
- **Goal**: Address intermittent lint/build failures and secondary gates.
- **Strategy**: Finalize all shared package alignment and remaining non-security infrastructure.
- **Expected Outcome**: All required status checks (Functional) turn ✅.

### Wave 3: Security & Debt Closure
- **Goal**: Hard-clean CodeQL and Dependabot.
- **Strategy**: 
  - Independent PR for 53 Code Scanning alerts.
  - Independent PRs for Dependabot updates.
- **Expected Outcome**: Security tab shows 0 alerts. Pull Request becomes "Mergeable."

## 2. Recommended Retained Patch Set for Wave 1
*The following local modifications MUST be retained and pushed as the Wave 1 core:*

1.  **Engine Seeding**: `video_merge` canonical mapping + SSOT guardrail.
2.  **HMAC Authentication**: Canonical V1.1 signature logic.
3.  **Payload Alignment**: `videoKey` field unification.
4.  **E2E Tooling**: `jq` path correction and start script robustness.
5.  **Documentation**: Evidence logs (`docs/_evidence/pr6_realign/...`).

## 3. Immediate Next Steps
1.  **Audit Approval**: Request user sign-off on Wave 1 Set.
2.  **Push Initial Baseline**: Commit and push Wave 1 files.
3.  **Remote Verification**: Wait for GitHub Actions to confirm the Green Line.
