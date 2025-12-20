# Release Criteria: E2E Vertical Slice RC1

## 1. Overview
RC1 marks the first "Vertical Slice" proof, establishing that the system is capable of end-to-end execution from API to Worker and back, with observability and error handling in place.

## 2. Gatekeeper Thresholds
All CI/CD pipelines must pass the following checks before any merge:
- **API Build**: `pnpm -C apps/api build` (Strict TS, NestJS Build).
- **Web Lint**: `pnpm -C apps/web lint:strict` (Zero Warnings).
- **Web Build**: `pnpm -C apps/web build` (Next.js Production Build).
- **Audit Baseline**: `tools/dev/check_audit_baseline.ts` (No regression in `any` usage).

## 3. E2E- [x] **Automated Verification:** `run_e2e_vertical_slice.sh` passes without manual intervention.
- [x] **Worker Authentication:** Worker successfully registers and authenticates via HMAC.
- [x] **Job Distribution:** `NOVEL_ANALYSIS` jobs are correctly created by API and picked up by Worker.
- [x] **Error Handling:** Worker reports structured errors (Fail Fast) for invalid inputs.
- [x] **Result Persistence:** Job completion updates Database state.

## 4. Known Limitations (RC1)
- Only `NOVEL_ANALYSIS` job type is fully verified.
- Auth in smoke script relies on DB seeding (not UI flow).

## 5. Sign-off Checklist
- [ ] Gatekeeper Passed.
- [ ] Smoke Script Passed (3/3 runs).
- [ ] No regression in lint/types.
