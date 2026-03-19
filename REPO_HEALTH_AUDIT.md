## Repository Health Audit

This file records the current post-cleanup repository state so future work can distinguish
between real remaining risks and intentional retained compatibility or assets.

### Current branch alignment

- Local branch is expected to match `origin/codex/truth-seal-final`.
- This cleanup wave assumes a clean working tree after each pushed commit.

### What has been cleaned and normalized

#### Repository noise removed

- Historical launch-gate evidence was reduced to a single current trusted report pointer:
  - `docs/_evidence/CURRENT_OK_REPORT.txt`
  - `docs/_evidence/run_launch_gates_20260316_213550/GATEKEEPER_VERIFICATION_REPORT.md`
- Historical evidence archive and deprecated sample directories were removed locally:
  - `docs/_evidence_archived/`
  - `docs/_deprecated_samples/`
- Unreferenced tracked sample outputs, old checkpoints, debug screenshots, and stale renderer assets were removed.

#### Misleading naming reduced

- Active `_legacy` entry points were migrated or documented.
- `debug-jobs.ts` was renamed to the operationally accurate `inspect-jobs.ts`.
- Historical comments that implied dead code where compatibility still exists were rewritten.

#### Runtime fallback boundaries tightened

- Broad PG fallbacks in normal runtime were narrowed across:
  - worker lifecycle
  - job update / query / auth / creation
  - billing / budget / capacity
  - JWT
  - audit log
  - API key lookup
- Remaining runtime fallback policy is recorded in `FALLBACK_GOVERNANCE.md`.
- A remaining synthetic timeout in `apps/api/src/audit-insight/audit-insight.service.ts` was removed so
  audit insight no longer manufactures partial failures via local `Promise.race`.

#### Documentation source-of-truth clarified

- Active engineering SSOT is now indexed in:
  - `docs/_specs/ACTIVE_SSOT_INDEX.md`
- Historical PDF/Word source documents were moved out of `docs/_specs` root into:
  - `docs/_specs_archived/historical_source_docs_20260319/`

### Current intentional retained items

#### Tracked non-code asset still kept in Git

Only one tracked large non-code asset remains:

- `output/lora_chenpingan/pytorch_lora_weights.bin`

Why it is kept:

- It is still referenced by active character tooling:
  - `tools/production/character_db/auto_compare_lora.py`
  - `tools/production/character_db/inference_optimized.py`
  - `tools/production/character_db/p0_judicial_audit.py`
  - `tools/production/character_db/sample_final.py`

Retention policy is recorded in:

- `ASSET_RETENTION_BOUNDARIES.md`

#### Active operational tools still kept

The following are not cleanup leftovers:

- `apps/api/src/scripts/inspect-jobs.ts`
- `tools/backup/db_backup.sh`
- `tools/backup/db_restore.sh`

These are active operational tools or gate dependencies.

#### Compatibility that is still intentionally present

Documented in:

- `COMPATIBILITY_BOUNDARIES.md`

Most important remaining examples:

- `apps/api/src/project/dto/create-episode.dto.ts`
  - `name` remains as an optional compatibility alias for older callers
- `apps/api/src/billing/billing-ledger-compat.util.ts`
  - compatibility layer exists until physical billing ledger schema migration is finished
- `apps/api/src/auth/hmac/hmac-auth.guard.ts`
  - `request.user.id` stays aligned with downstream Passport-style consumers

### Remaining real risks

#### 1. Prisma root cause is not fully removed

Even after narrowing many PG fallbacks, the real remaining engineering problem is still:

- Prisma degradation under some runtime paths

Current status:

- Synthetic timeout noise has been reduced in `apps/api/src/prisma/prisma.service.ts`
- raw PG fallback client behavior is now centralized through:
  - `apps/api/src/prisma/pg-runtime.util.ts`
- service-level fallback eligibility is now also centralized through:
  - `isPrismaFallbackEligibleError()`
- background schedulers no longer self-skip on generic `PRISMA_QUERY_TIMEOUT`; they only skip on real DB unavailability
- `audit-insight` no longer fabricates local timeout-based partial failures

But the remaining real work is:

- remove the need for broad runtime PG fallback by fixing Prisma degradation itself

#### 2. Security fallback surface still exists, but is narrowed

Highest sensitivity remains:

- `apps/api/src/security/api-security/api-security.service.ts`

Current status:

- env-secret fallback and legacy secret-hash fallback are no longer open by default
- they are limited to CI/test/gate or explicit flags
- API key lookup / `lastUsedAt` PG fallback is now further narrowed to real DB-unavailability
  signals instead of generic Prisma degraded-mode errors

Remaining risk:

- trust-boundary logic still has explicit fallback modes and deserves separate hardening work

#### 3. Billing ledger physical schema is still not final SSOT shape

Current code has a compatibility layer that normalizes ledger rows toward SSOT, but:

- physical DB schema is still not fully migrated to the final `BILLING_LEDGER_SSOT.md` form

Meaning:

- read/write semantics are closer to SSOT
- `billing-ledger-compat.util.ts` now centralizes status mapping so active read/write paths no longer
  hardcode `COMMITTED` as their only notion of a billed ledger
- storage model still needs a deliberate schema migration phase

### What should not be mistaken for repository problems

- `GitHub found 13 vulnerabilities` during push refers to the repository default branch `main`, not automatically to this feature branch state.
- `LEGACY_STUB` selectors inside engine packages are still part of the explicit stage-3 engine mode model, not accidental dead code by themselves.
- compatibility markers inside tests or verification scripts are often deliberate regression coverage, not runtime debt.

### Recommended next phase

The next phase should not continue broad cleanup-by-name.

It should focus on three explicit tracks:

1. Prisma root-cause remediation
- reduce or remove remaining runtime PG fallback dependence

2. Security hardening final pass
- `apps/api/src/security/api-security/api-security.service.ts`

3. Billing ledger schema migration
- move from compatibility normalization toward physical SSOT alignment

### Bottom line

The repository is no longer dominated by stale reports, dead debug tools, fake entry points, or historical output artifacts.

The main remaining work is now structural and real:

- Prisma stability
- security fallback hardening
- billing schema convergence
