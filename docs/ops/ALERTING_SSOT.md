# ALERTING_SSOT.md - Ops Alerting Single Source of Truth (P17-0)

> Status: DRAFT (P17-0)
> Owner: Ops / Oncall
> Source: P16-2.3 sealed alert_thresholds.md + tools/ops/p16_2_rollout.sql (Runbook)
> Generated Snapshot Tool: tools/ops/dashboard_snapshot.sh
> Gate: tools/gate/gates/gate-ops-dashboard-snapshot.sh

## 1. Scope
This SSOT defines **what to watch**, **when to alert**, and **what to do** (strict runbook) for CE23 rollout ops.

## 2. Metrics Contract
All metrics are read from: `GET /api/ops/metrics` (HMAC-auth)

### Required Fields (P0)
- rework_rate_1h
- blocked_by_rate_limit_1h
- ce23_guardrail_blocked_1h
- ce23_real_marginal_fail_1h

### Optional/Supporting (P1)
- ce23_real_scored_1h / ce23_real_shadow_1h / ce23_real_fail_1h (if present)
- worker_jobs_active / api_uptime_seconds (if present)

## 3. Alert Rules (Strict, No "~0" ambiguity)

### 3.1 P0: Rework Storm
Rule:
- Trigger if: `rework_rate_1h >= max(5, baseline_rework_rate_1h * 2)`

Action (STRICT ORDER):
1) Set ENV: `CE23_REAL_FORCE_DISABLE=1` (Env Kill)
2) Execute SQL: Disable All (tools/ops/p16_2_rollout.sql Section 3)
3) Recovery: Disable All -> Shadow Only (Section 2) -> Stable -> Whitelist Real (Section 5)

### 3.2 Warning: Rate Limit Pressure
Rule:
- Trigger warning if `blocked_by_rate_limit_1h` shows rising trend (3 consecutive checks increasing)

Action:
- Identify heavy org/project; verify REWORK_MAX_CONCURRENCY_PER_ORG, check queue saturation.

### 3.3 Warning: Guardrail Overuse (Input Drift / Threshold Too Strict)
Rule:
- Trigger warning if `ce23_guardrail_blocked_1h >= 20`

Action:
- Review marginal cases; consider threshold calibration (P16-1 window) and input drift.

### 3.4 Warning: Marginal Fail Flood
Rule:
- Trigger warning if `ce23_real_marginal_fail_1h >= 50`

Action:
- Review marginal distribution; consider threshold adjustment / data quality.

### 3.5 Audio Runtime Guardrails (P20-0)

**P0: Kill Switch Active**
Rule:
- Trigger if `audio_kill_switch_active == 1` for 2 consecutive polls.

Action:
- 1) Confirm if intentional (Maintenance/Drill).
- 2) If unintentional: Treat as Incident. Execute Audio Recovery Runbook (Verify Env Vars -> Restart).

**P1: Cache Hit Rate Collapse**
Rule:
- Trigger if `audio_cache_hit_rate_1h < 0.5` AND `audio_preview_requests_1h >= 20`.

Action:
- 1) Check for library/version updates causing global invalidation.
- 2) Verify `preview` vs `full` key generation logic.

**P1: Vendor Cost Spike**
Rule:
- Trigger if `audio_vendor_calls_1h >= 50` (or `baseline * 2`).

Action:
- 1) Identify heavy project source.
- 2) Verify if Whitelist is too broad.

**P2: Preview Usage Ratio**
Rule:
- Trigger if `audio_preview_requests_1h / max(1, audio_requests_1h) > 0.8` (Informational).

## 5. Gate Requirements
- Gate must verify required fields exist
- Must run twice (Double PASS)
- Evidence directories recorded in task.md
