# stash@{0} hygiene inventory - 2026-05-18

## Scope

This document records the contents of:

`stash@{0}: hygiene-quarantine-remaining-dirty-2026-05-18`

The stash was inspected only with `git stash show -u`. It was not popped, applied, dropped, or partially restored during this milestone.

## Summary

- Total changed files in stash: 155
- Approximate diff size: 36,774 insertions and 1,557 deletions
- Risk: high if restored as a single batch
- Decision: do not restore the stash wholesale

## Category Counts

| Category | Files | Risk | Handling |
| --- | ---: | --- | --- |
| API smoke scripts | 18 | P2 medium | Restore only if they support an active smoke milestone. |
| Auth / security | 2 | P1 high | Restore as a dedicated security slice with focused tests. |
| CI workflows | 3 | P1 high | Restore only after checking current GitHub Actions state. |
| Content gates | 5 | P1 high | Restore only with worker/API contract tests. |
| Continuity state | 5 | P1 high | Restore only as a self-contained continuity slice. |
| Film IR | 13 | P1 high | Restore only after current Film IR target is active. |
| Prisma migrations | 2 | P0 blocking | Do not restore without explicit migration milestone. |
| Shared types | 5 | P1 high | Restore only with package build and downstream typecheck. |
| Shot planner / generator | 11 | P1 high | Keep isolated until text pipeline is stable. |
| Storyboard image | 13 | P0 blocking | Keep isolated; do not enter image generation yet. |
| Web UI / routes | 24 | P1 high | Split into display-only UI vs storyboard/image API routes. |
| Workers | 14 | P1 high | Restore only with worker tests and no mixed API/UI changes. |
| Workspace config | 4 | P1 high | Restore only if required by a verified slice. |
| Docs / specs | 1 | P3 low | Can restore independently if still relevant. |
| Stale status docs | 2 | P2 medium | Do not restore over current `PLANS.md` / `STATUS.md`. |
| Tools | 2 | P2 medium | Restore only with matching acceptance command. |
| Other | 31 | P1 high | Requires manual inspection before any restore. |

## High-Risk Files That Must Stay Isolated For Now

- Storyboard image and generated asset routes:
  - `apps/api/src/project/project-storyboard-image.service.ts`
  - `apps/api/src/project/project-studio-storyboard-asset.service.ts`
  - `apps/web/src/app/api/projects/[projectId]/storyboard-assets/**`
  - `apps/web/src/features/studio-v2/StudioStoryboardAssetPage.tsx`
- Video / shot generation path:
  - `apps/workers/src/processors/ce11-shot-generator.processor.ts`
  - `apps/workers/src/processors/shot-render.processor.ts`
  - `packages/shared-types/src/shot-planner.ts`
- Prisma migrations:
  - `packages/database/prisma/migrations/20260430094500_backfill_novel_sources_raw_text_column/migration.sql`
  - `packages/database/prisma/migrations/20260430102000_backfill_ce06_novel_parsing_engine/migration.sql`
- Historical status docs:
  - `PLANS.md`
  - `STATUS.md`

## Recommended Restore Order

1. Auth / security slice:
   - `apps/api/src/auth/guards/budget.guard.ts`
   - `apps/api/src/auth/hmac/hmac-auth.guard.ts`
   - Validation: targeted API auth tests and API typecheck.

2. Safe display-only project-detail / structure UI slice:
   - `apps/web/src/features/project-detail/**`
   - `apps/web/src/app/[locale]/projects/[projectId]/structure/page.tsx`
   - Exclude storyboard image routes.
   - Validation: targeted TSX tests and web typecheck.

3. Asset receipt / review evidence slice if still relevant:
   - `apps/api/src/project/project.service.review-queue.spec.ts`
   - `apps/web/src/features/projects/pages/ReviewQueuePageContent.tsx`
   - Validation: project service tests and web typecheck.

4. Smoke scripts slice:
   - Restore only scripts needed for the next active milestone.
   - Validation: run the selected script in dry-run or test mode.

5. Storyboard image / video generation:
   - Keep isolated until the user explicitly enters the image/video generation milestone.
   - Must be split into protocol, API, storage, UI, and generation provider sub-slices.

## Do Not Do

- Do not run `git stash pop`.
- Do not run `git stash apply stash@{0}` into the main worktree.
- Do not drop `stash@{0}` until every recoverable slice is either committed or explicitly discarded.
- Do not restore Prisma migrations without an explicit migration plan.
- Do not restore image/video generation in the same slice as UI display or text pipeline work.

## Current Decision

Keep `stash@{0}` intact. Use this inventory as the source of truth for the next restore milestone.
