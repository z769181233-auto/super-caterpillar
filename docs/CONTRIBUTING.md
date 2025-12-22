# Contributing Guide

## High Standards & Linting

We enforce strict linting rules to maintain code quality.
- **No `any`**: Explicitly define types.
- **No `eslint-disable`**: Unless absolutely necessary and approved.

## Legacy Code Policy

The directory `apps/web/src/components/_legacy` is **FROZEN**.

### Rules:
1.  **Read-Only for Features**: Do NOT add new features to components in this directory.
2.  **Migration First**: If you need to modify a legacy component for a feature, you must:
    -   Move it back to `src/components/` (removing `_legacy` from path).
    -   Fix ALL lint errors (remove `any`, type everything).
    -   Verify the build passes.
3.  **Bug Fixes**: Minor bug fixes are allowed in `_legacy` but discouraged.
4.  **No New Files**: Do not create new files in `_legacy`.

## Git Hooks

We use `husky` and `lint-staged` to ensure quality.
- **Pre-commit**: Runs `eslint` on changed files. if you introduce `any` or other errors in non-legacy files, the commit will fail.
