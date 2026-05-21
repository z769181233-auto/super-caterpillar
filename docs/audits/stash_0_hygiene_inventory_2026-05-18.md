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

## Follow-up Hygiene Progress

The following slices have been extracted from the original stash into separate commits without applying or popping the full stash:

| Commit | Slice | Notes |
| --- | --- | --- |
| `d17451558` | auth/security | Aligned budget guard organization context. |
| `d019fa400` | display-only project-detail / structure UI | Restored read-only structure result display. |
| `7c063116a` | review evidence display | Restored read-only review evidence queue display. |
| `56ef0fbf9` | project overview proxy | Added read-only overview proxy. |
| `b661d4121` | project structure proxy | Added read-only structure proxy. |
| `a0aa5ab85` | smoke receipt dry-run | Added read-only smoke receipt dry-run script instead of restoring write-capable smoke scripts. |
| `f7df4808c` | Common nav i18n | Added missing display-only navigation labels. |
| `629083308` | Director Layer acceptance registry | Locked default acceptance profile to a minimal verified scene sample. |

## Remaining Low-Risk Candidate Evaluation - 2026-05-21

Current comparison used:

`git diff --name-status HEAD stash@{0}`

### Findings

| Candidate | Current Assessment | Reason |
| --- | --- | --- |
| `apps/web/src/messages/{zh,en,vi}.json` | Do not restore as-is | Remaining diff mixes useful ProjectDetail text with auth/register indentation changes and broader project create/delete strings. Needs a dedicated display-only i18n slice if selected. |
| `apps/api/src/film-ir/*.spec.ts` | Not safe as pure test slice | Test changes are coupled to Film IR runtime changes still in stash. Restoring only specs would likely fail or encode behavior not present in HEAD. |
| `apps/api/src/project/project-studio-episode-plan.service.spec.ts` | Not safe as pure test slice | Coupled to project Studio generation service changes. This belongs to a later text-pipeline milestone, not hygiene-only recovery. |
| Worker contract/spec files | Not safe as pure test slice | Coupled to worker processor changes and shot/video generation flow. Keep isolated. |
| Storyboard asset/image tests | Explicitly excluded | They belong to storyboard image generation and must remain isolated until that milestone is explicitly opened. |
| CI workflows | Not safe as low-risk slice | They can change required checks and deployment behavior. Require a dedicated CI milestone. |
| Prisma migrations | Explicitly excluded | Require an explicit migration plan and database validation. |

### Next Safe Options

1. If continuing hygiene: create a dedicated ProjectDetail i18n display-only slice that manually selects only safe user-facing labels from the remaining messages diff and leaves auth/register formatting untouched.
2. If moving back to product quality: start a new novel-analysis quality milestone with a clean worktree, not from `stash@{0}`.
3. If addressing CI: open a dedicated CI workflow milestone and inspect current GitHub Actions state first.

### Decision

No additional pure test file should be restored blindly from `stash@{0}` at this point. Remaining test files are mostly coupled to unstaged runtime changes. Keep `stash@{0}` intact and continue with manually scoped slices only.
