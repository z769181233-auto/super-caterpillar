# Observability Spec: P1 Telemetry & Metrics (SSOT)

> **Status**: APPROVED
> **Scope**: P1 System Hardening (Performance, Concurrency, Billing)
> **Owner**: DevOps / Core Engineering

## 1. Overview

This document defines the Single Source of Truth (SSOT) for P1 system metrics.
These metrics are used for:

1.  **Gate Verification**: Performance & Stress testing assertions.
2.  **Live Monitoring**: Dashboard visibility (Grafana/Datadog).
3.  **Audit**: Financial and operational integrity checks (Cost Ledger).

## 2. Metrics Definition

| Metric Key       | Source (DB)   | Aggregation/Logic                                | Threshold (Gate)            | Description                                    |
| :--------------- | :------------ | :----------------------------------------------- | :-------------------------- | :--------------------------------------------- |
| `jobs_total`     | `shot_jobs`   | `COUNT(*)`                                       | N/A                         | Total jobs in the system history.              |
| `jobs_pending`   | `shot_jobs`   | `COUNT(*)` where status NOT IN (Terminal)        | `<= MAX_PENDING_END`        | Current backlog. Should drain to 0 after load. |
| `jobs_succeeded` | `shot_jobs`   | `COUNT(*)` where status='SUCCEEDED'              | Rate >= 98% (Deferred P1-5) | Successfully completed jobs.                   |
| `jobs_failed`    | `shot_jobs`   | `COUNT(*)` where status='FAILED'                 | Rate <= 2% (Deferred P1-5)  | Failed execution (after retries).              |
| `jobs_terminal`  | `shot_jobs`   | `COUNT(*)` where status IN (SUCC,COMP,FAIL,CANC) | == jobs_total (ideal)       | Jobs that have reached a final state.          |
| `ledger_rows`    | `cost_ledger` | `COUNT(*)`                                       | > 0 (if jobs run)           | Total financial records generated.             |
| `ledger_dups`    | `cost_ledger` | Group by `(jobId, jobType)` having count > 1     | **MUST BE 0**               | Idempotency Check. Critical Layout.            |
| `latency_p95`    | `shot_jobs`   | 95th percentile of `(completedAt - createdAt)`   | `<= 60s` (Deferred P1-5)    | End-to-End Processing Latency.                 |

_Terminal States_: `SUCCEEDED`, `COMPLETED`, `FAILED`, `CANCELED`, `CANCELLED`

## 3. Data Sources & Access

### 3.1 Database (SQL)

- **Tool**: `tools/gate/sql/p1_metrics.sql`
- **Purpose**: Ground truth verification, audit snapshots.
- **Format**: JSON-like one-row output or Key-Value pairs.

### 3.2 API (Read-Only)

- **Endpoint**: `GET /api/admin/metrics/p1`
- **Auth**: Admin JWT / Internal HMAC
- **Response**:

```json
{
  "timestamp": 1736316000000,
  "metrics": {
    "jobs_total": 1500,
    "jobs_pending": 0,
    "jobs_succeeded": 1490,
    "jobs_failed": 10,
    "ledger_dups": 0,
    "latency_p95_ms": 4500
  }
}
```

## 4. Failure Codes (Gate)

| Code | Meaning                       |
| :--- | :---------------------------- |
| `5x` | Metric divergence (API != DB) |
| `51` | Ledger Duplicates Detected    |
| `52` | Success Rate Violation        |
| `53` | Pending Jobs Leaked           |
| `54` | Latency Violation             |

## 5. Implementation Guide

- **Consistency**: The API must query the **Primary DB** (or strongly consistent replica).
- **Sampling**: P95 calculation may use sampling for huge datasets, but precise for Gate runs (<10k jobs).
