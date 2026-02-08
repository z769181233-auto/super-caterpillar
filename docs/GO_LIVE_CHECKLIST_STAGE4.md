# Go-Live Checklist - Stage 4 (Phase 5)

## 1. Required Nightly Gate (3M Baseline)

- **Execution Entrance**: `bash tools/gate/gates/gate_stage4_scaling_15m.sh`
- **Required Check Interval**: Nightly (via CI/CD)
- **Evidence Path**: `docs/_evidence/stage4_nightly_3m_<TS>/`
- **Required Artifacts**:
  - `final_summary.json`: Must have `"status": "PASS"`
  - `metrics_snapshot.txt`: Captured from `API:3000/metrics`
  - `monitor.log`: Performance trace throughout the run
  - `input.sha256`: Input data integrity fingerprint

## 2. Observability Hardening

- [x] **Unified Metrics**: API 3000/metrics proxies Worker 3001/metrics (**PASS**)
- [x] **RSS Calibration**: Internal RSS (201MB) vs Cluster RSS (1389MB) documented (**PASS**)
- [x] **Alerting**: Failure/RSS/Regression rules enabled (**PASS**)
- [x] **Last Verified**: `docs/_evidence/phase5_observability_seal_$(cat current_evidence_path.txt | rev | cut -d/ -f1 | rev)`

## 3. Commercial Readiness Assertion

- [x] Zero-OOM Promise sustained under 3M/15M loads.
- [x] Throughput remains > 100KB/s (Target: 140KB/s achieved).
