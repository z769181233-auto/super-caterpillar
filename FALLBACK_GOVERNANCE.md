# Fallback Governance

This file classifies runtime fallbacks that still exist in the repo so future cleanup work can distinguish
between acceptable resilience and misleading "fake green" behavior.

## Category A: Allowed For Runtime Resilience

These fallbacks protect real runtime paths from transient Prisma degradation. They are still technical debt,
but they preserve truthful behavior and do not fabricate successful outcomes.

- `apps/api/src/worker/worker.service.ts`
- `apps/api/src/job/job.service.ts`
- `apps/api/src/job/job-update-ops.service.ts`
- `apps/api/src/job/job-engine-binding.service.ts`
- `apps/api/src/billing/billing.service.ts`
- `apps/api/src/billing/budget.service.ts`
- `apps/api/src/capacity/capacity-gate.service.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/audit-log/audit-log.service.ts`
- `apps/api/src/job/job-auth-ops.service.ts`
- `apps/api/src/task/task.service.ts`
- `apps/api/src/job/job-creation-ops.service.ts`

Rule:

- Keep only while Prisma degradation root cause is unresolved.
- Must not silently convert failed business behavior into success.
- Must not diverge by default between local development and production behavior.
- Example: billing should use PG-primary only in CI/test/gate or via explicit override, not in all non-production environments.
- Example: worker direct PG dispatch should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: job ack/report PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: engine selection/version PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: budget status PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: capacity PG fallback should stay disabled in normal runtime and fail-open capacity checks should be limited to CI/test/gate or explicit override.
- Example: JWT user/org PG fallback should stay disabled in normal runtime and degraded authentication paths should not bounce back into Prisma for debug enumeration.
- Example: audit-log PG fallback should stay disabled in normal runtime and degrade to best-effort skip outside CI/test/gate unless explicitly overridden.
- Example: billing read/write PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: worker lifecycle PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.
- Example: job query/auth/task creation PG fallback should stay disabled in normal runtime and only be allowed in CI/test/gate or via explicit override.

## Category B: CI/Test/Gate Only

These fallbacks exist only to make CI or deterministic gate verification possible where full async/runtime
infrastructure is intentionally not reproduced.

- `tools/gate/gates/gate-context-injection-consistency.sh`
- `tools/gate/gates/gate-ce01-protocol-alignment.sh`
- `tools/gate/gates/gate-ce02-visual-density.sh`
- `tools/gate/gates/gate-ce11-shot-generator.sh`
- `tools/gate/gates/gate-p1-1_shots_director_cols.sh`
- `tools/gate/gates/gate-p4-e2e-novel-to-published-hls.sh`
- `tools/gate/scripts/verify_billing_closed_loop.ts`

Rule:

- These are acceptable only in CI/gate mode.
- They must never be reused as production success criteria.

## Category C: Security-Sensitive Fallbacks

These require the strictest control because they affect trust boundaries.

- `apps/api/src/security/api-security/api-security.service.ts`

Current rule:

- DB per-key encrypted secret is the default and preferred source.
- Env-secret fallback is allowed only in CI/test/gate or via explicit `ALLOW_HMAC_ENV_FALLBACK=1`.
- Legacy `secretHash` fallback is allowed only in CI/test/gate or via explicit
  `ALLOW_LEGACY_SECRET_HASH_FALLBACK=1`.
- API key lookup / `lastUsedAt` PG fallback is allowed only in CI/test/gate or via explicit
  `FORCE_APIKEY_PG_FALLBACK=1`.

## Next Cleanup Order

1. Remove security-sensitive fallbacks first where possible.
2. Replace resilience fallbacks by fixing Prisma root cause.
3. Keep CI deterministic fallbacks isolated and clearly labeled.

## Tightened In This Cleanup Wave

These runtime fallbacks now require `CI/test/gate` context or an explicit override instead of being
available by default in normal runtime:

- `apps/api/src/worker/worker.service.ts`
- `apps/api/src/job/job-update-ops.service.ts`
- `apps/api/src/job/job-engine-binding.service.ts`
- `apps/api/src/billing/budget.service.ts`
- `apps/api/src/capacity/capacity-gate.service.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/audit-log/audit-log.service.ts`
- `apps/api/src/billing/billing.service.ts`
- `apps/api/src/job/job.service.ts`
- `apps/api/src/job/job-auth-ops.service.ts`
- `apps/api/src/task/task.service.ts`
- `apps/api/src/job/job-creation-ops.service.ts`

## Remaining High-Priority Queue

These paths still deserve another pass because they either remain broadly enabled or still contain
degraded-mode behavior that can obscure the real failure source:

1. `apps/api/src/security/api-security/api-security.service.ts`
- Security-sensitive.
- Still the highest-risk remaining fallback surface because it affects trust boundaries.

2. Prisma root-cause remediation
- Most broad runtime fallbacks have now been narrowed to `CI/test/gate` or explicit override.
- The next meaningful step is no longer “add another flag”, but to remove the need for these flags by
  fixing Prisma degradation itself.
- Raw `pg` fallback clients should stay centralized through
  `apps/api/src/prisma/pg-runtime.util.ts` so timeout/application-name behavior no longer drifts
  per service.

## Removed Hard Bypasses

These patterns are not acceptable and should stay removed:

- Project/org hardcoded billing bypasses such as `org_wangu` / `wangu_trailer_20260215_232235`
