-- P1 Metrics Verification SQL
-- Returns a single JSON row with all Observability Spec metrics

WITH job_stats AS (
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status::text IN ('SUCCEEDED', 'COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED')) AS terminal,
        COUNT(*) FILTER (WHERE status::text = 'SUCCEEDED') AS succeeded,
        COUNT(*) FILTER (WHERE status::text = 'FAILED') AS failed,
        -- Pending is anything NOT terminal
        COUNT(*) FILTER (WHERE status::text NOT IN ('SUCCEEDED', 'COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED')) AS pending,
        -- P95 Latency (ms): EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000
        -- Note: using updated_at as proxy for completed_at for terminal jobs
        percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) * 1000) FILTER (WHERE status::text IN ('SUCCEEDED', 'COMPLETED', 'FAILED')) AS p95_ms
    FROM shot_jobs
),
ledger_stats AS (
    SELECT
        COUNT(*) AS rows,
        -- Count distinct (jobId, jobType) pairs that appear > 1 time
        (SELECT COUNT(*) FROM (
            SELECT "jobId", "jobType"
            FROM cost_ledger
            GROUP BY "jobId", "jobType"
            HAVING COUNT(*) > 1
        ) sub) AS dups
    FROM cost_ledger
)
SELECT json_build_object(
    'jobs_total', coalesce(j.total, 0),
    'jobs_terminal', coalesce(j.terminal, 0),
    'jobs_succeeded', coalesce(j.succeeded, 0),
    'jobs_failed', coalesce(j.failed, 0),
    'jobs_pending', coalesce(j.pending, 0),
    'latency_p95_ms', coalesce(j.p95_ms, 0),
    'ledger_rows', coalesce(l.rows, 0),
    'ledger_dups', coalesce(l.dups, 0)
) AS metrics
FROM job_stats j, ledger_stats l;
