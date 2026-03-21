# Director Layer Phase 2 Report

Last Updated: 2026-03-21

## Scope

Phase 2 focused on hardening and enriching the existing Director Layer minimal closure without rewriting the stable CE / scene / shot / timeline / publish chain.

This phase was treated as an enhancement wave on top of the completed first-phase closure.

## Completed

### 1. Acceptance Coverage Expansion

- Expanded the Director Layer acceptance registry from 1 scene to 7 scenes.
- Formal registry source:
  - `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json`
- The current acceptance profile covers:
  - baseline scenes
  - thin scenes
  - scenes with synthetic bootstrap repair
  - a scene with 2 shots

### 2. Bootstrap Closer To Real Media Chain

- Director bootstrap no longer only writes minimal placeholders.
- It now creates or maintains a richer synthetic media chain:
  - synthetic `VIDEO_RENDER` job
  - `asset.createdByJobId`
  - `asset.storageKey`
  - `asset.hls_playlist_url`
  - `asset.signed_url`
  - `published_video.metadata.directorLayer`
  - `shot_job.result.assetId`
  - `shot_job.result.output.*`

### 3. Evidence Package

- Director Layer reporting now emits:
  - Markdown report
  - JSON evidence package
- Output files:
  - `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/.data/logs/director-layer-report.md`
  - `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/.data/logs/director-layer-report.json`

### 4. Shot Planner Enrichment

- Film IR projection was enriched into:
  - `shots.params.directorPlan`
  - `shot_plannings.data`
- Director plan now carries richer fields including:
  - `visualStrategy`
  - `blockingStrategy`
  - `avgShotLengthSec`
  - `cameraDistanceStrategy`
  - `cameraAngleStrategy`
  - `cameraMotionStyle`
  - `compositionStyle`
  - `spatialStrategy`
  - `lightingStyle`
  - `colorStrategy`
  - `soundStrategy`
  - `silenceStrategy`
  - `editingRhythmStrategy`
  - `characterStateConstraints`
  - `costumeStateConstraints`
  - `propStateConstraints`
  - `locationStateConstraints`
  - `transitionHint`

### 5. Timeline Consumption Of Director Signals

- Timeline compose now consumes director-layer transition/rhythm hints instead of leaving them as dead metadata.
- Current consumed signals:
  - `transitionHint`
  - `editingRhythmStrategy`
  - `avgShotLengthSec`

### 6. State Engine Formal Controls

- Added formal continuity control layers:
  - `continuity_state_locks`
  - `continuity_state_overrides`
- Added migration:
  - `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/packages/database/prisma/migrations/20260321103000_continuity_state_controls/migration.sql`
- Continuity audit now:
  - respects active locks
  - applies latest override
  - emits richer snapshot types:
    - `SCENE_AUDIT`
    - `SCENE_AUDIT_LOCKED`
    - `SCENE_AUDIT_OVERRIDE_APPLIED`

### 7. Judge / Content Gate Enrichment

- Content judge now computes richer derived scores instead of mapping one overall score to every field.
- Current derived scoring includes:
  - `dramaticAlignmentScore`
  - `visualStrategyMatchScore`
  - `continuityScore`
  - `shotCoherenceScore`
  - `rhythmScore`
  - `characterConsistencyScore`
  - `soundAlignmentScore`
  - `publishReadinessScore`
- Gate decisions now use profile-aware thresholds:
  - `strict`
  - `standard`
  - `advisory`
- Gate details now include:
  - threshold profile
  - thresholds used
  - gate reason
  - director plan
  - shot-plan presence
  - derived score breakdown

## Validation Status

The current second-phase enhancement baseline has been revalidated.

Latest local verification:

- `pnpm --filter api build`
- `pnpm --filter @scu/worker build`
- `pnpm --filter api bootstrap:director-layer:batch`
- `pnpm --filter api verify:director-layer:batch`
- `pnpm --filter api report:director-layer -- --output=.data/logs/director-layer-report.md`

Current result:

- `totalScenes: 7`
- `passedScenes: 7`
- `failedScenes: 0`

## What Phase 2 Does Not Claim

Phase 2 does not claim that Director Layer is now a full production-grade directing operating system.

It does not yet provide:

- full planner-driven transition orchestration end-to-end
- complete state lock/override management APIs and operator tooling
- full judge policy matrix across all publish tiers
- large sample-set acceptance coverage
- full natural media generation evidence instead of bootstrap-assisted closure

## Phase 3 Backlog

### P3-A. Planner-To-Timeline Deep Consumption

- Extend timeline and downstream render logic to consume more than transition hints.
- Candidate fields:
  - visual strategy
  - composition style
  - camera distance strategy
  - blocking strategy
  - sound strategy

### P3-B. State Engine Operationalization

- Add formal API/service boundaries for:
  - create lock
  - release lock
  - create override
  - list active overrides
- Add operator-safe evidence trail around lock/override actions.

### P3-C. Gate Policy Deepening

- Make publish gate policy more explicit by project/profile/tier.
- Separate:
  - advisory-only gates
  - blocking gates
  - publish-readiness gates

### P3-D. Acceptance Coverage Expansion

- Expand acceptance registry beyond 7 scenes.
- Prioritize:
  - richer scenes
  - multi-shot scenes
  - more complex continuity patterns
  - more diverse projects

### P3-E. Evidence Productization

- Promote director-layer evidence from report files into a more stable artifact contract.
- Make evidence easier to consume by:
  - CI
  - release readiness
  - auditing
  - future training export pipelines

## Current Phase Decision

Phase 2 is complete.

The next recommended workstream is:

1. Productize the state and gate controls.
2. Expand planner-to-timeline consumption depth.
3. Expand acceptance coverage beyond the current 7-scene baseline.
