# Stage 4 Observability Runbook (Go-Live)

## 0. Execution Environment SSOT (MANDATORY)
The Nightly Gate must be executed in a environment that mimics production:
1. **GitHub Runner (Hosted)**: Must use `docker-compose.yml` to spin up PostgreSQL, Redis, API, and Worker before running the gate script.
2. **Self-Hosted Runner**: Must have API/Worker services managed by `pm2` or `systemd`, locked to the same version as the artifact being tested.
- **Port Lock**: API (3000), Worker Metrics (3001).
- **Hard Readiness**: Gate will fail if `http://localhost:3000/metrics` is unreachable.

## Evidence Template (MANDATORY)
Create: `docs/_evidence/incident_<TS>/`
Must include:
- `metrics_snapshot.txt` (API:3000/metrics)
- `run.log` / key service logs
- `job_ids.txt` (failed or slow jobs identified via DB)
- `decision.md` (brief rollback vs mitigate rationale)

## 1) If `failed_jobs > 0` (CRITICAL)
- **Check**: `/metrics` -> `scu_stage4_jobs_total{status="FAILED"}`
- **Action**:
  1. Identify failed job IDs (Query `shot_jobs` where status='FAILED').
  2. Confirm idempotency contract: re-run ONLY specific failed chunk jobs.
  3. If failure persists (>=2 attempts) -> **Immediate Rollback** to last sealed tag.

## 2) If RSS Threshold Breached
- **Confirm Scope**: Per-worker (`scu_stage4_peak_rss_mb`) vs swarm total (`monitor.log`).
- **Action**:
  1. Correlate PID: ensure ps snapshot matches metrics PID.
  2. If individual worker RSS regresses > 50% vs Phase 5 baseline -> **Immediate Rollback**.

## 3) If Duration Regression > 30%
- **Baseline**: Compare current nightly result vs `docs/_evidence/phase5_observability_seal_20260208_170304/`.
- **Action**:
  1. Check DB lock contention, Worker concurrency, or LLM rate limits.
  2. Mitigation: Lower `CONCURRENCY_CAP` and re-run.
  3. If still regresses -> **Rollback**.

## Rollback Decision Tree (FAST)
| Incident Signal | Persistence | Decision |
| :--- | :--- | :--- |
| Any `failed_jobs > 0` | After 1 retry | **ROLLBACK** |
| Worker RSS > 3000MB (Per-worker) | Any run | **ROLLBACK** |
| Duration Regression > 50% | 2 consecutive runs | **ROLLBACK** |
| `input.sha256` Mismatch | N/A | **INVESTIGATE (Audit Failure)** |
