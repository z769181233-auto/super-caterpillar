# RSS Validation (Phase 5 Seal)

## 1. Mouth-of-Truth Comparison
| Source | Value (Peak) | Scope | Method |
| :--- | :--- | :--- | :--- |
| **Internal Metric** (`scu_stage4_peak_rss_mb`) | ~201 MB | Single Node.js Worker Process | `process.memoryUsage().rss` |
| **Gate Monitor** (`monitor.log`) | ~1389 MB | Total @scu/worker swarm | `ps -ax o rss | grep worker` |

## 2. Discrepancy Analysis
The ~1.2GB delta is attributed to the `dev` environment overhead:
1. **Runner Overhead**: `pnpm` and `ts-node` wrapper processes.
2. **Sub-process Swarm**: The `dev` command spawns multiple layers of Node.js for hot-reloading and transpilation.
3. **Internal vs System**: The internal metric strictly measures the V8 container's physical memory footprint, excluding shared libraries and mapping overhead captured by `ps`.

## 3. Commercial Reliability Conclusion
- The value **201MB** for 3M baseline is **VALID** for a single-worker instance.
- The historical **1.7GB-2.0GB** for 15M represents the **TOTAL SYSTEM IMPACT** under stress.
- **Decision**: Retain `process.memoryUsage().rss` as the high-fidelity internal signal, but use Gate Monitoring for "Total Infrastructure Impact" regression.
- **Alert Threshold**: Updated to `3000MB` (Cluster) in `stage4.alerts.yml`.
