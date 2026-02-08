# Phase 5 (P11) SEAL Evidence Index (Audit Lock)

## 1. Hard Seal Script (Audit Control)
- Script: `docs/_evidence/phase5_p11_seal_finalize_20260208_205011/phase5_seal_finalize.sh`
- Logic: `set -euo pipefail`, non-contradictory assertions.
- Evidence:
  - `./run.log` (Hard Audit Trace: no FAIL allowed before completion)

## 2. Prometheus Truth Layer (SLO Decisive)
- Target: `http://localhost:3000/metrics`
- Evidence:
  - `./metrics.txt` (Full Snapshot)
  - `./metrics_assert_excerpt.txt` (Confirmed Histogram `_bucket` existence)

## 3. Security Negative Matrix (Audit Shield)
- Endpoint: `/api/admin/metrics/p1`
- Evidence:
  - `./admin_metrics_unauth.hdr` (Returns HTTP 401 Unauthorized)
  - `./admin_metrics_unauth.body`

## 4. Financial Ledger Reconciliation (Idempotency Proof)
- Database: `cost_ledgers` (Port 5433)
- Evidence:
  - `./ledger_count.txt` (Non-empty: 135 rows)
  - `./ledger_dups.txt` (Duplicates = 0, checked on `(jobId, attempt)`)

## 5. Release Path Hygiene (Zero Leak)
- Scope: `apps`, `packages`, `tools`, `docs`
- Evidence:
  - `./path_hygiene_hits.txt` (Empty: Verified no absolute paths in release surface)
  - `./path_hygiene_scan.txt` (Scan parameters and Pass status)

## 6. Repository State
- SHA: `./head_sha.txt`
- Commit: `./head_commit.txt`
