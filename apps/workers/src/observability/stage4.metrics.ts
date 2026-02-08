import client from "prom-client";
import { registry } from "@scu/observability";

const NS = "scu";
const SUB = "stage4";

export const stage4JobsTotal = new client.Counter({
    name: `${NS}_${SUB}_jobs_total`,
    help: "Stage4 job lifecycle counter",
    labelNames: ["type", "status"] as const,
    registers: [registry],
});

export const stage4FailedJobs = new client.Counter({
    name: `${NS}_${SUB}_failed_jobs_total`,
    help: "Stage4 failed jobs counter",
    labelNames: ["type", "reason"] as const,
    registers: [registry],
});

export const stage4DurationSeconds = new client.Histogram({
    name: `${NS}_${SUB}_duration_seconds`,
    help: "Stage4 end-to-end duration (sec)",
    buckets: [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800],
    labelNames: ["type"] as const,
    registers: [registry],
});

export const stage4ThroughputBps = new client.Gauge({
    name: `${NS}_${SUB}_throughput_bps`,
    help: "Stage4 throughput bytes/sec (best-effort)",
    labelNames: ["type"] as const,
    registers: [registry],
});

export const stage4PeakRssMb = new client.Gauge({
    name: `${NS}_${SUB}_peak_rss_mb`,
    help: "Stage4 worker peak RSS (MB) during a run",
    labelNames: ["type"] as const,
    registers: [registry],
});

export function ensureDefaultMetrics() {
    // synced with main registry
}
