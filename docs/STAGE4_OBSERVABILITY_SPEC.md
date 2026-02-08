# Stage 4 Observability Spec (Phase 5)

## Required Metrics
- `stage4_jobs_total{type,status}`: Counter for job lifecycle events.
- `stage4_duration_seconds`: Histogram for end-to-end processing time.
- `stage4_throughput_bps`: Gauge for real-time throughput.
- `stage4_peak_rss_mb`: Gauge for worker memory usage.
- `stage4_failed_jobs`: Counter for error rates.

## Required Alerts
- `failed_jobs > 0`: Immediate critical alert.
- `duration_seconds regression > 30% vs baseline`: P2 warning.
- `peak_rss_mb > 3000`: Memory leak warning.
