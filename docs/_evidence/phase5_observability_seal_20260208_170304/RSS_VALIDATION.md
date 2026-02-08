# RSS Validation (Phase 5 Seal)

## 1. Mouth-of-Truth Comparison
| Source | Value (Peak) | Scope | Method |
| :--- | :--- | :--- | :--- |
| **Internal Metric** (`scu_stage4_peak_rss_mb`) | ~201 MB | Single Node.js Worker Process | `process.memoryUsage().rss` |
| **Gate Monitor** (`monitor.log`) | ~1389 MB | Total @scu/worker swarm | `ps -ax o rss | grep worker` |

## 2. Correction (Definition & Scope)
- `process.memoryUsage().rss` measures the **RSS of the current Node.js process** (resident set size).
- `ps`-based RSS measurements are comparable **only when referencing the same PID** at approximately the same time.
- The observed delta (e.g., 201MB vs 1389MB) is caused by **scope mismatch**:
  - Swarm / multiple worker processes active simultaneously.
  - Dev wrappers (`pnpm`/`ts-node`/hot-reload) spawning additional Node.js processes.
  - Summing multiple PIDs or sampling different moments.

## 3. Audit Decision (Two-tier Signals)
- Keep `scu_stage4_peak_rss_mb` as **per-worker process RSS** signal for high-fidelity code regressions.
- Keep `monitor.log` / swarm RSS as **total system impact** signal for infra capacity planning.
- Any "Commercial Seal" verification must distinguish between single-process stability and swarm-level impact.
