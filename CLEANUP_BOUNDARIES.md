# Cleanup Boundaries

This file marks which paths in this repo are active source-of-truth paths and which are disposable runtime artifacts.

## Current Reports To Trust

Use only these launch-gates reports as current verification references:

- `docs/_evidence/run_launch_gates_20260316_213550/GATEKEEPER_VERIFICATION_REPORT.md`
- `docs/_evidence/run_launch_gates_20260316_204710/GATEKEEPER_VERIFICATION_REPORT.md`

Older launch-gates reports were archived under:

- `docs/_evidence_archived/run_launch_gates_obsolete/`

## Safe To Clean

These paths are runtime artifacts or local noise and can be cleaned without changing source logic:

- `.data/logs/`
- `.tmp/`
- `tmp/` contents, but keep `tmp/.gitkeep`
- `apps/workers/tmp/`
- `node_modules/.cache/`
- `apps/workers/node_modules/.cache/`
- `packages/database/node_modules/.cache/`
- `apps/api/dist_temp/`
- `apps/api/dist_diag/`

## Keep But Treat As Generated

These are generated outputs and should not be used as source-of-truth when reviewing code:

- `apps/api/dist/`
- `.data/storage/`
- `docs/_evidence_archived/`

They may be useful for local runtime or evidence retention, but they are not canonical implementation sources.

## Do Not Blindly Delete

These paths may look old, but they are still part of active code or current workflow:

- `apps/web/src/components/_legacy/`
- `docs/_evidence/run_launch_gates_20260316_213550/`
- `docs/_evidence/run_launch_gates_20260316_204710/`
- `apps/fusion-engine/`

Delete or rename these only after checking imports, scripts, or workflow references.

## Practical Rule

When judging the repo:

1. Read source from `apps/`, `packages/`, `tools/`, and tracked root docs.
2. Use only the two current launch-gates reports above for final gate status.
3. Ignore `dist_temp`, `dist_diag`, caches, tmp files, and old archived evidence unless debugging history.
