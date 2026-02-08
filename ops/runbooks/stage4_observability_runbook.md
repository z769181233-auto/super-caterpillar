# Stage 4 Observability Runbook (Go-Live)

## 1) If `failed_jobs > 0`
- Check: `/metrics` -> `scu_stage4_jobs_total{status="FAILED"}`
- Action:
  1. Locate failed job IDs in DB / logs.
  2. Validate idempotency: re-run only the failed chunk jobs.
  3. Evidence: capture `metrics_snapshot` + relevant logs into `docs/_evidence/incident_<TS>/`

## 2) If RSS threshold breached
- Confirm scope: per-worker (`scu_stage4_peak_rss_mb`) vs swarm (`monitor.log`)
- Action:
  1. Identify PID(s) with `ps RSS` top.
  2. Correlate with job type label.
  3. Rollback: revert to last sealed tag if regression confirmed.

## 3) If duration regression > 30%
- Compare baseline evidence vs current nightly evidence.
- Action:
  1. Check DB latency, worker concurrency, LLM rate limits.
  2. Reduce concurrency to safe cap and re-run nightly gate.
